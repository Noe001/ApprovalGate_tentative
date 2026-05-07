import type { ApprovalResult, ApprovalStatus, RequestOptions, RingigateClientOptions } from './types.js'
import {
  ApprovalDeniedException,
  ApprovalServiceException,
  ApprovalTimeoutException,
} from './errors.js'

const TERMINAL_STATUSES: ReadonlySet<ApprovalStatus> = new Set([
  'APPROVED',
  'AUTO_APPROVED',
  'REJECTED',
  'TIMED_OUT',
  'ERROR',
])

const DEFAULT_POLL_INTERVAL_MS = 2000
const DEFAULT_HTTP_TIMEOUT_MS = 30000
const DEFAULT_BASE_URL = 'https://api.ringigate.com/sdk/v1'
const DEFAULT_TIMEOUT_SECONDS = 1800
const MAX_METADATA_BYTES = 10 * 1024

type MockMode = 'auto_approve' | 'auto_deny' | null
type FailBehavior = 'deny' | 'allow'

/** Generates a fake UUID-like ID for mock mode */
function mockId(): string {
  return 'mock-' + Math.random().toString(36).slice(2, 10)
}

/** Read an environment variable when running under Node.js. */
function getEnv(name: string): string | undefined {
  try {
    const env = (globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> }
    }).process?.env
    return env?.[name]
  } catch {
    // ignore
  }
  return undefined
}

function getMockMode(): MockMode {
  const value = getEnv('RINGI_GATE_MOCK_MODE')
  if (value === 'auto_approve' || value === 'true') return 'auto_approve'
  if (value === 'auto_deny') return 'auto_deny'
  return null
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined
}

function parseFailBehavior(value: string | undefined): FailBehavior | undefined {
  return value === 'allow' || value === 'deny' ? value : undefined
}

export class RingigateClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly timeoutSeconds: number
  private readonly failBehavior: FailBehavior
  private readonly mockMode: MockMode

  /** Tracks which mock request IDs have been polled at least once */
  private readonly _mockedPolled = new Set<string>()

  constructor(options: RingigateClientOptions = {}) {
    this.mockMode = getMockMode()
    this.apiKey = options.apiKey ?? getEnv('RINGI_GATE_API_KEY') ?? ''
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? getEnv('RINGI_GATE_BASE_URL') ?? DEFAULT_BASE_URL)
    this.timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS
    this.timeoutSeconds = options.timeoutSeconds ?? parsePositiveInt(getEnv('RINGI_GATE_TIMEOUT_SECONDS')) ?? DEFAULT_TIMEOUT_SECONDS
    this.failBehavior = options.failBehavior ?? parseFailBehavior(getEnv('RINGI_GATE_FAIL_BEHAVIOR')) ?? 'deny'

    if (!this.apiKey && !this.mockMode) {
      throw new ApprovalServiceException(
        'Missing API key. Pass apiKey or set RINGI_GATE_API_KEY.'
      )
    }

    if (this.mockMode) {
      console.warn(`[RingigateClient] MOCK MODE enabled: ${this.mockMode}`)
    }
  }

  /**
   * Submit an approval request and poll until a terminal status is reached.
   *
   * - Returns ApprovalResult if APPROVED or AUTO_APPROVED
   * - Throws ApprovalDeniedException if REJECTED
   * - Throws ApprovalTimeoutException if TIMED_OUT (server-side or client maxWaitMs exceeded)
   * - Throws ApprovalServiceException on network/server errors
   */
  async request(options: RequestOptions): Promise<ApprovalResult> {
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    const maxWaitMs = options.maxWaitMs ?? this.timeoutSeconds * 1000

    let initial: { id: string; status: ApprovalStatus }
    try {
      initial = await this.submit(options)
    } catch (err) {
      return this._handleServiceFailure(err)
    }

    // If already terminal after submission, handle immediately
    if (TERMINAL_STATUSES.has(initial.status)) {
      return this._handleTerminal(await this.getStatus(initial.id))
    }

    // Polling loop
    const startMs = Date.now()

    while (true) {
      await sleep(pollIntervalMs)

      // Client-side timeout guard
      if (Date.now() - startMs >= maxWaitMs) {
        throw new ApprovalTimeoutException(
          initial.id,
          new Date(Date.now()).toISOString()
        )
      }

      let result: ApprovalResult
      try {
        result = await this.getStatus(initial.id)
      } catch (err) {
        return this._handleServiceFailure(err, initial.id)
      }

      if (TERMINAL_STATUSES.has(result.status)) {
        return this._handleTerminal(result)
      }
    }
  }

  /**
   * Submit an approval request without polling.
   * Returns immediately after receiving the 202 response.
   */
  async submit(options: RequestOptions): Promise<{ id: string; status: ApprovalStatus }> {
    if (this.mockMode) {
      const id = mockId()
      this._mockedPolled.delete(id) // clean up just in case
      return { id, status: 'PENDING' }
    }

    assertMetadataSize(options.metadata)

    const body = {
      action_name: options.actionName,
      reason: options.reason,
      ...(options.description !== undefined && { description: options.description }),
      ...(options.metadata !== undefined && { metadata: options.metadata }),
      ...(options.timeoutOverride !== undefined && { timeout_override: options.timeoutOverride }),
      ...(options.onTimeout !== undefined && { on_timeout: options.onTimeout }),
      ...(options.approvers !== undefined && { approvers: options.approvers }),
      ...(options.approverMode !== undefined && { approver_mode: options.approverMode }),
    }

    const response = await this._fetch(this._requestsEndpoint(), {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await this._handleErrorResponse(response)
    }

    const data = (await response.json()) as Record<string, unknown>
    const payload = unwrapData(data)
    const id = stringField(payload, 'request_id') ?? stringField(payload, 'id')
    const status = stringField(payload, 'status') as ApprovalStatus | undefined
    if (!id || !status) {
      throw new ApprovalServiceException('API response did not include request id and status')
    }
    return { id, status }
  }

  /**
   * Poll for the current status of an existing approval request.
   */
  async getStatus(requestId: string): Promise<ApprovalResult> {
    if (this.mockMode) {
      const alreadyPolled = this._mockedPolled.has(requestId)
      this._mockedPolled.add(requestId)

      if (alreadyPolled) {
        const approved = this.mockMode === 'auto_approve'
        return {
          id: requestId,
          status: approved ? 'AUTO_APPROVED' : 'REJECTED',
          createdAt: new Date().toISOString(),
          decidedAt: new Date().toISOString(),
          decisionReason: approved ? 'Mock auto-approved' : 'Mock auto-denied',
        }
      } else {
        // First poll: still PENDING
        return {
          id: requestId,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        }
      }
    }

    const response = await this._fetch(this._statusEndpoint(requestId), { method: 'GET' })

    if (!response.ok) {
      await this._handleErrorResponse(response, requestId)
    }

    const data = (await response.json()) as Record<string, unknown>
    return normalizeApprovalResult(data)
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Resolve a terminal ApprovalResult to a return value or thrown exception */
  private _handleTerminal(result: ApprovalResult): ApprovalResult {
    switch (result.status) {
      case 'APPROVED':
      case 'AUTO_APPROVED':
        return result

      case 'REJECTED':
        throw new ApprovalDeniedException(result.id, result.decisionReason)

      case 'TIMED_OUT':
        throw new ApprovalTimeoutException(result.id, result.timeoutAt ?? new Date().toISOString())

      case 'ERROR':
        throw new ApprovalServiceException(
          `Approval request ${result.id} encountered a server-side error`,
          undefined,
          result.id
        )

      default:
        // Should not reach here with strict types, but guard anyway
        throw new ApprovalServiceException(
          `Approval request ${result.id} has unexpected status: ${String(result.status)}`,
          undefined,
          result.id
        )
    }
  }

  private _requestsEndpoint(): string {
    if (this.baseUrl.endsWith('/functions/v1')) {
      return `${this.baseUrl}/sdk-requests`
    }
    return `${this.baseUrl}/requests`
  }

  private _statusEndpoint(requestId: string): string {
    const encoded = encodeURIComponent(requestId)
    if (this.baseUrl.endsWith('/functions/v1')) {
      return `${this.baseUrl}/sdk-status/requests/${encoded}/status`
    }
    return `${this.baseUrl}/requests/${encoded}/status`
  }

  private _handleServiceFailure(err: unknown, requestId?: string): ApprovalResult {
    if (this.failBehavior === 'allow') {
      const now = new Date().toISOString()
      return {
        id: requestId ?? mockId().replace('mock-', 'fail-open-'),
        status: 'AUTO_APPROVED',
        createdAt: now,
        decidedAt: now,
        decisionReason: 'Service unavailable; fail behavior is allow',
      }
    }

    if (err instanceof ApprovalServiceException) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw new ApprovalServiceException(message, undefined, requestId)
  }

  /** Perform a fetch with the configured API key and global HTTP timeout */
  private async _fetch(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey,
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      })
      return response
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw new ApprovalServiceException(
          `Request to ${url} timed out after ${this.timeoutMs}ms`
        )
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new ApprovalServiceException(`Network error: ${message}`)
    } finally {
      clearTimeout(timerId)
    }
  }

  /** Parse an error HTTP response and throw ApprovalServiceException */
  private async _handleErrorResponse(response: Response, requestId?: string): Promise<never> {
    let detail = ''
    try {
      const body = (await response.json()) as Record<string, unknown>
      detail = typeof body['message'] === 'string' ? body['message'] : JSON.stringify(body)
    } catch {
      detail = await response.text().catch(() => '')
    }

    const message = detail
      ? `API error ${response.status}: ${detail}`
      : `API error ${response.status}`

    throw new ApprovalServiceException(message, response.status, requestId)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function unwrapData(data: Record<string, unknown>): Record<string, unknown> {
  const nested = data['data']
  return isRecord(nested) ? nested : data
}

function normalizeApprovalResult(data: Record<string, unknown>): ApprovalResult {
  const payload = unwrapData(data)
  const id = stringField(payload, 'request_id') ?? stringField(payload, 'id')
  const status = stringField(payload, 'status') as ApprovalStatus | undefined
  if (!id || !status) {
    throw new ApprovalServiceException('API response did not include request status')
  }

  return {
    id,
    status,
    decisionReason:
      stringField(payload, 'decision_reason') ?? stringField(payload, 'rejection_reason'),
    decidedAt: stringField(payload, 'decided_at') ?? stringField(payload, 'decidedAt'),
    createdAt: stringField(payload, 'created_at') ?? stringField(payload, 'createdAt') ?? new Date().toISOString(),
    timeoutAt: stringField(payload, 'timeout_at') ?? stringField(payload, 'timeoutAt'),
  }
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertMetadataSize(metadata: Record<string, unknown> | undefined): void {
  if (!metadata) return
  const bytes = new TextEncoder().encode(JSON.stringify(metadata)).length
  if (bytes > MAX_METADATA_BYTES) {
    throw new ApprovalServiceException('metadata must be 10KB or smaller')
  }
}

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return true
  // Node.js 18+ uses code === 'ABORT_ERR' on some error objects
  const code = (err as Error & { code?: string }).code
  return code === 'ABORT_ERR'
}
