import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { motion } from 'motion/react'
import { useAccount } from 'wagmi'
import { api, type ClientRequest } from '@/lib/api'
import StatCard from '@/components/elements/StatCard'
import Card from '@/components/elements/Card'
import Badge from '@/components/elements/Badge'
import BracketButton from '@/components/elements/BracketButton'
import Footer from '@/components/Footer'
import { formatUsdt, timeAgo } from '@/utils/usdt'
import { FADE_IN_UP, TRANSITION_DEFAULT } from '@/config/animation'
import { Wallet, Send, ClipboardList, DollarSign } from 'lucide-react'

export const Route = createFileRoute('/client')({ component: ClientPage })

function ClientPage() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', address],
    queryFn: () => api.clients.get(address!),
    enabled: !!address,
    retry: false,
  })

  const registerMutation = useMutation({
    mutationFn: () => api.clients.register(address!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', address] }),
  })

  if (!isConnected) {
    return (
      <div className="max-w-[1320px] mx-auto px-6 py-20 text-center">
        <h1 className="font-mono text-2xl font-bold mb-4">
          <span className="text-neon">{'> '}</span>CLIENT_PORTAL
        </h1>
        <p className="text-text-secondary mb-6">Connect your wallet to deposit USDT and request tasks.</p>
        <p className="font-mono text-sm text-text-tertiary">Use the CONNECT_WALLET button in the navbar.</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="max-w-[1320px] mx-auto px-6 py-20 text-center font-mono text-text-secondary">LOADING_CLIENT_PORTAL...</div>
  }

  if (!client) {
    return (
      <div className="max-w-[1320px] mx-auto px-6 py-20 text-center">
        <h1 className="font-mono text-2xl font-bold mb-4">
          <span className="text-neon">{'> '}</span>CLIENT_REGISTRATION
        </h1>
        <p className="text-text-secondary mb-6">Register as a client to fund tasks and hire workers.</p>
        <div className="max-w-xs mx-auto">
          <BracketButton onClick={() => registerMutation.mutate()}>
            {registerMutation.isPending ? 'REGISTERING...' : 'REGISTER_CLIENT'}
          </BracketButton>
        </div>
        {registerMutation.isError && (
          <p className="font-mono text-sm text-danger mt-4">{registerMutation.error.message}</p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-[1320px] mx-auto px-6">
      <div className="mt-8 mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          <span className="text-neon font-mono">{'> '}</span>
          CLIENT_PORTAL
        </h1>
        <p className="text-sm text-text-secondary">Fund tasks, track requests, receive verified results.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="AVAILABLE_BALANCE" value={`$${formatUsdt(client.balance)}`} icon={<Wallet size={16} />} />
        <StatCard label="TOTAL_DEPOSITED" value={`$${formatUsdt(client.totalDeposited)}`} icon={<DollarSign size={16} />} />
        <StatCard label="TOTAL_SPENT" value={`$${formatUsdt(client.totalSpent)}`} icon={<Send size={16} />} />
        <StatCard
          label="ACTIVE_REQUESTS"
          value={String(client.requests?.filter(r => r.status === 'pending' || r.status === 'active').length || 0)}
          icon={<ClipboardList size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DepositForm walletAddress={address!} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['client', address] })} />
        <RequestForm walletAddress={address!} balance={client.balance} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['client', address] })} />
      </div>

      {/* Client requests */}
      <div className="mb-16">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          TASK_REQUESTS
          <span className="font-mono text-xs text-text-tertiary">YOUR_FUNDED_OPERATIONS</span>
        </h2>

        {!client.requests?.length ? (
          <Card><div className="text-center py-8 font-mono text-text-tertiary text-sm">NO_REQUESTS_YET</div></Card>
        ) : (
          <div className="space-y-3">
            {client.requests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <RequestCard request={req} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}

function DepositForm({ walletAddress, onSuccess }: { walletAddress: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const baseUnits = String(Math.round(parseFloat(amount) * 1e6))
      return api.clients.deposit(walletAddress, baseUnits)
    },
    onSuccess: () => { setAmount(''); onSuccess() },
  })

  return (
    <motion.div {...FADE_IN_UP} transition={TRANSITION_DEFAULT}>
      <Card>
        <h3 className="font-mono text-sm font-semibold mb-4">{'> '}DEPOSIT_USDT</h3>
        <p className="text-xs text-text-secondary mb-4">
          Fund your account to create task requests. The agent will execute tasks from your budget.
        </p>
        <div className="flex gap-3 mb-3">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount in USDT"
            className="flex-1 px-4 py-3 bg-input border border-border-subtle rounded font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border"
          />
        </div>
        <div className="flex gap-2 mb-4">
          {[10, 50, 100, 500].map(v => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="px-3 py-1.5 border border-border-medium rounded font-mono text-xs text-text-secondary hover:border-neon-border hover:text-neon cursor-pointer transition-colors duration-100"
            >
              ${v}
            </button>
          ))}
        </div>
        <BracketButton
          onClick={() => mutation.mutate()}
          disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending}
        >
          {mutation.isPending ? 'PROCESSING...' : 'DEPOSIT_FUNDS'}
        </BracketButton>
        {mutation.isError && <p className="font-mono text-xs text-danger mt-2">{mutation.error.message}</p>}
        {mutation.isSuccess && <p className="font-mono text-xs text-neon mt-2">DEPOSIT_CONFIRMED</p>}
      </Card>
    </motion.div>
  )
}

function RequestForm({ walletAddress, balance, onSuccess }: { walletAddress: string; balance: string; onSuccess: () => void }) {
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('photo')
  const [budget, setBudget] = useState('')
  const [count, setCount] = useState('5')
  const [address, setAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [minDuration, setMinDuration] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.clients.request({
        walletAddress,
        description: desc,
        category,
        budget: String(Math.round(parseFloat(budget) * 1e6)),
        tasksRequested: parseInt(count) || 1,
        targetAddress: address || undefined,
      }),
    onSuccess: () => { setDesc(''); setBudget(''); setAddress(''); onSuccess() },
  })

  const categoryConfig: Record<string, { label: string; placeholder: string; hint: string; validation: string; locationPlaceholder: string }> = {
    photo: {
      label: 'PHOTO',
      placeholder: 'e.g., Photograph 5 coffee shop storefronts showing their signs and entrance',
      hint: 'Workers take photos of locations, products, or conditions.',
      validation: 'Photo + GPS geofence + AI Vision analysis',
      locationPlaceholder: 'Location to photograph (e.g., Kopi Klan Ciheulet, Bogor)',
    },
    delivery: {
      label: 'DELIVERY',
      placeholder: 'e.g., Pick up package from warehouse A and deliver to office B, photograph both locations',
      hint: 'Workers pick up and deliver items between two locations.',
      validation: 'Dual GPS: pickup checkpoint + dropoff checkpoint + delivery photo',
      locationPlaceholder: 'Pickup location (e.g., Warehouse A, Jl. Sudirman No. 5)',
    },
    check: {
      label: 'CHECK',
      placeholder: 'e.g., Visit 3 pharmacies and verify they are open, photograph the entrance with hours visible',
      hint: 'Workers verify a location is open, accessible, or meets conditions.',
      validation: 'Photo + GPS + status report (open/closed/limited)',
      locationPlaceholder: 'Location to check (e.g., Pharmacy XYZ, Mall Botani Square)',
    },
    data: {
      label: 'DATA',
      placeholder: 'e.g., Count the number of parked cars in the shopping mall lot, photograph each section',
      hint: 'Workers collect counts, measurements, or readings at a location.',
      validation: 'Photo + GPS + numeric count + data notes',
      locationPlaceholder: 'Data collection site (e.g., Parking lot, Mall Botani Square)',
    },
    mystery: {
      label: 'MYSTERY',
      placeholder: 'e.g., Visit the restaurant as a customer, order a coffee, and photograph the menu and seating area',
      hint: 'Workers visit as anonymous customers and evaluate the experience.',
      validation: 'Discreet photo + GPS + written experience report',
      locationPlaceholder: 'Business to visit (e.g., Restaurant ABC, Jl. Pajajaran)',
    },
    event: {
      label: 'EVENT',
      placeholder: 'e.g., Attend the local market and document the crowd size and vendor count with photos',
      hint: 'Workers attend events and document with photos.',
      validation: 'GPS check-in/check-out + duration tracking + crowd level + event photo',
      locationPlaceholder: 'Event location (e.g., Pasar Bogor, Lapangan Sempur)',
    },
  }

  const categories = Object.keys(categoryConfig)
  const currentCategory = categoryConfig[category]

  return (
    <motion.div {...FADE_IN_UP} transition={{ ...TRANSITION_DEFAULT, delay: 0.08 }}>
      <Card>
        <h3 className="font-mono text-sm font-semibold mb-4">{'> '}REQUEST_TASKS</h3>
        <p className="text-xs text-text-secondary mb-4">
          Describe what you need. The agent calculates pricing and creates individual tasks from your budget.
        </p>
        <div className="space-y-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => { setCategory(c); setDesc('') }}
                className={`px-3 py-1.5 border rounded font-mono text-xs uppercase cursor-pointer transition-colors duration-100 ${
                  category === c
                    ? 'border-neon-border text-neon bg-neon-dim'
                    : 'border-border-medium text-text-secondary hover:border-text-secondary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="bg-elevated rounded p-3 space-y-1.5">
            <div className="font-mono text-[10px] text-text-secondary">{currentCategory.hint}</div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-text-tertiary uppercase">VALIDATION:</span>
              <span className="font-mono text-[10px] text-neon">{currentCategory.validation}</span>
            </div>
          </div>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder={currentCategory.placeholder}
            rows={3}
            className="w-full px-4 py-3 bg-input border border-border-subtle rounded font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border resize-none"
          />
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder={currentCategory.locationPlaceholder}
            className="w-full px-4 py-3 bg-input border border-border-subtle rounded font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border"
          />
          {category === 'delivery' && (
            <input
              type="text"
              value={dropoffAddress}
              onChange={e => setDropoffAddress(e.target.value)}
              placeholder="Dropoff / delivery destination (e.g., Office B, Jl. Merdeka No. 10)"
              className="w-full px-4 py-3 bg-input border border-border-subtle rounded font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border"
            />
          )}
          {category === 'event' && (
            <input
              type="number"
              value={minDuration}
              onChange={e => setMinDuration(e.target.value)}
              placeholder="Minimum attendance duration in minutes (e.g., 30)"
              className="w-full px-4 py-3 bg-input border border-border-subtle rounded font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border"
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="Total budget (USDT)"
              className="px-4 py-3 bg-input border border-border-subtle rounded font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border"
            />
            <input
              type="number"
              value={count}
              onChange={e => setCount(e.target.value)}
              placeholder="Tasks count"
              className="px-4 py-3 bg-input border border-border-subtle rounded font-mono text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-neon-border"
            />
          </div>
          <div className="font-mono text-xs text-text-tertiary">
            Available: ${formatUsdt(balance)} USDT
            {budget && count && parseFloat(budget) > 0 && parseInt(count) > 0 && (
              <span className="text-neon"> | Per task: ${(parseFloat(budget) / parseInt(count)).toFixed(2)} USDT</span>
            )}
          </div>
        </div>
        <BracketButton
          onClick={() => mutation.mutate()}
          disabled={!desc || !budget || parseFloat(budget) <= 0 || mutation.isPending}
        >
          {mutation.isPending ? 'SUBMITTING...' : 'SUBMIT_REQUEST'}
        </BracketButton>
        {mutation.isError && <p className="font-mono text-xs text-danger mt-2">{mutation.error.message}</p>}
        {mutation.isSuccess && <p className="font-mono text-xs text-neon mt-2">REQUEST_SUBMITTED. Agent will process in next cycle.</p>}
      </Card>
    </motion.div>
  )
}

function RequestCard({ request: req }: { request: ClientRequest }) {
  const statusVariant: Record<string, 'open' | 'accepted' | 'paid' | 'expired' | 'pending'> = {
    pending: 'pending',
    active: 'accepted',
    completed: 'paid',
    cancelled: 'expired',
    insufficient_funds: 'expired',
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={statusVariant[req.status] || 'default'}>
              {req.status.toUpperCase()}
            </Badge>
            <Badge variant="default">{req.category.toUpperCase()}</Badge>
            <span className="font-mono text-[10px] text-text-tertiary">{timeAgo(req.createdAt)}</span>
          </div>
          <p className="text-sm mb-2">{req.description}</p>
          <div className="flex items-center gap-4 font-mono text-xs text-text-secondary">
            <span>Budget: <span className="text-neon">${formatUsdt(req.budget)}</span></span>
            <span>Tasks: {req.tasksCreated}/{req.tasksRequested}</span>
            {req.tasksCompleted > 0 && (
              <span>Completed: <span className="text-neon">{req.tasksCompleted}</span></span>
            )}
            {req.pricePerTask && <span>Per task: ${formatUsdt(req.pricePerTask)}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-neon">${formatUsdt(req.budget)}</div>
          <div className="font-mono text-[10px] text-text-tertiary">BUDGET</div>
        </div>
      </div>
      {req.tasksCreated > 0 && (
        <div className="mt-3 h-1.5 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-neon rounded-full transition-all duration-500"
            style={{ width: `${(req.tasksCompleted / req.tasksRequested) * 100}%` }}
          />
        </div>
      )}
    </Card>
  )
}
