-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TABLES
-- ==========================================

-- Tenants (contract entities)
CREATE TABLE tenants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  default_timeout_seconds INTEGER NOT NULL DEFAULT 1800,
  default_timeout_behavior TEXT NOT NULL DEFAULT 'deny' CHECK (default_timeout_behavior IN ('deny', 'allow')),
  fail_closed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Tenant members (user-tenant relationship with roles)
CREATE TABLE tenant_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'approver', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

-- User profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Invitations
CREATE TABLE invitations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'approver', 'viewer')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects (AI agent app units)
CREATE TABLE projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_approver_ids TEXT[] NOT NULL DEFAULT '{}',
  timeout_seconds INTEGER,
  timeout_behavior TEXT CHECK (timeout_behavior IN ('deny', 'allow')),
  approver_mode TEXT NOT NULL DEFAULT 'any' CHECK (approver_mode IN ('any', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- API Keys
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL CHECK (key_prefix IN ('rg_live_', 'rg_test_')),
  key_hash TEXT NOT NULL UNIQUE,
  last_four TEXT NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rules (automation rules)
CREATE TABLE rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL CHECK (action_type IN ('auto_approve', 'notify_approver', 'auto_reject', 'escalate')),
  action_config JSONB NOT NULL DEFAULT '{}',
  timeout_seconds INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, project_id, "order")
);

CREATE TRIGGER rules_updated_at
  BEFORE UPDATE ON rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Rule conditions (AND within group, OR between groups)
CREATE TABLE rule_conditions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  "group" INTEGER NOT NULL DEFAULT 0,
  field TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('contains', 'not_contains', 'equals', 'not_equals', 'gt', 'gte', 'lt', 'lte')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Approval requests
CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED', 'TIMED_OUT', 'ERROR')),
  reason TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  assignee_ids TEXT[] NOT NULL DEFAULT '{}',
  approver_mode TEXT NOT NULL DEFAULT 'any' CHECK (approver_mode IN ('any', 'all')),
  decided_by_id UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  applied_rule_id TEXT REFERENCES rules(id),
  timeout_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  is_test BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs (immutable)
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'slack', 'line_works', 'teams', 'api', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification settings
CREATE TABLE notification_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  slack_bot_token TEXT,
  slack_channel_id TEXT,
  slack_workspace_name TEXT,
  slack_connected_at TIMESTAMPTZ,
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Subscriptions (billing)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'standard', 'pro', 'enterprise')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_limit_members INTEGER NOT NULL DEFAULT 5,
  plan_limit_requests INTEGER NOT NULL DEFAULT 100,
  current_period_requests INTEGER NOT NULL DEFAULT 0,
  next_billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_approval_requests_project_status ON approval_requests(project_id, status, created_at DESC);
CREATE INDEX idx_approval_requests_timeout ON approval_requests(timeout_at) WHERE status = 'PENDING';
CREATE INDEX idx_approval_requests_assignees ON approval_requests USING gin(assignee_ids);
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_rules_tenant_project ON rules(tenant_id, project_id, is_active, "order");
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_projects_tenant ON projects(tenant_id) WHERE deleted_at IS NULL;

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper function to check tenant membership
CREATE OR REPLACE FUNCTION is_tenant_member(t_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = t_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to get user role in tenant
CREATE OR REPLACE FUNCTION get_tenant_role(t_id TEXT)
RETURNS TEXT AS $$
  SELECT role FROM tenant_members
  WHERE tenant_id = t_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is admin+ in tenant
CREATE OR REPLACE FUNCTION is_tenant_admin(t_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = t_id AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Tenants: members can read, only owner can update
CREATE POLICY "tenant_select" ON tenants
  FOR SELECT USING (is_tenant_member(id));

CREATE POLICY "tenant_insert" ON tenants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "tenant_update" ON tenants
  FOR UPDATE USING (get_tenant_role(id) = 'owner');

CREATE POLICY "tenant_delete" ON tenants
  FOR DELETE USING (get_tenant_role(id) = 'owner');

-- Tenant members
CREATE POLICY "member_select" ON tenant_members
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "member_insert" ON tenant_members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "member_update" ON tenant_members
  FOR UPDATE USING (is_tenant_admin(tenant_id));

CREATE POLICY "member_delete" ON tenant_members
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- User profiles
CREATE POLICY "profile_select" ON user_profiles
  FOR SELECT USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM tenant_members tm1
      JOIN tenant_members tm2 ON tm1.tenant_id = tm2.tenant_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = user_profiles.id
    )
  );

CREATE POLICY "profile_insert" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profile_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Invitations
CREATE POLICY "invitation_select" ON invitations
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "invitation_insert" ON invitations
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "invitation_delete" ON invitations
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- Projects
CREATE POLICY "project_select" ON projects
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "project_insert" ON projects
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "project_update" ON projects
  FOR UPDATE USING (is_tenant_admin(tenant_id));

CREATE POLICY "project_delete" ON projects
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- API Keys
CREATE POLICY "apikey_select" ON api_keys
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE is_tenant_admin(p.tenant_id)
    )
  );

CREATE POLICY "apikey_insert" ON api_keys
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE is_tenant_admin(p.tenant_id)
    )
  );

CREATE POLICY "apikey_update" ON api_keys
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE is_tenant_admin(p.tenant_id)
    )
  );

-- Rules
CREATE POLICY "rule_select" ON rules
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "rule_insert" ON rules
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "rule_update" ON rules
  FOR UPDATE USING (is_tenant_admin(tenant_id));

CREATE POLICY "rule_delete" ON rules
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- Rule conditions
CREATE POLICY "rule_condition_select" ON rule_conditions
  FOR SELECT USING (
    rule_id IN (SELECT id FROM rules WHERE is_tenant_member(tenant_id))
  );

CREATE POLICY "rule_condition_insert" ON rule_conditions
  FOR INSERT WITH CHECK (
    rule_id IN (SELECT id FROM rules WHERE is_tenant_admin(tenant_id))
  );

CREATE POLICY "rule_condition_update" ON rule_conditions
  FOR UPDATE USING (
    rule_id IN (SELECT id FROM rules WHERE is_tenant_admin(tenant_id))
  );

CREATE POLICY "rule_condition_delete" ON rule_conditions
  FOR DELETE USING (
    rule_id IN (SELECT id FROM rules WHERE is_tenant_admin(tenant_id))
  );

-- Approval requests: members can read; approvers can update (approve/reject)
CREATE POLICY "approval_request_select" ON approval_requests
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE is_tenant_member(p.tenant_id)
    )
  );

CREATE POLICY "approval_request_insert" ON approval_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "approval_request_update" ON approval_requests
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE is_tenant_member(p.tenant_id)
    )
  );

-- Audit logs: tenant members can read (immutable, no write from client)
CREATE POLICY "audit_log_select" ON audit_logs
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "audit_log_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Notification settings
CREATE POLICY "notif_select" ON notification_settings
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "notif_insert" ON notification_settings
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "notif_update" ON notification_settings
  FOR UPDATE USING (is_tenant_admin(tenant_id));

-- Subscriptions
CREATE POLICY "subscription_select" ON subscriptions
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "subscription_insert" ON subscriptions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "subscription_update" ON subscriptions
  FOR UPDATE USING (get_tenant_role(tenant_id) = 'owner');

-- ==========================================
-- REALTIME
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE approval_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE rules;
