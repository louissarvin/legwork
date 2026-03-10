import cron from 'node-cron'
import { runAgentCycle } from '../lib/agent/core.ts'

let isRunning = false

const agentTask = async (): Promise<void> => {
  if (isRunning) {
    console.log('[AgentWorker] Previous cycle still running, skipping...')
    return
  }

  isRunning = true
  console.log('[AgentWorker] Starting agent cycle...')

  try {
    const result = await runAgentCycle()
    console.log(
      `[AgentWorker] Cycle complete: ${result.iterations} iterations, ${result.decisions.reduce((s, d) => s + d.toolCalls.length, 0)} tool calls`
    )
    if (result.error) {
      console.error(`[AgentWorker] Error: ${result.error}`)
    }
  } catch (error) {
    console.error('[AgentWorker] Fatal error:', error)
  } finally {
    isRunning = false
  }
}

export const startAgentWorker = (): void => {
  console.log('[AgentWorker] Scheduled (every 5 minutes)')
  cron.schedule('*/5 * * * *', agentTask)
  // Run first cycle after 10 seconds (give server time to start)
  setTimeout(agentTask, 10000)
}
