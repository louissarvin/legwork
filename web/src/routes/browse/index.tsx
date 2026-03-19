import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { motion } from 'motion/react'
import { api, type Task } from '@/lib/api'
import Badge from '@/components/elements/Badge'
import BracketButton from '@/components/elements/BracketButton'
import Card from '@/components/elements/Card'
import Footer from '@/components/Footer'
import { formatUsdt, timeLeft } from '@/utils/usdt'
import { cnm } from '@/utils/style'
import { Camera, Package, MapPin, BarChart3, Search, Eye } from 'lucide-react'

export const Route = createFileRoute('/browse/')({ component: BrowsePage })

const CATEGORIES = ['ALL', 'PHOTO', 'DELIVERY', 'LOCATION_CHECK', 'DATA_COLLECTION', 'MYSTERY_SHOPPING'] as const

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  photo: <Camera size={18} />,
  delivery: <Package size={18} />,
  location_check: <MapPin size={18} />,
  check: <MapPin size={18} />,
  data: <BarChart3 size={18} />,
  data_collection: <BarChart3 size={18} />,
  mystery: <Search size={18} />,
  mystery_shopping: <Search size={18} />,
  event: <Eye size={18} />,
}

function getStatusBadgeVariant(status: Task['status']) {
  const map: Record<string, 'open' | 'accepted' | 'paid' | 'expired' | 'rejected' | 'pending'> = {
    open: 'open',
    accepted: 'accepted',
    submitted: 'pending',
    verified: 'paid',
    paid: 'paid',
    expired: 'expired',
    rejected: 'rejected',
  }
  return map[status] || 'default'
}

function BrowsePage() {
  const [activeCategory, setActiveCategory] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks-list'],
    queryFn: api.tasks.list,
    refetchInterval: 15_000,
  })

  const filtered = tasks?.filter((t) => {
    const matchesCategory = activeCategory === 'ALL' || t.category.toUpperCase().replace(/\s+/g, '_') === activeCategory
    const matchesSearch = !searchQuery || t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.addressApprox || t.address || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="max-w-[1320px] mx-auto px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-8 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            <span className="text-neon font-mono">{'> '}</span>
            AVAILABLE_MISSIONS
          </h1>
          <p className="text-sm text-text-secondary">Select a directive and secure the bounty.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-input border border-border-subtle rounded px-3 py-2.5">
            <Search size={14} className="text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="SEARCH_TERMINAL..."
              className="bg-transparent border-none outline-none font-mono text-sm text-text-primary placeholder:text-text-tertiary placeholder:uppercase w-40"
            />
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cnm(
              'px-3.5 py-1.5 border rounded font-mono text-xs tracking-wide uppercase cursor-pointer transition-all duration-100',
              activeCategory === cat
                ? 'border-neon-border text-neon bg-neon-dim'
                : 'border-border-medium text-text-secondary bg-transparent hover:border-text-secondary',
            )}
          >
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Task grid */}
      {isLoading ? (
        <div className="text-center py-20 font-mono text-text-secondary">LOADING_MISSIONS...</div>
      ) : !filtered?.length ? (
        <div className="text-center py-20 font-mono text-text-secondary">NO_MISSIONS_AVAILABLE</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {filtered.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <TaskCard task={task} />
            </motion.div>
          ))}
        </div>
      )}

      <Footer />
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const deadline = timeLeft(task.deadline)
  const isExpired = deadline === 'Expired'

  return (
    <Card interactive className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 border border-border-medium rounded-lg flex items-center justify-center text-text-secondary">
          {CATEGORY_ICONS[task.category.toLowerCase()] || <ClipboardList size={18} />}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={getStatusBadgeVariant(task.status)}>
            STATUS: {task.status.toUpperCase()}
          </Badge>
          {task.escrowTxHash && <Badge variant="escrow">ESCROW_VERIFIED</Badge>}
        </div>
      </div>

      <h3 className="font-medium text-base leading-snug line-clamp-2">{task.description}</h3>

      <div className="font-mono text-3xl font-bold text-neon tracking-tight">
        ${formatUsdt(task.paymentAmount)} USDT
      </div>

      <div className="space-y-1 text-sm text-text-secondary">
        {(task.addressApprox || task.address) && (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} />
            {task.addressApprox || task.address}
            {task.addressApprox && <span className="text-text-tertiary text-[10px]">(approx)</span>}
          </div>
        )}
        <div className={cnm('flex items-center gap-1.5 font-mono text-xs', isExpired ? 'text-danger' : 'text-yellow-accent')}>
          {isExpired ? 'WINDOW_CLOSED' : deadline}
        </div>
        {task.category === 'delivery' && (
          <div className="font-mono text-[10px] text-yellow-accent">TRUSTED_ONLY: Reputation {'>='}  5 required</div>
        )}
      </div>

      {task.status === 'open' ? (
        <Link to="/browse/$taskId" params={{ taskId: task.id }} className="no-underline mt-auto">
          <BracketButton>ACCEPT_TASK</BracketButton>
        </Link>
      ) : task.status === 'accepted' ? (
        <BracketButton variant="disabled">MISSION_IN_PROGRESS</BracketButton>
      ) : isExpired ? (
        <BracketButton variant="disabled">TERMINATED</BracketButton>
      ) : (
        <Link to="/browse/$taskId" params={{ taskId: task.id }} className="no-underline mt-auto">
          <BracketButton variant="secondary">VIEW_DETAILS</BracketButton>
        </Link>
      )}
    </Card>
  )
}

function ClipboardList({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
    </svg>
  )
}
