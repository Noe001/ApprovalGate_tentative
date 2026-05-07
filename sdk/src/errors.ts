/** Base error for all Ringigate SDK errors */
export class RingigateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RingigateError'
    // Fix prototype chain for instanceof checks in transpiled code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Thrown when a request is rejected (human clicked reject or auto_reject rule triggered) */
export class ApprovalDeniedException extends RingigateError {
  /** Rejection reason if provided by the approver */
  readonly reason?: string
  readonly requestId: string

  constructor(requestId: string, reason?: string) {
    super(
      reason
        ? `Approval request ${requestId} was rejected: ${reason}`
        : `Approval request ${requestId} was rejected`
    )
    this.name = 'ApprovalDeniedException'
    this.requestId = requestId
    this.reason = reason
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Thrown when a request times out waiting for approval */
export class ApprovalTimeoutException extends RingigateError {
  readonly requestId: string
  readonly timeoutAt: string

  constructor(requestId: string, timeoutAt: string) {
    super(`Approval request ${requestId} timed out at ${timeoutAt}`)
    this.name = 'ApprovalTimeoutException'
    this.requestId = requestId
    this.timeoutAt = timeoutAt
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Thrown on network errors, invalid API key, or server errors */
export class ApprovalServiceException extends RingigateError {
  readonly statusCode?: number
  readonly requestId?: string

  constructor(message: string, statusCode?: number, requestId?: string) {
    super(message)
    this.name = 'ApprovalServiceException'
    this.statusCode = statusCode
    this.requestId = requestId
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
