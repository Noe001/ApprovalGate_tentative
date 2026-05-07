import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useRealtimeApprovals(tenantId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`approvals:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approval_requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['approvals', tenantId] })
          queryClient.invalidateQueries({ queryKey: ['dashboard', tenantId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])
}

export function useRealtimeApprovalStatus(requestId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`approval:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'approval_requests',
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          queryClient.setQueryData(['approval', requestId], payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [requestId, queryClient])
}
