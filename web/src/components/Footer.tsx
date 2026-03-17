import { config } from '@/config'

export default function Footer() {
  return (
    <footer className="border-t border-border-subtle py-6 px-6 flex items-center justify-between font-mono text-xs text-text-secondary mb-8">
      <div className="flex items-center gap-2">
        <img src="/assets/legwork.svg" alt="Legwork" className="h-16" />
      </div>
      <div className="flex items-center gap-6 uppercase tracking-wide">
        <span className="hover:text-text-primary cursor-pointer transition-colors duration-100">Terms</span>
        <span className="hover:text-text-primary cursor-pointer transition-colors duration-100">Privacy</span>
        <span className="hover:text-text-primary cursor-pointer transition-colors duration-100">Github</span>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <span className="border border-neon-border rounded-sm px-2 py-0.5 text-neon text-[10px]">
          {config.platform.version}
        </span>
      </div>
    </footer>
  )
}
