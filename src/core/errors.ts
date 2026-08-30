/**
 * Structured error contract for pizx.
 *
 * Every error surfaced at a public boundary is a `PizxError` carrying a stable
 * machine-readable `code` (plus the letter that produced it, when relevant).
 * Consumers branch on `instanceof PizxError` / `err.code` — never on message
 * prefixes, which remain human-readable and are not part of the contract.
 */

/** Stable machine-readable error categories. */
export type PizxErrorCode = 'VALIDATION' | 'AUTH' | 'AGENT' | 'ACP' | 'CANCELLED' | 'INTERNAL'

export class PizxError extends Error {
  constructor(
    public readonly code: PizxErrorCode,
    message: string,
    options: { letter?: string; cause?: unknown } = {}
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'PizxError'
  }
}

/** Type guard — prefer this over message-prefix matching. */
export function isPizxError(err: unknown): err is PizxError {
  return err instanceof PizxError
}
