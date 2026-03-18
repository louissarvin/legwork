import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { motion } from 'motion/react'
import { useAccount } from 'wagmi'
import { api, type Worker } from '@/lib/api'
import StatCard from '@/components/elements/StatCard'
import Card from '@/components/elements/Card'
import Badge from '@/components/elements/Badge'
import BracketButton from '@/components/elements/BracketButton'
import Footer from '@/components/Footer'
import { formatUsdt, timeLeft } from '@/utils/usdt'
import { cnm } from '@/utils/style'
import { FADE_IN_UP, TRANSITION_DEFAULT } from '@/config/animation'
import { Wallet, DollarSign, CheckCircle2, Zap, MapPin } from 'lucide-react'

export const Route = createFileRoute('/worker')({ component: WorkerPortalPage })

function WorkerPortalPage() {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()

  // Try to find existing worker by wallet address
  const { data: worker, isLoading, error } = useQuery({
    queryKey: ['worker-by-wallet', address],
    queryFn: () => api.workers.getByWallet(address!),
    enabled: !!address,
    retry: false,
  })

  const registerMutation = useMutation({
    mutationFn: () => api.workers.register(address),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker-by-wallet', address] }),
  })

  // Not connected
  if (!isConnected) {
    return (
      <div className="max-w-[1320px] mx-auto px-6 py-20 text-center">
        <h1 className="font-mono text-2xl font-bold mb-4">
          <span className="text-neon">{'> '}</span>WORKER_PORTAL
        </h1>
        <p className="text-text-secondary mb-6">Connect your wallet to register as a worker and start earning USDT.</p>
        <p className="font-mono text-sm text-text-tertiary">Use the CONNECT_WALLET button in the navbar.</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="max-w-[1320px] mx-auto px-6 py-20 text-center font-mono text-text-secondary">LOADING_WORKER_PROFILE...</div>
  }

  // Not registered: show registration
  if (!worker || error) {
    return (
      <div className="max-w-[1320px] mx-auto px-6 py-20 text-center">
        <h1 className="font-mono text-2xl font-bold mb-4">
          <span className="text-neon">{'> '}</span>WORKER_REGISTRATION
        </h1>
        <p className="text-text-secondary mb-2">Register to start accepting tasks and earning USDT.</p>
        <p className="font-mono text-xs text-text-tertiary mb-6">A gasless ERC-4337 wallet will be created for you via Tether WDK.</p>
        <div className="max-w-xs mx-auto">
          <BracketButton onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'CREATING_WALLET...' : 'REGISTER_AS_WORKER'}
          </BracketButton>
        </div>
        {registerMutation.isSuccess && registerMutation.data && (
          <motion.div {...FADE_IN_UP} transition={TRANSITION_DEFAULT} className="mt-6 max-w-md mx-auto text-left">
            <Card active>
              <div className="font-mono text-sm text-neon mb-2">REGISTRATION_COMPLETE</div>
              <div className="font-mono text-xs text-text-secondary space-y-1">
                <div>Worker ID: <span className="text-text-primary">{registerMutation.data.worker.id}</span></div>
                <div>Wallet: <span className="text-text-primary">{registerMutation.data.wallet.address}</span></div>
              </div>
              {registerMutation.data.wallet.seedPhrase && (
                <div className="mt-3 p-3 bg-elevated rounded border border-yellow-border">
                  <div className="font-mono text-[10px] text-yellow-accent mb-1">SAVE YOUR SEED PHRASE (shown once)</div>
                  <div className="font-mono text-xs text-text-primary break-all">{registerMutation.data.wallet.seedPhrase}</div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
        {registerMutation.isError && (
          <p className="font-mono text-sm text-danger mt-4">{registerMutation.error.message}</p>
        )}
      </div>
    )
  }

  // Registered: show worker dashboard
  const myTasks = worker.tasks || []
  const activeTasks = myTasks.filter(t => ['accepted', 'submitted'].includes(t.status))
  const completedTasks = myTasks.filter(t => t.status === 'paid')
  const approvedSubs = (worker.submissions || []).filter(s => s.status === 'approved').length
  const totalSubs = (worker.submissions || []).length
  const approvalRate = totalSubs > 0 ? Math.round((approvedSubs / totalSubs) * 100) : 0

  return (
    <div className="max-w-[1320px] mx-auto px-6">
      <div className="mt-8 mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          <span className="text-neon font-mono">{'> '}</span>WORKER_PORTAL
        </h1>
        <p className="text-sm text-text-secondary">Your tasks, earnings, and reputation.</p>
      </div>

      {/* Skills + Profile */}
      <SkillsPanel worker={worker} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['worker-by-wallet', address] })} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="TOTAL_EARNED" value={`$${formatUsdt(worker.totalEarned)}`} icon={<DollarSign size={16} />} />
        <StatCard label="TASKS_COMPLETED" value={String(worker.tasksCompleted)} icon={<CheckCircle2 size={16} />} />
        <StatCard label="APPROVAL_RATE" value={`${approvalRate}%`} icon={<Zap size={16} />} />
        <StatCard label="REPUTATION" value={String(Math.round(worker.reputationScore))} icon={<Wallet size={16} />} />
      </div>

      {/* Active tasks */}
      <div className="mb-8">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          ACTIVE_MISSIONS
          {activeTasks.length > 0 && <Badge variant="accepted">{activeTasks.length}</Badge>}
        </h2>
        {activeTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTasks.map((task, i) => (
              <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.04 }}>
                <Link to="/browse/$taskId" params={{ taskId: task.id }} search={{ workerId: worker.id }} className="no-underline">
                  <Card interactive>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={task.status === 'accepted' ? 'accepted' : 'pending'}>{task.status.toUpperCase()}</Badge>
                      <span className="font-mono text-sm text-neon">${formatUsdt(task.paymentAmount)} USDT</span>
                    </div>
                    <p className="text-sm mb-2 line-clamp-2">{task.description}</p>
                    <div className="flex items-center justify-between font-mono text-xs text-text-secondary">
                      {task.address && <span className="flex items-center gap-1"><MapPin size={10} /> {task.address}</span>}
                      <span className="text-yellow-accent">{timeLeft(task.deadline)}</span>
                    </div>
                    <div className="mt-3">
                      <BracketButton>SUBMIT_PROOF</BracketButton>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-6">
              <div className="font-mono text-sm text-text-tertiary mb-3">NO_ACTIVE_MISSIONS</div>
              <Link to="/browse" className="no-underline">
                <BracketButton variant="secondary" className="!w-auto inline-flex">BROWSE_AVAILABLE_TASKS</BracketButton>
              </Link>
            </div>
          </Card>
        )}
      </div>

      {/* Completed tasks */}
      <div className="mb-16">
        <h2 className="font-bold text-lg mb-4">COMPLETED_MISSIONS ({completedTasks.length})</h2>
        {completedTasks.length > 0 ? (
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <Card key={task.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm line-clamp-1">{task.description}</p>
                  <span className="font-mono text-xs text-text-tertiary">#{task.id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-neon">${formatUsdt(task.paymentAmount)}</span>
                  <Badge variant="paid">PAID</Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card><div className="text-center py-6 font-mono text-xs text-text-tertiary">NO_COMPLETED_MISSIONS</div></Card>
        )}
      </div>

      <Footer />
    </div>
  )
}

const ALL_SKILLS = ['photo', 'delivery', 'check', 'data', 'mystery', 'event'] as const

function SkillsPanel({ worker, onUpdate }: { worker: Worker; onUpdate: () => void }) {
  const currentSkills = worker.skills?.split(',').map(s => s.trim()).filter(Boolean) || []
  const [editing, setEditing] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState<string[]>(currentSkills)

  const mutation = useMutation({
    mutationFn: () => api.workers.updateProfile({
      workerId: worker.id,
      skills: selectedSkills.join(','),
      availability: 'available',
    }),
    onSuccess: () => { setEditing(false); onUpdate() },
  })

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-semibold">YOUR_SKILLS</h2>
        <div className="flex items-center gap-2">
          <Badge variant={worker.availability === 'available' ? 'open' : worker.availability === 'busy' ? 'accepted' : 'expired'}>
            {worker.availability?.toUpperCase() || 'AVAILABLE'}
          </Badge>
          {!editing && (
            <button onClick={() => setEditing(true)} className="font-mono text-[10px] text-neon cursor-pointer hover:underline">EDIT</button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {ALL_SKILLS.map(skill => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={cnm(
                  'px-3 py-1.5 border rounded font-mono text-xs uppercase cursor-pointer transition-colors duration-100',
                  selectedSkills.includes(skill)
                    ? 'border-neon-border text-neon bg-neon-dim'
                    : 'border-border-medium text-text-secondary hover:border-text-secondary',
                )}
              >
                {skill}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <BracketButton onClick={() => mutation.mutate()} disabled={mutation.isPending} className="!w-auto !py-1.5 !px-4 !text-xs">
              {mutation.isPending ? 'SAVING...' : 'SAVE_SKILLS'}
            </BracketButton>
            <button onClick={() => { setEditing(false); setSelectedSkills(currentSkills) }} className="font-mono text-xs text-text-secondary cursor-pointer hover:text-text-primary">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {currentSkills.length > 0 ? currentSkills.map(skill => (
            <Badge key={skill} variant="open">{skill.toUpperCase()}</Badge>
          )) : (
            <span className="font-mono text-xs text-text-tertiary">No skills set. Click EDIT to add your skills.</span>
          )}
        </div>
      )}
    </Card>
  )
}
