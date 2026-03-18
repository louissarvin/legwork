import { cnm } from '@/utils/style'
import { motion } from 'motion/react'
import { FADE_IN_UP } from '@/config/animation'

interface StatCardProps {
  label: string
  value: string
  delta?: string
  icon?: React.ReactNode
  className?: string
}

export default function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <motion.div
      {...FADE_IN_UP}
      className={cnm(
        'bg-surface border border-neon-border rounded-lg p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] tracking-widest uppercase text-text-secondary">
          {label}
        </span>
        {icon && <span className="text-text-tertiary">{icon}</span>}
      </div>
      <div className="font-mono text-2xl lg:text-3xl font-semibold text-neon tabular-nums truncate">
        <span className="opacity-50">{'> '}</span>
        {value}
      </div>
      {delta && (
        <div className="font-mono text-[11px] text-neon mt-2">{delta}</div>
      )}
    </motion.div>
  )
}
