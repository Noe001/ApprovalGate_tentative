const ORANGE = '#FF6200'

/**
 * A thin progress bar showing how much time remains before an approval request times out.
 * Turns amber below 50% and red below 20%.
 */
export function TimeoutBar({
  timeoutAt,
  createdAt,
  marginTop = 4,
}: Readonly<{ timeoutAt: string | null; createdAt: string; marginTop?: number }>) {
  if (!timeoutAt) return null
  const now = Date.now()
  const created = new Date(createdAt).getTime()
  const timeout = new Date(timeoutAt).getTime()
  const total = timeout - created
  if (total <= 0) return null
  const remaining = Math.max(0, Math.min(1, (timeout - now) / total))

  let color: string
  if (remaining > 0.5) {
    color = ORANGE
  } else if (remaining > 0.2) {
    color = '#D4A843'
  } else {
    color = '#D71921'
  }

  return (
    <div style={{ height: 2, background: '#EEEEEE', marginTop }}>
      <div style={{ height: '100%', width: `${remaining * 100}%`, background: color }} />
    </div>
  )
}
