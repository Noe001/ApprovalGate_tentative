import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

export const DEFAULT_TIMEZONE = 'Asia/Tokyo'

export function formatDate(
  dateStr: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  fmt: string = 'yyyy/MM/dd HH:mm'
): string {
  if (!dateStr) return '-'
  const date = parseISO(dateStr)
  if (!isValid(date)) return '-'
  const zoned = toZonedTime(date, timezone)
  return format(zoned, fmt, { locale: ja })
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const date = parseISO(dateStr)
  if (!isValid(date)) return '-'
  return formatDistanceToNow(date, { addSuffix: true, locale: ja })
}

export function formatTimeout(timeoutAt: string | null | undefined): string {
  if (!timeoutAt) return '-'
  const date = parseISO(timeoutAt)
  if (!isValid(date)) return '-'
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  if (diff <= 0) return 'タイムアウト'
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `残り${hours}時間${minutes % 60}分`
  return `残り${minutes}分`
}

export function getTimeoutPercentage(createdAt: string, timeoutAt: string): number {
  const created = parseISO(createdAt).getTime()
  const timeout = parseISO(timeoutAt).getTime()
  const now = Date.now()
  const total = timeout - created
  const elapsed = now - created
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}
