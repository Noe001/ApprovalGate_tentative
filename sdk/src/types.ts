export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_APPROVED'
  | 'TIMED_OUT'
  | 'ERROR'

export interface RequestOptions {
  /** e.g., "transfer_funds" */
  actionName: string
  /** human-readable explanation */
  reason: string
  /** optional long-form explanation shown to approvers */
  description?: string
  /** optional structured data */
  metadata?: Record<string, unknown>
  /** override timeout in seconds */
  timeoutOverride?: number
  /** timeout behavior for this request */
  onTimeout?: 'deny' | 'allow'
  /** explicit approver email list */
  approvers?: string[]
  /** approver mode when approvers are specified */
  approverMode?: 'any' | 'all'
  /** polling interval in ms (default: 2000) */
  pollIntervalMs?: number
  /** max time to wait in ms (default: uses server timeout) */
  maxWaitMs?: number
}

export interface ApprovalResult {
  id: string
  status: ApprovalStatus
  decisionReason?: string
  decidedAt?: string
  createdAt: string
  timeoutAt?: string
}

export interface RingigateClientOptions {
  /** default: RINGI_GATE_API_KEY */
  apiKey?: string
  /** default: RINGI_GATE_BASE_URL or https://api.ringigate.com/sdk/v1 */
  baseUrl?: string
  /** global HTTP timeout in ms (default: 30000) */
  timeoutMs?: number
  /** default max wait in seconds (default: RINGI_GATE_TIMEOUT_SECONDS or 1800) */
  timeoutSeconds?: number
  /** service failure behavior (default: RINGI_GATE_FAIL_BEHAVIOR or deny) */
  failBehavior?: 'deny' | 'allow'
}
