import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify'
import { runAgentCycle } from '../lib/agent/core.ts'
import { prismaQuery } from '../lib/prisma.ts'
import { handleError } from '../utils/errorHandler.ts'

// Admin API key for agent control endpoints
const ADMIN_KEY = process.env.AGENT_ADMIN_KEY || process.env.JWT_SECRET || ''

// Rate limiting: prevent triggering agent too frequently
let lastRunTime = 0
const MIN_RUN_INTERVAL_MS = 30_000 // 30 seconds between manual triggers

function verifyAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  // Check admin key from header or query
  const key = request.headers['x-admin-key'] as string ||
    request.headers['authorization']?.replace('Bearer ', '') ||
    (request.query as { adminKey?: string })?.adminKey

  // In development, allow without key if AGENT_ADMIN_KEY is not set
  if (!process.env.AGENT_ADMIN_KEY) return true

  if (!key || key !== ADMIN_KEY) {
    handleError(reply, 403, 'Admin access required. Set x-admin-key header.', 'ADMIN_REQUIRED')
    return false
  }
  return true
}

export const agentRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  // Manually trigger an agent cycle (admin only, rate limited)
  app.post('/run', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifyAdmin(request, reply)) return

    // Rate limiting
    const now = Date.now()
    if (now - lastRunTime < MIN_RUN_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_RUN_INTERVAL_MS - (now - lastRunTime)) / 1000)
      return handleError(reply, 429, `Agent cycle rate limited. Wait ${waitSec}s.`, 'AGENT_RATE_LIMITED')
    }
    lastRunTime = now

    try {
      const result = await runAgentCycle()
      return reply.send({ success: true, error: null, data: result })
    } catch (error) {
      return handleError(reply, 500, 'Agent cycle failed', 'AGENT_RUN_FAILED', error)
    }
  })

  // Get recent agent activity (public read, no auth needed)
  app.get('/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit = '50' } = request.query as { limit?: string }
      const logs = await prismaQuery.agentLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit) || 50, 200),
      })
      return reply.send({ success: true, error: null, data: logs })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get activity', 'AGENT_ACTIVITY_FAILED', error)
    }
  })

  // Get agent reasoning (public read)
  app.get('/reasoning', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit = '10' } = request.query as { limit?: string }
      const reasoning = await prismaQuery.agentLog.findMany({
        where: { action: 'think' },
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit) || 10, 50),
      })
      return reply.send({ success: true, error: null, data: reasoning })
    } catch (error) {
      return handleError(reply, 500, 'Failed to get reasoning', 'AGENT_REASONING_FAILED', error)
    }
  })

  done()
}
