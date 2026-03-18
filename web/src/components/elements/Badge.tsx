import { cnm } from '@/utils/style'

const VARIANTS = {
  open: 'border-neon-border text-neon',
  accepted: 'border-yellow-border text-yellow-accent',
  pending: 'border-[rgba(255,159,10,0.5)] text-pending',
  paid: 'border-neon-border text-neon bg-neon-dim',
  rejected: 'border-[rgba(255,59,59,0.5)] text-danger',
  expired: 'border-[rgba(255,59,59,0.5)] text-danger opacity-50',
  escrow: 'border-border-medium text-text-secondary',
  default: 'border-border-medium text-text-secondary',
} as const

interface BadgeProps {
  variant?: keyof typeof VARIANTS
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cnm(
        'inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[11px] tracking-wide uppercase border rounded-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
