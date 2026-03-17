import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatUsdt } from '@/utils/usdt'
import { config } from '@/config'

export default function StatusBar() {
  const { data } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: api.dashboard.overview,
    refetchInterval: 30_000,
    retry: false,
  })

  const balance = data?.stats?.treasuryBalance
    ? formatUsdt(data.stats.treasuryBalance)
    : '---'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-8 bg-surface border-t border-border-subtle flex items-center justify-between px-6 font-mono text-[11px] text-text-secondary">
      <div className="flex items-center gap-4">
        <span>
          GLOBAL_UPTIME <span className="text-neon">99.998%</span>
        </span>
        <span className="text-text-tertiary">|</span>
        <span>
          ACTIVE_ESCROW <span className="text-neon">${balance} USDT</span>
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <span>LATENCY: 14MS</span>
        <span className="text-text-tertiary">|</span>
        <span>BLOCK_SYNC: 100%</span>
        <span className="text-text-tertiary">|</span>
        <span>{config.platform.version.toUpperCase()}</span>
      </div>
    </div>
  )
}
