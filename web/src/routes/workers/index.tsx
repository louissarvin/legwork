import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { api } from '@/lib/api'
import Card from '@/components/elements/Card'
import Badge from '@/components/elements/Badge'
import Footer from '@/components/Footer'
import { formatUsdt, shortenAddress } from '@/utils/usdt'
import { Users } from 'lucide-react'

export const Route = createFileRoute('/workers/')({ component: WorkersPage })

function WorkersPage() {
  const { data: workers, isLoading } = useQuery({
    queryKey: ['workers-list'],
    queryFn: api.workers.list,
  })

  return (
    <div className="max-w-[1320px] mx-auto px-6">
      <div className="mt-8 mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          <span className="text-neon font-mono">{'> '}</span>
          WORKER_REGISTRY
        </h1>
        <p className="text-sm text-text-secondary">All verified operatives in the network.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 font-mono text-text-secondary">LOADING_REGISTRY...</div>
      ) : !workers?.length ? (
        <div className="text-center py-20 font-mono text-text-secondary">NO_WORKERS_REGISTERED</div>
      ) : (
        <div className="space-y-3 mb-16">
          {workers.map((worker, i) => (
            <motion.div
              key={worker.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              <Link to="/workers/$workerId" params={{ workerId: worker.id }} className="no-underline">
                <Card interactive className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-border-medium rounded-lg flex items-center justify-center">
                      <Users size={16} className="text-neon" />
                    </div>
                    <div>
                      <div className="font-semibold">{worker.name || 'Anonymous Worker'}</div>
                      <div className="font-mono text-xs text-text-secondary">
                        {worker.walletAddress ? shortenAddress(worker.walletAddress) : 'No wallet'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-wrap gap-1.5">
                      {worker.tasksCompleted > 0 && (
                        <Badge variant="open">{worker.tasksCompleted} TASKS</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-neon">${formatUsdt(worker.totalEarned)}</div>
                      <div className="font-mono text-[10px] text-text-tertiary">EARNED</div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-2 border-neon flex items-center justify-center">
                      <span className="font-mono text-sm font-bold">{Math.round(worker.reputationScore)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <Footer />
    </div>
  )
}
