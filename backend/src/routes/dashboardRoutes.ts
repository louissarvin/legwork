import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify'
import { prismaQuery } from '../lib/prisma.ts'
import { getTreasuryBalance, getTreasuryAddress, getTreasuryTokenBalances } from '../lib/wdk/treasury.ts'
import { getAllTreasuryAddresses, registeredChains } from '../lib/wdk/setup.ts'
import { handleError } from '../utils/errorHandler.ts'

export const dashboardRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  // Dashboard overview
  app.get('/overview', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [
        totalTasks,
        openTasks,
        acceptedTasks,
        submittedTasks,
        verifiedTasks,
        completedTasks,
        totalWorkers,
        recentLogs,
        treasuryBalance,
        treasuryAddress,
      ] = await Promise.all([
        prismaQuery.task.count(),
        prismaQuery.task.count({ where: { status: 'open' } }),
        prismaQuery.task.count({ where: { status: 'accepted' } }),
        prismaQuery.task.count({ where: { status: 'submitted' } }),
        prismaQuery.task.count({ where: { status: 'verified' } }),
        prismaQuery.task.count({ where: { status: 'paid' } }),
        prismaQuery.worker.count(),
        prismaQuery.agentLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
        getTreasuryBalance().catch(() => 0n),
        getTreasuryAddress().catch(() => 'unknown'),
      ])

      // Get Aave + escrow balances (non-blocking)
      let aaveData = { usdt: '0', aaveUsdt: '0', eth: '0' }
      try {
        aaveData = await getTreasuryTokenBalances()
      } catch { /* Aave query failed, use defaults */ }

      // Calculate total in escrow
      const escrowTasks = await prismaQuery.task.findMany({
        where: { status: { in: ['open', 'accepted', 'submitted'] } },
        select: { paymentAmount: true },
      })
      const totalInEscrow = escrowTasks.reduce((sum, t) => sum + BigInt(t.paymentAmount), 0n)

      return reply.send({
        success: true,
        error: null,
        data: {
          stats: {
            totalTasks,
            openTasks,
            completedTasks,
            totalWorkers,
            treasuryBalance: treasuryBalance.toString(),
            treasuryBalanceFormatted: `${Number(treasuryBalance) / 1e6} USDT`,
            treasuryAddress,
          },
          pipeline: {
            open: openTasks,
            accepted: acceptedTasks,
            submitted: submittedTasks,
            verified: verifiedTasks,
            paid: completedTasks,
          },
          treasury: {
            available: aaveData.usdt,
            availableFormatted: `${Number(aaveData.usdt) / 1e6} USDT`,
            inEscrow: totalInEscrow.toString(),
            inEscrowFormatted: `${Number(totalInEscrow) / 1e6} USDT`,
            aaveSupplied: aaveData.aaveUsdt,
            aaveSuppliedFormatted: `${Number(aaveData.aaveUsdt) / 1e6} USDT`,
            eth: aaveData.eth,
            ethFormatted: `${Number(aaveData.eth) / 1e18} ETH`,
          },
          recentLogs,
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get dashboard', 'DASHBOARD_FAILED', error)
    }
  })

  // Pipeline: tasks grouped by status with details
  app.get('/pipeline', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tasks = await prismaQuery.task.findMany({
        where: { status: { in: ['open', 'accepted', 'submitted', 'verified', 'paid'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          description: true,
          paymentAmount: true,
          status: true,
          workerId: true,
          createdAt: true,
        },
      })

      const grouped: Record<string, typeof tasks> = { open: [], accepted: [], submitted: [], verified: [], paid: [] }
      for (const t of tasks) {
        if (grouped[t.status]) grouped[t.status].push(t)
      }

      return reply.send({ success: true, error: null, data: grouped })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get pipeline', 'PIPELINE_FAILED', error)
    }
  })

  // Multi-chain treasury wallets
  app.get('/wallets', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const addresses = await getAllTreasuryAddresses()
      return reply.send({
        success: true,
        error: null,
        data: {
          chains: registeredChains,
          chainCount: registeredChains.length,
          wallets: addresses,
        },
      })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get wallets', 'WALLETS_FAILED', error)
    }
  })

  // Agent logs
  app.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit = '50', action } = request.query as { limit?: string; action?: string }
      const logs = await prismaQuery.agentLog.findMany({
        where: action ? { action } : undefined,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      })
      return reply.send({ success: true, error: null, data: logs })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get logs', 'LOGS_FAILED', error)
    }
  })

  done()
}
