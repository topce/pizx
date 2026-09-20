/**
 * pizx typesafe service — typed, calibrated System One decisions from TypeSafe.
 *
 * Wraps the official `@typesafe-ai/sdk` `TypeSafeClient`, which answers named
 * typed questions (`choice` / `score` / `noul`) about a piece of state in a
 * single `POST /v1/systemone` call. The primitive letters (src/plugins/typesafe.ts)
 * and the pattern words (examples/plugins/fanout.mjs, …) both build on this
 * service, so a whole batch of questions shares one request and one trace span.
 *
 * The SDK is imported lazily and the client is built on first use: apps that
 * never touch TypeSafe still boot without a `TYPESAFE_API_KEY` (π/Π/α/ε keep
 * working) and don't pay the SDK import cost. Auth failures surface as
 * `PizxError('AUTH')`; API failures as `PizxError('TYPESAFE')`.
 */

import { type Context, Service } from '@cordisjs/core'
import type {
  EntryType,
  Questions,
  SystemOneResult,
  TypeSafeClient,
  TypeSafeClientConfig,
} from '@typesafe-ai/sdk'
import { isPizxError, PizxError } from './errors.ts'
import { getErrorMessage } from './utils.ts'

/** Jev input-token price in USD per million tokens ($42 per billion). Output is free. */
export const JEV_USD_PER_MTOK = 0.042

type SdkModule = typeof import('@typesafe-ai/sdk')

export interface TypeSafeConfig {
  /** API key; falls back to `TYPESAFE_API_KEY`. Get one at console.typesafe.ai/keys. */
  apiKey?: string
  /** API root; falls back to `TYPESAFE_BASE_URL`. */
  baseURL?: string
  /** Default model; falls back to `TYPESAFE_DEFAULT_MODEL`, then `jev-latest`. */
  defaultModel?: string
  /** Per-attempt timeout in ms. */
  timeoutMs?: number
  /** Extra request headers. */
  defaultHeaders?: Record<string, string>
  /** Pre-built client — for tests and advanced wiring. */
  client?: TypeSafeClient
  /** Custom fetch for the SDK client (transport configuration or tests). */
  fetch?: TypeSafeClientConfig['fetch']
}

export interface TypeSafeAskOptions {
  /** Model override; omitted values use the client default. */
  model?: string
  /** Per-attempt timeout override in ms. */
  timeoutMs?: number
  /** Cancellation signal. */
  signal?: AbortSignal
}

export interface TypeSafeModel {
  name: string
  description: string
  release_date: string
}

declare module '@cordisjs/core' {
  interface Context {
    typesafe: TypeSafe
  }
}

export class TypeSafe extends Service<TypeSafeConfig> {
  private _sdk: SdkModule | undefined
  private _client: TypeSafeClient | undefined
  private _clientPromise: Promise<TypeSafeClient> | undefined

  constructor(ctx: Context, config: TypeSafeConfig = {}) {
    super(ctx, 'typesafe')
    this.config = config
  }

  /** Whether a client can be built (a key, or an injected client). */
  get available(): boolean {
    if (this.config.client) return true
    if (this.config.apiKey !== undefined && this.config.apiKey.trim() !== '') return true
    const env = process.env.TYPESAFE_API_KEY
    return typeof env === 'string' && env.trim() !== ''
  }

  /**
   * Get (or build) the SDK client. Loads `@typesafe-ai/sdk` on first use and
   * memoizes both the module and the client. Throws `AUTH` when no key is set.
   */
  private async ensureClient(): Promise<TypeSafeClient> {
    if (this._client) return this._client
    if (this.config.client) {
      this._client = this.config.client
      return this._client
    }
    this._clientPromise ??= this.createClient()
    try {
      this._client = await this._clientPromise
      return this._client
    } finally {
      this._clientPromise = undefined
    }
  }

  private async createClient(): Promise<TypeSafeClient> {
    let sdk: SdkModule
    try {
      sdk = this._sdk ??= await import('@typesafe-ai/sdk')
    } catch (err) {
      throw new PizxError(
        'INTERNAL',
        `pizx/typesafe: failed to load @typesafe-ai/sdk — ${getErrorMessage(err)}`,
        { letter: 'typesafe', cause: err }
      )
    }
    try {
      return new sdk.TypeSafeClient({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
        defaultModel: this.config.defaultModel,
        timeout: this.config.timeoutMs,
        defaultHeaders: this.config.defaultHeaders,
        fetch: this.config.fetch,
      })
    } catch (err) {
      throw new PizxError(
        'AUTH',
        `pizx/typesafe: no TypeSafe API key. Set TYPESAFE_API_KEY or the apiKey option ` +
          `(get one at https://console.typesafe.ai/keys). ${getErrorMessage(err)}`,
        { letter: 'typesafe', cause: err }
      )
    }
  }

  /**
   * Ask one or more typed questions in a single System One call. Every question
   * sees the same `state`, is evaluated in parallel, and returns a typed answer
   * under its chosen name. Prefer batching every question your code might need.
   */
  async ask<const Q extends Questions>(
    state: EntryType,
    questions: Q,
    opts: TypeSafeAskOptions = {}
  ): Promise<SystemOneResult<Q>> {
    if (!questions || Object.keys(questions).length === 0) {
      throw new PizxError('VALIDATION', 'pizx/typesafe: at least one question is required', {
        letter: 'typesafe',
      })
    }
    const client = await this.ensureClient()
    const model = opts.model ?? this.config.defaultModel
    const t0 = Date.now()
    // The API requires a non-null `state` field (`null` or omitted is a 422).
    // Callers may pass null to mean "no state"; normalize it to an empty string.
    const stateToSend: EntryType = state ?? ''
    let result: SystemOneResult<Q>
    try {
      result = await client.systemOne(
        { state: stateToSend, questions, ...(model !== undefined ? { model } : {}) },
        { timeout: opts.timeoutMs, signal: opts.signal }
      )
    } catch (err) {
      throw mapTypeSafeError(err)
    }
    this.recordUsage(result, Date.now() - t0)
    return result
  }

  /** List the models available to the account. */
  async listModels(): Promise<TypeSafeModel[]> {
    const client = await this.ensureClient()
    try {
      return await client.models.list()
    } catch (err) {
      throw mapTypeSafeError(err)
    }
  }

  /** Record the call in the active trace span (mirrors Llm.recordUsage). */
  private recordUsage<const Q extends Questions>(
    result: SystemOneResult<Q>,
    durationMs: number
  ): void {
    const trace = this.ctx.get('trace')
    if (!trace?.enabled) return
    const inputTokens = result.usage?.input_tokens ?? 0
    const outputTokens = result.usage?.output_tokens ?? 0
    const event = {
      kind: 'llm-call' as const,
      modelId: result.model,
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: inputTokens + outputTokens,
      costUsd: (inputTokens / 1_000_000) * JEV_USD_PER_MTOK,
      durationMs,
    }
    // Inside a letter call → attach to that span; a direct `ctx.typesafe.ask()`
    // has no active span, so record a run-scoped event so the totals still add up.
    const span = trace.current()
    if (span) span.emit(event)
    else trace.record({ ...event, spanId: 'typesafe' })
  }
}

/** Read an error's class name without depending on a loaded SDK copy. */
function errorName(err: unknown): string {
  if (err instanceof Error) return err.constructor.name || err.name
  const name = (err as { name?: unknown })?.name
  return typeof name === 'string' ? name : ''
}

function errorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown })?.status
  return typeof status === 'number' ? status : undefined
}

/**
 * Map an SDK/unknown error onto pizx's stable structured error contract.
 *
 * Matched structurally by class name and HTTP status rather than `instanceof`,
 * so it works whether or not — and no matter which copy of — the SDK is loaded.
 */
export function mapTypeSafeError(err: unknown): PizxError {
  if (isPizxError(err)) return err
  const name = errorName(err)
  const status = errorStatus(err)

  if (
    name === 'AuthenticationError' ||
    name === 'PermissionDeniedError' ||
    status === 401 ||
    status === 403
  ) {
    return new PizxError(
      'AUTH',
      `pizx/typesafe: authentication failed — check TYPESAFE_API_KEY (${getErrorMessage(err)})`,
      { letter: 'typesafe', cause: err }
    )
  }
  if (
    name === 'BadRequestError' ||
    name === 'UnprocessableEntityError' ||
    status === 400 ||
    status === 422
  ) {
    return new PizxError('VALIDATION', `pizx/typesafe: invalid request — ${getErrorMessage(err)}`, {
      letter: 'typesafe',
      cause: err,
    })
  }
  if (name === 'APIUserAbortError') {
    return new PizxError('CANCELLED', 'pizx/typesafe: request cancelled', {
      letter: 'typesafe',
      cause: err,
    })
  }
  if (name === 'APITimeoutError') {
    const timeoutMs = (err as { timeoutMs?: unknown })?.timeoutMs
    const after = typeof timeoutMs === 'number' ? ` after ${timeoutMs}ms` : ''
    return new PizxError('TYPESAFE', `pizx/typesafe: request timed out${after}`, {
      letter: 'typesafe',
      cause: err,
    })
  }
  if (name === 'APIConnectionError') {
    return new PizxError('TYPESAFE', `pizx/typesafe: connection failed — ${getErrorMessage(err)}`, {
      letter: 'typesafe',
      cause: err,
    })
  }
  if (name === 'RateLimitError' || status === 429) {
    const retryAfterMs = (err as { retryAfterMs?: unknown })?.retryAfterMs
    const retry = typeof retryAfterMs === 'number' ? ` (retry after ${retryAfterMs}ms)` : ''
    return new PizxError('TYPESAFE', `pizx/typesafe: rate limited${retry}`, {
      letter: 'typesafe',
      cause: err,
    })
  }
  if (typeof status === 'number') {
    return new PizxError(
      'TYPESAFE',
      `pizx/typesafe: API error ${status} — ${getErrorMessage(err)}`,
      { letter: 'typesafe', cause: err }
    )
  }
  if (name === 'TypeSafeError') {
    return new PizxError('TYPESAFE', `pizx/typesafe: ${getErrorMessage(err)}`, {
      letter: 'typesafe',
      cause: err,
    })
  }
  return new PizxError('INTERNAL', `pizx/typesafe: ${getErrorMessage(err)}`, {
    letter: 'typesafe',
    cause: err,
  })
}
