import { cnm } from '@/utils/style'

interface CardProps {
  children: React.ReactNode
  active?: boolean
  interactive?: boolean
  className?: string
}

export default function Card({ children, active, interactive, className }: CardProps) {
  return (
    <div
      className={cnm(
        'bg-surface border rounded-lg p-6 transition-all duration-100',
        active
          ? 'border-neon-border glow-green'
          : 'border-border-subtle',
        interactive && 'hover:border-neon-border hover:glow-green cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}
