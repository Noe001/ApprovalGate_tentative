import { useQuery } from '@tanstack/react-query'
import { format, parseISO, subDays, eachDayOfInterval, startOfDay } from 'date-fns'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'

interface RequestsChartProps {
  tenantId: string
  days?: number
}

interface DailyData {
  date: string
  approved: number
  rejected: number
  auto_approved: number
}

export function RequestsChart({ tenantId, days = 30 }: RequestsChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['requests-chart', tenantId, days],
    queryFn: async () => {
      const since = subDays(new Date(), days).toISOString()

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('action, created_at')
        .eq('tenant_id', tenantId)
        .in('action', ['approve', 'reject', 'auto_approve'])
        .gte('created_at', since)
        .order('created_at', { ascending: true })

      const interval = eachDayOfInterval({
        start: subDays(new Date(), days - 1),
        end: new Date(),
      })

      const map: Record<string, DailyData> = {}
      for (const day of interval) {
        const key = format(day, 'yyyy-MM-dd')
        map[key] = { date: format(day, 'MM/dd'), approved: 0, rejected: 0, auto_approved: 0 }
      }

      for (const log of logs ?? []) {
        const key = format(startOfDay(parseISO(log.created_at)), 'yyyy-MM-dd')
        if (!map[key]) continue
        if (log.action === 'approve') map[key].approved++
        else if (log.action === 'reject') map[key].rejected++
        else if (log.action === 'auto_approve') map[key].auto_approved++
      }

      return Object.values(map)
    },
  })

  if (isLoading) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorAuto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) => {
            if (value === 'approved') return '承認'
            if (value === 'rejected') return '却下'
            if (value === 'auto_approved') return '自動承認'
            return value
          }}
        />
        <Area
          type="monotone"
          dataKey="approved"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#colorApproved)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="rejected"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#colorRejected)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="auto_approved"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#colorAuto)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
