import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { api, type AgentLog, type PipelineTask } from '@/lib/api'
import StatCard from '@/components/elements/StatCard'
import Card from '@/components/elements/Card'
import Badge from '@/components/elements/Badge'
import BracketButton from '@/components/elements/BracketButton'
import ExplorerLink from '@/components/elements/ExplorerLink'
import Footer from '@/components/Footer'
import { formatUsdt } from '@/utils/usdt'
import { cnm } from '@/utils/style'
import { Wallet, ListTodo, CheckCircle2, Users, Zap, DollarSign } from 'lucide-react'

export const Route = createFileRoute('/dashboard')({ component: DashboardPage })

function DashboardPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: api.dashboard.overview,
    refetchInterval: 10_000,
  })

  const { data: logs } = useQuery({
    queryKey: ['agent-activity'],
    queryFn: () => api.agent.activity(50),
    refetchInterval: 5_000,
  })

  const { data: pipelineData } = useQuery({
    queryKey: ['dashboard-pipeline'],
    queryFn: api.dashboard.pipeline,
    refetchInterval: 10_000,
  })

  const { data: walletsData } = useQuery({
    queryKey: ['dashboard-wallets'],
    queryFn: api.dashboard.wallets,
    staleTime: 60_000,
  })

  const agentMutation = useMutation({
    mutationFn: () => api.agent.run(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-activity'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-pipeline'] })
    },
  })

  const stats = data?.stats
  const pipeline = data?.pipeline
  const treasury = data?.treasury
  const t402Revenue = parseT402Revenue(logs)

  if (isLoading) {
    return <div className="max-w-[1320px] mx-auto px-6 py-20 text-center font-mono text-text-secondary">INITIALIZING_COMMAND_CENTER...</div>
  }

  return (
    <div className="max-w-[1320px] mx-auto px-6">
      {/* Header + Agent trigger */}
      <div className="flex items-center justify-between mt-8 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-neon font-mono">{'> '}</span>COMMAND_CENTER
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {agentMutation.isPending && (
            <span className="font-mono text-xs text-yellow-accent animate-pulse">AGENT_THINKING...</span>
          )}
          {agentMutation.isSuccess && (
            <span className="font-mono text-xs text-neon">CYCLE_COMPLETE</span>
          )}
          <BracketButton
            onClick={() => agentMutation.mutate()}
            disabled={agentMutation.isPending}
            className="!w-auto !py-2 !px-4 !text-xs"
          >
            {agentMutation.isPending ? 'RUNNING...' : 'RUN_AGENT_CYCLE'}
          </BracketButton>
        </div>
      </div>

      {agentMutation.isError && (
        <div className="mb-4 p-3 border border-danger rounded font-mono text-xs text-danger bg-danger-dim">
          Agent error: {agentMutation.error.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="TREASURY_BALANCE" value={stats ? `$${formatUsdt(stats.treasuryBalance)}` : '---'} icon={<Wallet size={16} />} />
        <StatCard label="OPEN_TASKS" value={stats ? String(stats.openTasks) : '---'} icon={<ListTodo size={16} />} />
        <StatCard label="TASKS_COMPLETED" value={stats ? String(stats.completedTasks) : '---'} icon={<CheckCircle2 size={16} />} />
        <StatCard label="ACTIVE_WORKERS" value={stats ? String(stats.totalWorkers) : '---'} icon={<Users size={16} />} />
        <StatCard label="API_REVENUE" value={`$${t402Revenue.total.toFixed(2)}`} delta={t402Revenue.calls > 0 ? `${t402Revenue.calls} calls` : undefined} icon={<Zap size={16} />} />
        <StatCard label="IN_ESCROW" value={treasury ? `$${formatUsdt(treasury.inEscrow)}` : '---'} icon={<DollarSign size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 mb-8">
        {/* Agent Activity Log */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-base font-semibold flex items-center gap-2">
                <span className="text-neon">{'>'}</span> AGENT_ACTIVITY_LOG
              </h2>
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 bg-neon rounded-sm" />
                <span className="w-2.5 h-2.5 bg-yellow-accent rounded-sm" />
                <span className="w-2.5 h-2.5 bg-danger rounded-sm" />
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-0 font-mono text-[13px] leading-8">
              {logs?.map((log) => <LogEntry key={log.id} log={log} />) || (
                <div className="text-text-tertiary">NO_LOGS_AVAILABLE</div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Right column */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="space-y-4">
          {/* Treasury Management - REAL DATA */}
          <Card>
            <h2 className="font-semibold mb-4">TREASURY_MANAGEMENT</h2>
            <div className="flex items-center gap-6 mb-6">
              <div className="w-28 h-28 rounded-full border-[6px] border-neon relative">
                <div className="absolute inset-0 rounded-full border-[6px] border-yellow-accent border-t-transparent border-l-transparent rotate-45" />
              </div>
              <div className="space-y-2 font-mono text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-neon rounded-sm" />
                  <span className="text-text-secondary">AVAILABLE: {treasury?.availableFormatted || '---'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-yellow-accent rounded-sm" />
                  <span className="text-text-secondary">IN_ESCROW: {treasury?.inEscrowFormatted || '---'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-elevated rounded-sm border border-border-medium" />
                  <span className="text-text-secondary">AAVE_YIELD: {treasury?.aaveSuppliedFormatted || '---'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-yellow-accent rounded-sm opacity-60" />
                  <span className="text-text-secondary">XAU₮_RESERVE: 0.00 XAU₮</span>
                </div>
              </div>
            </div>
            {/* Aave + XAU₮ modules */}
            <Card className="!p-4 !bg-elevated mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs text-neon font-semibold">AAVE_YIELD_MODULE</span>
                <Badge variant="open">LIVE</Badge>
              </div>
              <div className="flex items-center justify-between font-mono text-sm text-text-secondary">
                <span>Supplied: <span className="text-text-primary">{treasury?.aaveSuppliedFormatted || '$0.00'}</span></span>
                <span>Gas: <span className="text-text-primary">{treasury?.ethFormatted || '0 ETH'}</span></span>
              </div>
            </Card>
            <Card className="!p-4 !bg-elevated">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs text-yellow-accent font-semibold">XAU₮_GOLD_RESERVE</span>
                <Badge variant="accepted">MAINNET</Badge>
              </div>
              <div className="flex items-center justify-between font-mono text-sm text-text-secondary">
                <span>Balance: <span className="text-text-primary">0.00 XAU₮</span></span>
                <span>~$0 USD</span>
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-1">Tether Gold. 1 XAU₮ = 1 troy oz physical gold. Treasury inflation hedge.</div>
            </Card>
          </Card>

          {/* t402 Revenue */}
          <Card>
            <h2 className="font-semibold mb-4 flex items-center gap-2">T402_API_REVENUE <Badge variant="open">LIVE</Badge></h2>
            <div className="space-y-3 font-mono text-sm">
              {Object.entries(t402Revenue.byEndpoint).map(([ep, data]) => (
                <div key={ep} className="flex items-center justify-between text-text-secondary">
                  <span className="truncate">{ep.split('/').slice(-1)[0]}</span>
                  <span className="text-neon shrink-0">{data.calls} / ${data.revenue.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-border-subtle pt-2 flex items-center justify-between">
                <span className="font-semibold text-text-primary">TOTAL</span>
                <span className="text-neon font-bold">${t402Revenue.total.toFixed(2)} USDT</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Agent Reasoning Panel + Multi-Chain Wallets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Agent Latest Reasoning */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center gap-2">AGENT_REASONING <Badge variant="open">LATEST</Badge></h2>
          {(() => {
            const thinkLog = logs?.find(l => l.action === 'think')
            if (!thinkLog) return <div className="font-mono text-xs text-text-tertiary py-4">No reasoning logged yet. Click RUN_AGENT_CYCLE to generate.</div>
            try {
              const d = JSON.parse(thinkLog.details)
              return (
                <div className="font-mono text-xs text-text-secondary leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {d.reasoning || d.message || thinkLog.details}
                </div>
              )
            } catch { return <div className="font-mono text-xs text-text-secondary">{thinkLog.details.slice(0, 500)}</div> }
          })()}
        </Card>

        {/* Multi-Chain Wallets */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            MULTI_CHAIN_TREASURY
            {walletsData && <Badge variant="open">{walletsData.chainCount} CHAINS</Badge>}
          </h2>
          {walletsData ? (
            <div className="space-y-2 font-mono text-xs">
              {Object.entries(walletsData.wallets).map(([chain, addr]) => (
                <div key={chain} className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary uppercase">{chain.replace('-', ' ')}</span>
                  <span className="text-neon truncate max-w-[200px]">{addr}</span>
                </div>
              ))}
              <div className="border-t border-border-subtle pt-2 mt-2 text-text-tertiary">
                All wallets derived from single WDK seed. Self-custodial across {walletsData.chainCount} chains.
              </div>
            </div>
          ) : (
            <div className="font-mono text-xs text-text-tertiary py-4">Loading wallets...</div>
          )}
        </Card>
      </div>

      {/* Task Pipeline - REAL DATA */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-bold text-lg">TASK_PIPELINE</h2>
          <span className="font-mono text-xs text-text-tertiary">REAL_TIME_ORCHESTRATION</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['open', 'accepted', 'submitted', 'verified', 'paid'] as const).map((lane) => {
            const count = pipeline?.[lane] || 0
            const tasks = pipelineData?.[lane] || []
            return (
              <Card key={lane} className="!p-4 min-h-[160px]">
                <span className="font-mono text-[10px] text-text-tertiary uppercase block mb-3">
                  {lane.toUpperCase()} ({count})
                </span>
                {tasks.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.slice(0, 4).map((t: PipelineTask) => (
                      <div key={t.id} className="border border-border-subtle rounded p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-neon">${formatUsdt(t.paymentAmount)}</span>
                          <span className="font-mono text-[9px] text-text-tertiary">#{t.id.slice(-4)}</span>
                        </div>
                        <div className="font-mono text-[10px] text-text-secondary truncate mt-0.5">{t.description?.slice(0, 30)}</div>
                      </div>
                    ))}
                    {tasks.length > 4 && <div className="font-mono text-[10px] text-text-tertiary text-center">+{tasks.length - 4} more</div>}
                  </div>
                ) : (
                  <div className="text-text-tertiary font-mono text-xs text-center py-4">---</div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      <Footer />
    </div>
  )
}

function parseT402Revenue(logs?: AgentLog[]) {
  const result = { total: 0, calls: 0, byEndpoint: {} as Record<string, { calls: number; revenue: number }> }
  if (!logs) return result
  for (const log of logs) {
    try {
      const d = JSON.parse(log.details)
      if (d.type === 't402_payment_received' && d.revenue) {
        result.total += d.revenue
        result.calls++
        const ep = d.endpoint || 'unknown'
        if (!result.byEndpoint[ep]) result.byEndpoint[ep] = { calls: 0, revenue: 0 }
        result.byEndpoint[ep].calls++
        result.byEndpoint[ep].revenue += d.revenue
      }
    } catch { /* skip */ }
  }
  return result
}

function LogEntry({ log }: { log: AgentLog }) {
  const time = new Date(log.createdAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  let parsed: Record<string, unknown> = {}
  try { parsed = JSON.parse(log.details) } catch { parsed = { message: log.details } }

  const type = parsed.type as string
  let displayText = ''
  if (type === 'client_deposit') displayText = `CLIENT DEPOSIT: ${parsed.amountFormatted}`
  else if (type === 'client_request_received') displayText = `CLIENT REQUEST: "${(parsed.description as string)?.slice(0, 50)}" (${parsed.budget})`
  else if (type === 't402_payment_received') displayText = `T402 REVENUE: $${parsed.revenue} from ${parsed.endpoint}`
  else if (type === 'task_created') displayText = `TASK CREATED: ${parsed.amount ? `${Number(parsed.amount as string) / 1e6} USDT` : ''} escrow locked`
  else if (type === 'payout_released') displayText = `PAYOUT: ${Number(parsed.workerPayout as string) / 1e6} USDT to worker`
  else if (type === 'verification_complete') displayText = `VERIFIED: score ${parsed.score}/100 ${parsed.passed ? 'PASSED' : 'FAILED'}`
  else if (parsed.tool) displayText = `${parsed.tool}${parsed.isError ? ' FAILED' : ''}`
  else if (parsed.reasoning) displayText = (parsed.reasoning as string).slice(0, 100)
  else displayText = JSON.stringify(parsed).slice(0, 100)

  // Tx hash from log (for Etherscan link)
  const txHash = log.txHash || (parsed.workerTxHash as string) || (parsed.escrowTxHash as string) || (parsed.refundTxHash as string) || null

  const colorClass = { think: 'text-text-secondary', execute: 'text-neon', decide: 'text-yellow-accent', error: 'text-danger', observe: 'text-text-secondary' }[log.action] || 'text-text-secondary'

  return (
    <div className="flex items-start gap-3">
      <span className="text-text-tertiary shrink-0">{time}</span>
      <span className={cnm(colorClass, 'break-all')}>
        [{log.action.toUpperCase()}] {displayText}
        {txHash && <> <ExplorerLink type="tx" value={txHash} className="!text-xs" /></>}
      </span>
    </div>
  )
}
