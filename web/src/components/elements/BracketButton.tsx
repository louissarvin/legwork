import { cnm } from '@/utils/style'

interface BracketButtonProps {
  children: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'disabled'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}

export default function BracketButton({
  children,
  onClick,
  variant = 'primary',
  className,
  type = 'button',
  disabled,
}: BracketButtonProps) {
  const isDisabled = disabled || variant === 'disabled'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={cnm(
        'w-full py-3.5 px-8 rounded font-mono text-sm font-semibold tracking-widest uppercase transition-all duration-100 cursor-pointer',
        variant === 'primary' &&
          'border border-neon-border text-neon bg-transparent hover:bg-neon-dim hover:glow-green',
        variant === 'secondary' &&
          'border border-border-medium text-text-primary bg-transparent hover:border-text-secondary',
        isDisabled &&
          'opacity-25 cursor-not-allowed border-border-subtle text-text-tertiary border-dashed',
        className,
      )}
    >
      {'[ '}
      {children}
      {' ]'}
    </button>
  )
}
