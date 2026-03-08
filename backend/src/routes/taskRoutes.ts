import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify'
import { prismaQuery } from '../lib/prisma.ts'
import { lockEscrow, getEscrowAddress, getEscrowBalance, refundEscrow } from '../lib/wdk/escrow.ts'
import { getTreasuryBalance, getTreasuryAddress } from '../lib/wdk/treasury.ts'
import { handleError } from '../utils/errorHandler.ts'
import { redactTaskLocation } from '../utils/locationUtils.ts'
import { MIN_TASK_PAYMENT, MAX_TASK_PAYMENT } from '../config/contracts.ts'

// Reputation thresholds for task access
const REPUTATION_TIERS = {
  low: { maxPayment: 5_000000n, minReputation: 0 },     // $0-$5: anyone
  mid: { maxPayment: 50_000000n, minReputation: 0.5 },   // $5-$50: need 0.5+ reputation
  high: { maxPayment: MAX_TASK_PAYMENT, minReputation: 2 }, // $50+: need 2+ reputation (2 completed tasks)
}

export const taskRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  // List all open tasks (PUBLIC: approximate location only)
  app.get('/list', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tasks = await prismaQuery.task.findMany({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
      })

      // Redact exact location for public listing
      const redacted = tasks.map(t => redactTaskLocation(t))

      return reply.send({ success: true, error: null, data: redacted })
    } catch (error) {
      return handleError(reply, 500, 'Failed to list tasks', 'TASK_LIST_FAILED', error)
    }
  })

  // Get task by ID
  // If the requesting worker is assigned, show full location.
  // Otherwise, show approximate location.
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { workerId?: string } }>, reply: FastifyReply) => {
    try {
      const task = await prismaQuery.task.findUnique({
        where: { id: request.params.id },
        include: { worker: true, submissions: true },
      })
      if (!task) return handleError(reply, 404, 'Task not found', 'TASK_NOT_FOUND')

      const requestingWorkerId = (request.query as { workerId?: string })?.workerId

      // If the requesting worker is the assigned worker, show full details
      if (task.workerId && task.workerId === requestingWorkerId) {
        return reply.send({ success: true, error: null, data: task })
      }

      // Otherwise redact location
      const redacted = redactTaskLocation(task)
      return reply.send({ success: true, error: null, data: { ...redacted, submissions: task.submissions, worker: task.worker } })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get task', 'TASK_GET_FAILED', error)
    }
  })

  // Agent posts a new task (locks escrow)
  app.post('/create', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        description: string
        category: string
        lat: number
        lon: number
        address?: string
        radiusMeters?: number
        pickupLat?: number
        pickupLon?: number
        pickupAddress?: string
        pickupRadiusMeters?: number
        minDurationMinutes?: number
        paymentAmount: string
        deadlineHours: number
      }

      const amount = BigInt(body.paymentAmount)
      if (amount < MIN_TASK_PAYMENT) return handleError(reply, 400, 'Payment too low (min 1 USDT)', 'PAYMENT_TOO_LOW')
      if (amount > MAX_TASK_PAYMENT) return handleError(reply, 400, 'Payment too high (max 1000 USDT)', 'PAYMENT_TOO_HIGH')

      const taskCount = await prismaQuery.task.count()
      const escrowIndex = taskCount + 1
      const escrowAddress = await getEscrowAddress(escrowIndex)
      const escrowTxHash = await lockEscrow(escrowIndex, amount)

      const deadline = new Date(Date.now() + body.deadlineHours * 60 * 60 * 1000)
      const task = await prismaQuery.task.create({
        data: {
          description: body.description,
          category: body.category,
          lat: body.lat,
          lon: body.lon,
          address: body.address,
          radiusMeters: body.radiusMeters || 100,
          pickupLat: body.pickupLat || null,
          pickupLon: body.pickupLon || null,
          pickupAddress: body.pickupAddress || null,
          pickupRadiusMeters: body.pickupRadiusMeters || null,
          minDurationMinutes: body.minDurationMinutes || null,
          paymentAmount: body.paymentAmount,
          escrowAccountIndex: escrowIndex,
          escrowAddress,
          escrowTxHash,
          deadline,
        },
      })

      await prismaQuery.agentLog.create({
        data: {
          action: 'execute',
          details: JSON.stringify({
            type: 'task_created',
            taskId: task.id,
            amount: body.paymentAmount,
            escrowAddress,
          }),
          txHash: escrowTxHash,
        },
      })

      return reply.send({ success: true, error: null, data: task })
    } catch (error) {
      return handleError(reply, 500, 'Failed to create task', 'TASK_CREATE_FAILED', error)
    }
  })

  // Worker accepts a task (with reputation gating)
  app.post('/:id/accept', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { workerId } = request.body as { workerId: string }
      const task = await prismaQuery.task.findUnique({ where: { id: request.params.id } })

      if (!task) return handleError(reply, 404, 'Task not found', 'TASK_NOT_FOUND')
      if (task.status !== 'open') return handleError(reply, 400, 'Task is not available', 'TASK_NOT_OPEN')

      // Reputation gating: check if worker qualifies for this task value
      const worker = await prismaQuery.worker.findUnique({ where: { id: workerId } })
      if (!worker) return handleError(reply, 404, 'Worker not found', 'WORKER_NOT_FOUND')

      // Delivery tasks require reputation >= 5 (trusted workers only)
      if (task.category === 'delivery' && worker.reputationScore < 5) {
        return handleError(reply, 403, `Delivery tasks require reputation score >= 5 (trusted workers). Your score: ${worker.reputationScore.toFixed(2)}`, 'INSUFFICIENT_REPUTATION')
      }

      const taskAmount = BigInt(task.paymentAmount)
      if (taskAmount > REPUTATION_TIERS.low.maxPayment && worker.reputationScore < REPUTATION_TIERS.mid.minReputation) {
        return handleError(reply, 403, `Tasks above $5 require reputation score >= ${REPUTATION_TIERS.mid.minReputation}. Your score: ${worker.reputationScore.toFixed(2)}`, 'INSUFFICIENT_REPUTATION')
      }
      if (taskAmount > REPUTATION_TIERS.mid.maxPayment && worker.reputationScore < REPUTATION_TIERS.high.minReputation) {
        return handleError(reply, 403, `Tasks above $50 require reputation score >= ${REPUTATION_TIERS.high.minReputation}. Your score: ${worker.reputationScore.toFixed(2)}`, 'INSUFFICIENT_REPUTATION')
      }

      const updated = await prismaQuery.task.update({
        where: { id: request.params.id },
        data: { status: 'accepted', workerId },
      })

      // Return FULL location details now that worker is assigned
      return reply.send({ success: true, error: null, data: updated })
    } catch (error) {
      return handleError(reply, 500, 'Failed to accept task', 'TASK_ACCEPT_FAILED', error)
    }
  })

  // Direct booking: agent assigns a specific worker to a task
  app.post('/:id/assign', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { workerId } = request.body as { workerId: string }
      const task = await prismaQuery.task.findUnique({ where: { id: request.params.id } })

      if (!task) return handleError(reply, 404, 'Task not found', 'TASK_NOT_FOUND')
      if (task.status !== 'open') return handleError(reply, 400, 'Task is not available', 'TASK_NOT_OPEN')

      const worker = await prismaQuery.worker.findUnique({ where: { id: workerId } })
      if (!worker) return handleError(reply, 404, 'Worker not found', 'WORKER_NOT_FOUND')
      if (worker.availability === 'offline') return handleError(reply, 400, 'Worker is offline', 'WORKER_OFFLINE')

      // Check skill match
      if (worker.skills && task.category) {
        const workerSkills = worker.skills.toLowerCase().split(',').map(s => s.trim())
        if (!workerSkills.includes(task.category.toLowerCase()) && !workerSkills.includes('all')) {
          return handleError(reply, 400, `Worker lacks skill: ${task.category}`, 'SKILL_MISMATCH')
        }
      }

      const updated = await prismaQuery.task.update({
        where: { id: request.params.id },
        data: { status: 'accepted', workerId },
      })

      // Set worker to busy
      await prismaQuery.worker.update({
        where: { id: workerId },
        data: { availability: 'busy' },
      })

      await prismaQuery.agentLog.create({
        data: {
          action: 'execute',
          details: JSON.stringify({
            type: 'worker_assigned',
            taskId: task.id,
            workerId,
            workerName: worker.name,
            method: 'direct_booking',
          }),
        },
      })

      return reply.send({ success: true, error: null, data: updated })
    } catch (error) {
      return handleError(reply, 500, 'Failed to assign worker', 'TASK_ASSIGN_FAILED', error)
    }
  })

  // Get treasury info
  app.get('/treasury/info', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [balance, address] = await Promise.all([
        getTreasuryBalance(),
        getTreasuryAddress(),
      ])
      return reply.send({
        success: true,
        error: null,
        data: { address, balance: balance.toString(), balanceFormatted: `${Number(balance) / 1e6} USDT` },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get treasury info', 'TREASURY_INFO_FAILED', error)
    }
  })

  done()
}
