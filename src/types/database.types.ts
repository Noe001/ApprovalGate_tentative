export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          timezone: string
          default_timeout_seconds: number
          default_timeout_behavior: 'deny' | 'allow'
          fail_closed: boolean
          created_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['tenants']['Row']>
        Update: Partial<Database['public']['Tables']['tenants']['Row']>
        Relationships: []
      }
      tenant_members: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          role: 'owner' | 'admin' | 'approver' | 'viewer'
          joined_at: string
        }
        Insert: Partial<Database['public']['Tables']['tenant_members']['Row']>
        Update: Partial<Database['public']['Tables']['tenant_members']['Row']>
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          name: string
          avatar_url: string | null
          email_cached: string | null
          created_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['user_profiles']['Row']>
        Update: Partial<Database['public']['Tables']['user_profiles']['Row']>
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          tenant_id: string
          inviter_id: string
          email: string
          role: 'owner' | 'admin' | 'approver' | 'viewer'
          token: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['invitations']['Row']>
        Update: Partial<Database['public']['Tables']['invitations']['Row']>
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          default_approver_ids: string[]
          timeout_seconds: number | null
          timeout_behavior: 'deny' | 'allow' | null
          approver_mode: 'any' | 'all'
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['projects']['Row']>
        Update: Partial<Database['public']['Tables']['projects']['Row']>
        Relationships: []
      }
      api_keys: {
        Row: {
          id: string
          project_id: string
          name: string
          key_prefix: 'rg_live_' | 'rg_test_'
          key_hash: string
          last_four: string
          is_test: boolean
          last_used_at: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['api_keys']['Row']>
        Update: Partial<Database['public']['Tables']['api_keys']['Row']>
        Relationships: []
      }
      rules: {
        Row: {
          id: string
          tenant_id: string
          project_id: string | null
          name: string
          order: number
          action_type: 'auto_approve' | 'notify_approver' | 'auto_reject' | 'escalate'
          action_config: Json
          timeout_seconds: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['rules']['Row']>
        Update: Partial<Database['public']['Tables']['rules']['Row']>
        Relationships: []
      }
      rule_conditions: {
        Row: {
          id: string
          rule_id: string
          group: number
          field: string
          operator: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte'
          value: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['rule_conditions']['Row']>
        Update: Partial<Database['public']['Tables']['rule_conditions']['Row']>
        Relationships: []
      }
      approval_requests: {
        Row: {
          id: string
          project_id: string
          tenant_id: string | null
          status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED' | 'TIMED_OUT' | 'ERROR'
          action_name: string | null
          reason: string
          description: string | null
          metadata: Json
          assignee_ids: string[]
          approver_mode: 'any' | 'all'
          decided_by_id: string | null
          rejection_reason: string | null
          applied_rule_id: string | null
          timeout_at: string
          decided_at: string | null
          is_test: boolean
          reminder_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['approval_requests']['Row']>
        Update: Partial<Database['public']['Tables']['approval_requests']['Row']>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string
          actor_id: string | null
          actor_type: 'user' | 'system'
          action: string
          resource_type: string
          resource_id: string
          before_data: Json | null
          after_data: Json | null
          ip_address: string | null
          channel: 'web' | 'slack' | 'line_works' | 'teams' | 'api' | 'system'
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']>
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>
        Relationships: []
      }
      notification_settings: {
        Row: {
          id: string
          tenant_id: string
          slack_bot_token: string | null
          slack_channel_id: string | null
          slack_workspace_name: string | null
          slack_connected_at: string | null
          email_notifications_enabled: boolean
          line_works_waitlist: boolean
          teams_waitlist: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['notification_settings']['Row']>
        Update: Partial<Database['public']['Tables']['notification_settings']['Row']>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          tenant_id: string
          plan: 'starter' | 'standard' | 'pro' | 'enterprise'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan_limit_members: number
          plan_limit_requests: number
          current_period_requests: number
          next_billing_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']>
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_tenant_member: { Args: { t_id: string }; Returns: boolean }
      get_tenant_role: { Args: { t_id: string }; Returns: string }
      is_tenant_admin: { Args: { t_id: string }; Returns: boolean }
    }
    Enums: Record<string, never>
  }
}
