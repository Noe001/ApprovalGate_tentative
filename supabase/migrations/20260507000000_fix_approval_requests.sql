-- Add missing columns to approval_requests that edge functions rely on

ALTER TABLE approval_requests
  ADD COLUMN action_name TEXT,
  ADD COLUMN tenant_id TEXT REFERENCES tenants(id),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_approval_requests_tenant
  ON approval_requests(tenant_id, status, created_at DESC);
