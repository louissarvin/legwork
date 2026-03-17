import { Link, useRouterState } from '@tanstack/react-router'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { cnm } from '@/utils/style'

const NAV_LINKS = [
  { href: '/browse', label: '/browse_tasks' },
  { href: '/worker', label: '/worker_portal' },
  { href: '/client', label: '/client_portal' },
  { href: '/dashboard', label: '/command_center' },
] as const

export default function Navbar() {
  const { location } = useRouterState()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-page border-b border-border-subtle flex items-center justify-between px-6">
      <Link to="/" className="flex items-center no-underline">
        <img src="/assets/legwork.svg" alt="Legwork" className="h-20" />
      </Link>

      <div className="hidden md:flex items-center gap-6">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className={cnm(
              'font-mono text-sm no-underline transition-colors duration-100',
              location.pathname.startsWith(link.href)
                ? 'text-neon underline underline-offset-[6px]'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 border border-neon-border rounded px-3 py-1.5 font-mono text-xs text-neon">
          <span className="inline-block w-2 h-2 bg-neon rounded-sm" />
          SYS: ONLINE
        </div>
        <ConnectButton
          chainStatus="none"
          showBalance={false}
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'address',
          }}
        />
      </div>
    </nav>
  )
}
