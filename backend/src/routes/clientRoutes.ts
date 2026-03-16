import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify'
import { prismaQuery } from '../lib/prisma.ts'
import { getTreasuryAddress } from '../lib/wdk/treasury.ts'
import { handleError } from '../utils/errorHandler.ts'
import { MIN_TASK_PAYMENT } from '../config/contracts.ts'

export const clientRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  // Register a new client
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { walletAddress, name } = request.body as { walletAddress: string; name?: string }
      if (!walletAddress) return handleError(reply, 400, 'Wallet address is required', 'MISSING_WALLET')

      const existing = await prismaQuery.client.findUnique({ where: { walletAddress } })
      if (existing) return reply.send({ success: true, error: null, data: existing })

      const client = await prismaQuery.client.create({
        data: { walletAddress, name },
      })
      return reply.send({ success: true, error: null, data: client })
    } catch (error) {
      return handleError(reply, 500, 'Failed to register client', 'CLIENT_REGISTER_FAILED', error)
    }
  })

  // Client deposits USDT to fund tasks
  // In production: verify on-chain transfer to treasury address via WDK indexer
  // For hackathon demo: accept deposit amount and credit client balance
  app.post('/deposit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { walletAddress, amount, txHash } = request.body as {
        walletAddress: string
        amount: string // USDT base units
        txHash?: string // On-chain proof of deposit (optional for demo)
      }

      if (!walletAddress || !amount) {
        return handleError(reply, 400, 'walletAddress and amount are required', 'MISSING_FIELDS')
      }

      const depositAmount = BigInt(amount)
      if (depositAmount <= 0n) return handleError(reply, 400, 'Amount must be positive', 'INVALID_AMOUNT')

      const client = await prismaQuery.client.findUnique({ where: { walletAddress } })
      if (!client) return handleError(reply, 404, 'Client not found. Register first.', 'CLIENT_NOT_FOUND')

      // Credit client balance
      const updated = await prismaQuery.client.update({
        where: { walletAddress },
        data: {
          balance: (BigInt(client.balance) + depositAmount).toString(),
          totalDeposited: (BigInt(client.totalDeposited) + depositAmount).toString(),
        },
      })

      // Log the deposit
      await prismaQuery.agentLog.create({
        data: {
          action: 'execute',
          details: JSON.stringify({
            type: 'client_deposit',
            clientId: client.id,
            amount: amount,
            amountFormatted: `${Number(amount) / 1e6} USDT`,
            txHash: txHash || null,
          }),
          txHash: txHash || null,
        },
      })

      const treasuryAddress = await getTreasuryAddress().catch(() => 'unknown')

      return reply.send({
        success: true,
        error: null,
        data: {
          client: updated,
          deposit: {
            amount,
            amountFormatted: `${Number(amount) / 1e6} USDT`,
            txHash: txHash || null,
          },
          treasuryAddress,
          note: 'In production, send USDT to the treasury address. The indexer verifies on-chain.',
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to process deposit', 'DEPOSIT_FAILED', error)
    }
  })

  // Client submits a task request (what they need done)
  app.post('/request', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        walletAddress: string
        description: string
        category: string
        targetLat?: number
        targetLon?: number
        targetAddress?: string
        budget: string // Total USDT budget in base units
        maxPricePerTask?: string
        tasksRequested?: number
      }

      if (!body.walletAddress || !body.description || !body.category || !body.budget) {
        return handleError(reply, 400, 'walletAddress, description, category, and budget are required', 'MISSING_FIELDS')
      }

      const client = await prismaQuery.client.findUnique({ where: { walletAddress: body.walletAddress } })
      if (!client) return handleError(reply, 404, 'Client not found', 'CLIENT_NOT_FOUND')

      const budget = BigInt(body.budget)
      const clientBalance = BigInt(client.balance)
      if (budget > clientBalance) {
        return handleError(reply, 400, `Insufficient balance. Have ${Number(clientBalance) / 1e6} USDT, need ${Number(budget) / 1e6} USDT`, 'INSUFFICIENT_FUNDS')
      }

      const tasksRequested = body.tasksRequested || 1
      const perTask = budget / BigInt(tasksRequested)
      if (perTask < MIN_TASK_PAYMENT) {
        return handleError(reply, 400, `Budget too low per task. Min ${Number(MIN_TASK_PAYMENT) / 1e6} USDT per task.`, 'BUDGET_TOO_LOW')
      }

      // Deduct budget from client balance
      await prismaQuery.client.update({
        where: { id: client.id },
        data: {
          balance: (clientBalance - budget).toString(),
          totalSpent: (BigInt(client.totalSpent) + budget).toString(),
        },
      })

      // Create the request for the agent to pick up
      const clientRequest = await prismaQuery.clientRequest.create({
        data: {
          clientId: client.id,
          description: body.description,
          category: body.category,
          targetLat: body.targetLat,
          targetLon: body.targetLon,
          targetAddress: body.targetAddress,
          budget: body.budget,
          maxPricePerTask: body.maxPricePerTask || perTask.toString(),
          tasksRequested,
          status: 'pending',
        },
      })

      // Log the request
      await prismaQuery.agentLog.create({
        data: {
          action: 'decide',
          details: JSON.stringify({
            type: 'client_request_received',
            clientId: client.id,
            requestId: clientRequest.id,
            description: body.description,
            budget: `${Number(body.budget) / 1e6} USDT`,
            tasksRequested,
          }),
        },
      })

      return reply.send({
        success: true,
        error: null,
        data: {
          request: clientRequest,
          budgetFormatted: `${Number(body.budget) / 1e6} USDT`,
          perTaskFormatted: `${Number(perTask) / 1e6} USDT`,
          note: 'The agent will process this request in its next cycle and create individual tasks.',
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to create request', 'REQUEST_FAILED', error)
    }
  })

  // Get client profile and requests
  app.get('/:walletAddress', async (request: FastifyRequest<{ Params: { walletAddress: string } }>, reply: FastifyReply) => {
    try {
      const client = await prismaQuery.client.findUnique({
        where: { walletAddress: request.params.walletAddress },
        include: {
          requests: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      })
      if (!client) return handleError(reply, 404, 'Client not found', 'CLIENT_NOT_FOUND')
      return reply.send({ success: true, error: null, data: client })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get client', 'CLIENT_GET_FAILED', error)
    }
  })

  // Get completed task results for a client request
  app.get('/request/:requestId/results', async (request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply) => {
    try {
      const clientRequest = await prismaQuery.clientRequest.findUnique({
        where: { id: request.params.requestId },
      })
      if (!clientRequest) return handleError(reply, 404, 'Request not found', 'REQUEST_NOT_FOUND')

      const tasks = await prismaQuery.task.findMany({
        where: { clientRequestId: clientRequest.id },
        include: { submissions: true, worker: true },
        orderBy: { createdAt: 'desc' },
      })

      return reply.send({
        success: true,
        error: null,
        data: {
          request: clientRequest,
          tasks,
          summary: {
            totalTasks: tasks.length,
            completed: tasks.filter(t => t.status === 'paid').length,
            pending: tasks.filter(t => ['open', 'accepted', 'submitted'].includes(t.status)).length,
          },
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get results', 'RESULTS_FAILED', error)
    }
  })

  done()
}
