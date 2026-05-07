import { RingigateClient } from './client.js'
import type { RequestOptions } from './types.js'

export interface ApprovalWrapperOptions {
  actionName: string
  reason: string | ((...args: unknown[]) => string)
  description?: string | ((...args: unknown[]) => string)
  metadata?: Record<string, unknown> | ((...args: unknown[]) => Record<string, unknown>)
  timeoutOverride?: number
  onTimeout?: 'deny' | 'allow'
  approvers?: string[]
  approverMode?: 'any' | 'all'
  /** Use this client, or fall back to the global client */
  client?: RingigateClient
}

// ---------------------------------------------------------------------------
// Global client registry
// ---------------------------------------------------------------------------

let _globalClient: RingigateClient | null = null

/** Set the global RingigateClient used by requireApproval when no client is provided. */
export function configureRingigateClient(client: RingigateClient): void {
  _globalClient = client
}

/** Returns the current global RingigateClient, or null if not configured. */
export function getRingigateClient(): RingigateClient | null {
  return _globalClient
}

// ---------------------------------------------------------------------------
// requireApproval HOF
// ---------------------------------------------------------------------------

/**
 * Wraps an async function so that it requests human approval before executing.
 *
 * @example
 * ```ts
 * const safeTransfer = requireApproval(transferFunds, {
 *   actionName: 'transfer_funds',
 *   reason: (args) => `Transfer ${args[0].amount} to ${args[0].recipient}`,
 * })
 *
 * await safeTransfer({ amount: 1000, recipient: 'Bob' })
 * ```
 */
export function requireApproval<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: ApprovalWrapperOptions
): T {
  const wrapped = async (...args: unknown[]): Promise<unknown> => {
    const client = options.client ?? _globalClient
    if (!client) {
      throw new Error(
        '[RingigateSDK] No RingigateClient configured. ' +
          'Either pass `client` in options or call configureRingigateClient() first.'
      )
    }

    const reason =
      typeof options.reason === 'function' ? options.reason(...args) : options.reason

    const metadata =
      typeof options.metadata === 'function'
        ? options.metadata(...args)
        : options.metadata

    const description =
      typeof options.description === 'function'
        ? options.description(...args)
        : options.description

    const requestOptions: RequestOptions = {
      actionName: options.actionName,
      reason,
      ...(description !== undefined && { description }),
      ...(metadata !== undefined && { metadata }),
      ...(options.timeoutOverride !== undefined && { timeoutOverride: options.timeoutOverride }),
      ...(options.onTimeout !== undefined && { onTimeout: options.onTimeout }),
      ...(options.approvers !== undefined && { approvers: options.approvers }),
      ...(options.approverMode !== undefined && { approverMode: options.approverMode }),
    }

    // Will throw ApprovalDeniedException / ApprovalTimeoutException on non-approval
    await client.request(requestOptions)

    // Approval granted — execute the original function
    return fn(...args)
  }

  return wrapped as T
}
