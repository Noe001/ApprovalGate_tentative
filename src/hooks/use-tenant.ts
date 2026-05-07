import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useTenant(tenantId: string) {
  return useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single()
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useTenantMember(tenantId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-member', tenantId, userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('tenant_members')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .single()
      if (error) return null
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
