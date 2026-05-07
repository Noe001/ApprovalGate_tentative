-- Tighten approval request access for release readiness.
-- Owner/Admin can read and decide all requests in the tenant.
-- Viewer can read all requests for audit visibility, but cannot update.
-- Approver can read/update only requests assigned to their auth user id.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email_cached TEXT;

DROP POLICY IF EXISTS "approval_request_select" ON approval_requests;
DROP POLICY IF EXISTS "approval_request_update" ON approval_requests;

CREATE POLICY "approval_request_select" ON approval_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = approval_requests.project_id
      AND (
        is_tenant_admin(p.tenant_id)
        OR get_tenant_role(p.tenant_id) = 'viewer'
        OR (
          get_tenant_role(p.tenant_id) = 'approver'
          AND auth.uid()::text = ANY(approval_requests.assignee_ids)
        )
      )
    )
  );

CREATE POLICY "approval_request_update" ON approval_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = approval_requests.project_id
      AND (
        is_tenant_admin(p.tenant_id)
        OR (
          get_tenant_role(p.tenant_id) = 'approver'
          AND auth.uid()::text = ANY(approval_requests.assignee_ids)
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = approval_requests.project_id
      AND (
        is_tenant_admin(p.tenant_id)
        OR (
          get_tenant_role(p.tenant_id) = 'approver'
          AND auth.uid()::text = ANY(approval_requests.assignee_ids)
        )
      )
    )
  );
