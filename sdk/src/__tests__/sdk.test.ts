import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RingigateClient } from '../client.js'
import {
  RingigateError,
  ApprovalDeniedException,
  ApprovalTimeoutException,
  ApprovalServiceException,
} from '../errors.js'
import {
  requireApproval,
  configureRingigateClient,
  getRingigateClient,
} from '../decorator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(overrides?: ConstructorParameters<typeof RingigateClient>[0]) {
  return new RingigateClient({ apiKey: 'rg_test_key', baseUrl: 'https://example.com/functions/v1', ...overrides })
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe('Error classes', () => {
  it('RingigateError is instanceof Error', () => {
    const e = new RingigateError('test')
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toBe('test')
    expect(e.name).toBe('RingigateError')
  })

  it('ApprovalDeniedException carries requestId and reason', () => {
    const e = new ApprovalDeniedException('req-123', 'Too risky')
    expect(e).toBeInstanceOf(ApprovalDeniedException)
    expect(e.requestId).toBe('req-123')
    expect(e.reason).toBe('Too risky')
    expect(e.message).toContain('rejected')
  })

  it('ApprovalDeniedException without reason', () => {
    const e = new ApprovalDeniedException('req-456')
    expect(e.reason).toBeUndefined()
    expect(e.message).toContain('req-456')
  })

  it('ApprovalTimeoutException carries requestId and timeoutAt', () => {
    const e = new ApprovalTimeoutException('req-789', '2024-01-01T00:00:00Z')
    expect(e).toBeInstanceOf(ApprovalTimeoutException)
    expect(e.requestId).toBe('req-789')
    expect(e.timeoutAt).toBe('2024-01-01T00:00:00Z')
  })

  it('ApprovalServiceException carries statusCode and requestId', () => {
    const e = new ApprovalServiceException('Server error', 500, 'req-abc')
    expect(e).toBeInstanceOf(ApprovalServiceException)
    expect(e.statusCode).toBe(500)
    expect(e.requestId).toBe('req-abc')
  })
})

// ---------------------------------------------------------------------------
// Mock mode
// ---------------------------------------------------------------------------

describe('Mock mode', () => {
  beforeEach(() => {
    process.env['RINGI_GATE_MOCK_MODE'] = 'auto_approve'
  })
  afterEach(() => {
    delete process.env['RINGI_GATE_MOCK_MODE']
  })

  it('submit() returns PENDING without network calls', async () => {
    const client = makeClient()
    const result = await client.submit({ actionName: 'test', reason: 'testing' })
    expect(result.status).toBe('PENDING')
    expect(result.id).toMatch(/^mock-/)
  })

  it('getStatus() returns PENDING on first call, AUTO_APPROVED on second', async () => {
    const client = makeClient()
    const { id } = await client.submit({ actionName: 'test', reason: 'testing' })

    const first = await client.getStatus(id)
    expect(first.status).toBe('PENDING')

    const second = await client.getStatus(id)
    expect(second.status).toBe('AUTO_APPROVED')
  })

  it('request() resolves with AUTO_APPROVED in mock mode', async () => {
    const client = makeClient()
    const result = await client.request({
      actionName: 'test_action',
      reason: 'mock test',
      pollIntervalMs: 1,
    })
    expect(result.status).toBe('AUTO_APPROVED')
  })

  it('request() rejects in auto_deny mock mode', async () => {
    process.env['RINGI_GATE_MOCK_MODE'] = 'auto_deny'
    const client = makeClient()
    await expect(
      client.request({ actionName: 'test_action', reason: 'mock test', pollIntervalMs: 1 })
    ).rejects.toThrow(ApprovalDeniedException)
  })
})

// ---------------------------------------------------------------------------
// Client — fetch mocking
// ---------------------------------------------------------------------------

describe('RingigateClient (real fetch mocked)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env['RINGI_GATE_MOCK_MODE']
    delete process.env['RINGI_GATE_API_KEY']
    delete process.env['RINGI_GATE_BASE_URL']
    delete process.env['RINGI_GATE_FAIL_BEHAVIOR']
  })

  function mockFetch(responses: Array<{ ok: boolean; status: number; body: unknown }>) {
    let call = 0
    globalThis.fetch = vi.fn(async () => {
      const resp = responses[Math.min(call++, responses.length - 1)]
      return {
        ok: resp.ok,
        status: resp.status,
        json: async () => resp.body,
        text: async () => JSON.stringify(resp.body),
      } as Response
    })
  }

  it('submit() posts to correct endpoint and returns id/status', async () => {
    mockFetch([{ ok: true, status: 202, body: { id: 'req-1', status: 'PENDING' } }])
    const client = makeClient()
    const result = await client.submit({ actionName: 'do_something', reason: 'test' })
    expect(result.id).toBe('req-1')
    expect(result.status).toBe('PENDING')
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('sdk-requests')
    const body = (init as RequestInit).body
    expect(JSON.parse(typeof body === 'string' ? body : '')).toMatchObject({
      action_name: 'do_something',
      reason: 'test',
    })
  })

  it('getStatus() calls correct URL', async () => {
    mockFetch([{
      ok: true, status: 200,
      body: { id: 'req-1', status: 'APPROVED', createdAt: new Date().toISOString() },
    }])
    const client = makeClient()
    const result = await client.getStatus('req-1')
    expect(result.status).toBe('APPROVED')
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('req-1')
  })

  it('uses environment variables when constructor options are omitted', async () => {
    process.env['RINGI_GATE_API_KEY'] = 'rg_test_env'
    process.env['RINGI_GATE_BASE_URL'] = 'https://api.example.test/sdk/v1'
    mockFetch([{ ok: true, status: 202, body: { data: { request_id: 'req-env', status: 'PENDING' } } }])
    const client = new RingigateClient()
    const result = await client.submit({ actionName: 'act', reason: 'r' })
    expect(result.id).toBe('req-env')
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://api.example.test/sdk/v1/requests')
  })

  it('returns AUTO_APPROVED on service failure when fail behavior is allow', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    const client = makeClient({ failBehavior: 'allow' })
    const result = await client.request({ actionName: 'act', reason: 'r' })
    expect(result.status).toBe('AUTO_APPROVED')
  })

  it('request() returns result immediately if submit returns APPROVED', async () => {
    mockFetch([
      { ok: true, status: 202, body: { id: 'req-2', status: 'APPROVED' } },
      { ok: true, status: 200, body: { id: 'req-2', status: 'APPROVED', createdAt: new Date().toISOString() } },
    ])
    const client = makeClient()
    const result = await client.request({ actionName: 'act', reason: 'r', pollIntervalMs: 1 })
    expect(result.status).toBe('APPROVED')
  })

  it('request() polls until APPROVED', async () => {
    const now = new Date().toISOString()
    mockFetch([
      { ok: true, status: 202, body: { id: 'req-3', status: 'PENDING' } },
      { ok: true, status: 200, body: { id: 'req-3', status: 'PENDING', createdAt: now } },
      { ok: true, status: 200, body: { id: 'req-3', status: 'APPROVED', createdAt: now } },
    ])
    const client = makeClient()
    const result = await client.request({ actionName: 'act', reason: 'r', pollIntervalMs: 1 })
    expect(result.status).toBe('APPROVED')
  })

  it('request() throws ApprovalDeniedException on REJECTED', async () => {
    const now = new Date().toISOString()
    mockFetch([
      { ok: true, status: 202, body: { id: 'req-4', status: 'PENDING' } },
      { ok: true, status: 200, body: { id: 'req-4', status: 'REJECTED', createdAt: now, decisionReason: 'Too expensive' } },
    ])
    const client = makeClient()
    await expect(
      client.request({ actionName: 'act', reason: 'r', pollIntervalMs: 1 })
    ).rejects.toThrow(ApprovalDeniedException)
  })

  it('request() throws ApprovalTimeoutException on TIMED_OUT', async () => {
    const now = new Date().toISOString()
    mockFetch([
      { ok: true, status: 202, body: { id: 'req-5', status: 'PENDING' } },
      { ok: true, status: 200, body: { id: 'req-5', status: 'TIMED_OUT', createdAt: now, timeoutAt: now } },
    ])
    const client = makeClient()
    await expect(
      client.request({ actionName: 'act', reason: 'r', pollIntervalMs: 1 })
    ).rejects.toThrow(ApprovalTimeoutException)
  })

  it('request() respects maxWaitMs client-side timeout', async () => {
    const now = new Date().toISOString()
    // Always returns PENDING so client-side timeout fires
    mockFetch([
      { ok: true, status: 202, body: { id: 'req-6', status: 'PENDING' } },
      { ok: true, status: 200, body: { id: 'req-6', status: 'PENDING', createdAt: now } },
      { ok: true, status: 200, body: { id: 'req-6', status: 'PENDING', createdAt: now } },
      { ok: true, status: 200, body: { id: 'req-6', status: 'PENDING', createdAt: now } },
    ])
    const client = makeClient()
    await expect(
      client.request({ actionName: 'act', reason: 'r', pollIntervalMs: 1, maxWaitMs: 5 })
    ).rejects.toThrow(ApprovalTimeoutException)
  })

  it('submit() throws ApprovalServiceException on HTTP 401', async () => {
    mockFetch([{ ok: false, status: 401, body: { message: 'Unauthorized' } }])
    const client = makeClient()
    await expect(
      client.submit({ actionName: 'act', reason: 'r' })
    ).rejects.toThrow(ApprovalServiceException)
  })
})

// ---------------------------------------------------------------------------
// requireApproval decorator
// ---------------------------------------------------------------------------

describe('requireApproval', () => {
  beforeEach(() => {
    process.env['RINGI_GATE_MOCK_MODE'] = 'auto_approve'
    const client = makeClient()
    configureRingigateClient(client)
  })
  afterEach(() => {
    delete process.env['RINGI_GATE_MOCK_MODE']
  })

  it('executes the wrapped function after approval', async () => {
    const fn = vi.fn(async (x: unknown) => (x as number) * 2)
    const safeFn = requireApproval(fn as (...args: unknown[]) => Promise<unknown>, {
      actionName: 'double',
      reason: 'testing',
    })
    const result = await safeFn(21)
    expect(fn).toHaveBeenCalledWith(21)
    expect(result).toBe(42)
  })

  it('supports dynamic reason from args', async () => {
    const fn = vi.fn(async (name: unknown) => `hello ${name}`)
    const safeFn = requireApproval(fn as (...args: unknown[]) => Promise<unknown>, {
      actionName: 'greet',
      reason: (...args) => `Greet ${args[0] as string}`,
    })
    await safeFn('Alice')
    expect(fn).toHaveBeenCalledWith('Alice')
  })

  it('throws if no client configured', async () => {
    // Temporarily clear global client
    configureRingigateClient(null as unknown as RingigateClient)
    const fn = vi.fn(async () => 'done')
    const safeFn = requireApproval(fn as (...args: unknown[]) => Promise<unknown>, {
      actionName: 'act',
      reason: 'test',
      client: undefined,
    })
    await expect(safeFn()).rejects.toThrow(/No RingigateClient configured/)
    // Restore
    configureRingigateClient(makeClient())
  })

  it('getRingigateClient returns configured client', () => {
    const client = makeClient()
    configureRingigateClient(client)
    expect(getRingigateClient()).toBe(client)
  })
})
