const DECIMALS = 6

export function formatUsdt(baseUnits: string | number): string {
  const n = typeof baseUnits === 'string' ? Number(baseUnits) : baseUnits
  if (isNaN(n)) return '0.00'
  return (n / 10 ** DECIMALS).toFixed(2)
}

export function formatUsdtDisplay(baseUnits: string | number): string {
  return `$${formatUsdt(baseUnits)} USDT`
}

export function parseUsdt(amount: number): string {
  return String(Math.round(amount * 10 ** DECIMALS))
}

export function shortenAddress(address: string, start = 6, end = 4): string {
  if (address.length <= start + end) return address
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

export function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  return `${hours}h ${String(mins).padStart(2, '0')}m left`
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
