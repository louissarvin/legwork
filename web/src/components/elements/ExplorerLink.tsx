import { config } from '@/config'
import { shortenAddress } from '@/utils/usdt'
import { ExternalLink } from 'lucide-react'

interface ExplorerLinkProps {
  type: 'tx' | 'address' | 'eas'
  value: string
  label?: string
  className?: string
}

export default function ExplorerLink({ type, value, label, className }: ExplorerLinkProps) {
  const url = type === 'tx' ? config.explorer.tx(value)
    : type === 'address' ? config.explorer.address(value)
    : config.explorer.eas(value)

  const display = label || shortenAddress(value, 6, 4)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 font-mono text-neon hover:underline no-underline ${className || ''}`}
    >
      {display}
      <ExternalLink size={10} className="opacity-50" />
    </a>
  )
}
