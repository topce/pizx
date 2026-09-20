/**
 * pizx tag factory — turns a LetterDefinition into a zx-style template tag.
 *
 * Every letter gets the same DX: option chaining, .quiet / .cache variants,
 * a .stream generator when the definition provides one, and a LetterOutput
 * result carrying the invocation's trace. The runner opens a trace span per
 * invocation and applies the content-addressed cache for cacheable letters.
 */

import type { Context } from '@cordisjs/core'
import { isPizxError, PizxError } from './errors.ts'
import type { LlmCallEvent, Trace, TraceSpan } from './trace.ts'
import { build, getErrorMessage } from './utils.ts'

// ── Output ──────────────────────────────────────────────────────────────────

/** The result object returned by every letter tag. */
export class LetterOutput {
  private _trace: LlmCallEvent[] = []
  private _modelId: string | undefined
  private _fromCache: boolean
  private _turnCount: number | undefined
  private _answer: unknown

  constructor(
    /** Full result text */
    public readonly text: string,
    /** Model id that produced the output, when known */
    modelId?: string,
    /** True when served from the local cache (no LLM call was made) */
    fromCache: boolean = false,
    /** Start timestamp (ms) */
    public readonly startTime: number = Date.now(),
    /** End timestamp (ms) */
    public readonly endTime: number = Date.now()
  ) {
    this._modelId = modelId
    this._fromCache = fromCache
  }

  /** Model id that produced the output, when known. */
  get modelId(): string | undefined {
    return this._modelId
  }

  /** @deprecated Use {@link modelId} instead. */
  get modelUsed(): string | undefined {
    return this._modelId
  }

  /** LLM calls made during this invocation (filled by the runner). */
  get trace(): readonly LlmCallEvent[] {
    return this._trace
  }

  /** True when served from the local cache (no LLM call was made). */
  get isFromCache(): boolean {
    return this._fromCache
  }

  /** @deprecated Use {@link isFromCache} instead. */
  get fromCache(): boolean {
    return this._fromCache
  }

  /** Number of agent turns (agent letters only; undefined otherwise). */
  get turnCount(): number | undefined {
    return this._turnCount
  }

  /**
   * Structured answer for letters that return typed data rather than prose
   * (the TypeSafe `choice`/`score`/`noul` letters, and the pattern words built
   * on them). `undefined` for text-only letters like π/Π/α/ε.
   */
  get answer(): unknown {
    return this._answer
  }

  /**
   * Attach a structured answer to this result (used by the TypeSafe letters and
   * the pattern words built on them). Returns `this` for chaining.
   */
  withAnswer(answer: unknown): this {
    this._answer = answer
    return this
  }

  /** @internal — attach the invocation span's trace and model. */
  _attach(span: TraceSpan): this {
    this._trace = [...span.llmCalls]
    if (this._modelId === undefined && span.model) this._modelId = span.model
    return this
  }

  /** @internal — record the agent turn count (agent letters only). */
  _setTurnCount(count: number): this {
    this._turnCount = count
    return this
  }

  get duration(): number {
    return this.endTime - this.startTime
  }

  get inputTokens(): number {
    return this._trace.reduce((s, t) => s + t.inputTokens, 0)
  }

  get outputTokens(): number {
    return this._trace.reduce((s, t) => s + t.outputTokens, 0)
  }

  get cacheReadTokens(): number {
    return this._trace.reduce((s, t) => s + t.cacheReadTokens, 0)
  }

  get cacheWriteTokens(): number {
    return this._trace.reduce((s, t) => s + t.cacheWriteTokens, 0)
  }

  get totalTokens(): number {
    return this._trace.reduce((s, t) => s + t.totalTokens, 0)
  }

  get totalCost(): number {
    return this._trace.reduce((s, t) => s + t.costUsd, 0)
  }

  get cacheHits(): number {
    return this._trace.length === 0 && this._fromCache ? 1 : 0
  }

  toString(): string {
    return this.text
  }

  valueOf(): string {
    return this.text
  }

  [Symbol.toPrimitive](): string {
    return this.text
  }

  get length(): number {
    return this.text.length
  }

  get lines(): number {
    return this.text.split('\n').length
  }
}

/** A Promise resolving to a LetterOutput. */
export class LetterPromise extends Promise<LetterOutput> {}

// ── Definition & function types ─────────────────────────────────────────────

/** Environment handed to a letter's run()/stream() implementation. */
export interface LetterEnv {
  /** The application context — reach services via ctx.llm, ctx.trace, ctx.cache. */
  ctx: Context
  /** Raw template pieces. */
  pieces: TemplateStringsArray
  /** Raw interpolated arguments. */
  args: unknown[]
  /** This invocation's trace span (undefined when tracing is disabled). */
  span?: TraceSpan
}

export interface LetterDefinition<TOpts = Record<string, unknown>> {
  /** Extra names this letter answers to (e.g. ['pi', 'ai']). */
  aliases?: string[]
  /** One-line description shown in CLI help. */
  description?: string
  /**
   * Option validator applied at the boundary. A schemastery schema works
   * directly: it validates, fills defaults, and types TOpts.
   */
  options?: (value: any) => TOpts
  /**
   * Whether this letter's results may be served from the local result cache.
   * Default true (cacheable); set false for side-effectful letters.
   */
  cacheable?: boolean
  /** @deprecated Use `cacheable: false` to mark a side-effectful letter non-cacheable. */
  cache?: false
  /** Execute the letter. Return text or a LetterOutput. */
  run(
    prompt: string,
    opts: TOpts,
    env: LetterEnv
  ): string | LetterOutput | Promise<string | LetterOutput>
  /** Optional streaming implementation (enables `letter.stream`). */
  stream?(
    prompt: string,
    opts: TOpts,
    env: LetterEnv
  ): AsyncGenerator<string> | AsyncIterable<string>
}

/** Signature for a registered letter tag. */
export interface LetterFn<TOpts = Record<string, unknown>> {
  (pieces: TemplateStringsArray, ...args: unknown[]): LetterPromise
  (opts: Partial<TOpts>): LetterFn<TOpts>
  quiet: LetterFn<TOpts>
  cache: LetterFn<TOpts>
  stream(pieces: TemplateStringsArray, ...args: unknown[]): AsyncGenerator<string>
}

// ── Runner ──────────────────────────────────────────────────────────────────

/**
 * Apply a letter's option validator at the boundary. Validation failures
 * (schemastery schemas included) are normalized to `PizxError('VALIDATION')`,
 * so every letter — words included — reports bad usage through the same
 * machine-readable contract instead of a mix of foreign error shapes.
 */
function applyOptions(
  def: LetterDefinition,
  rawOpts: Record<string, unknown>
): Record<string, unknown> {
  if (!def.options) return rawOpts
  try {
    return def.options(rawOpts)
  } catch (err) {
    if (isPizxError(err)) throw err
    throw new PizxError('VALIDATION', getErrorMessage(err), { cause: err })
  }
}

interface RunResult {
  output: LetterOutput
  fromCache: boolean
}

/**
 * What a memoized letter invocation stores. `answer` carries structured output
 * (TypeSafe letters/words), `modelId` the model that produced it; legacy
 * entries are bare strings.
 */
type CachedLetterValue = string | { text: string; answer?: unknown; modelId?: string }

/** Rebuild a LetterOutput from a cache value (string legacy or payload). */
function letterOutputFromCache(value: CachedLetterValue, t0: number): LetterOutput {
  const text = typeof value === 'string' ? value : value.text
  const modelId = typeof value === 'object' ? value.modelId : undefined
  const output = new LetterOutput(text, modelId, true, t0, Date.now())
  if (typeof value === 'object' && value.answer !== undefined) output.withAnswer(value.answer)
  return output
}

async function runLetter(
  ctx: Context,
  name: string,
  def: LetterDefinition,
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: Record<string, unknown>,
  rawOpts: Record<string, unknown>
): Promise<RunResult> {
  const prompt = build(pieces, args)
  const trace = ctx.get('trace')
  const cache = ctx.get('cache')
  const span = trace?.enabled
    ? trace.span(name, prompt, opts.model as string | undefined)
    : undefined
  const env: LetterEnv = { ctx, pieces, args, span }

  const cacheable = def.cacheable ?? def.cache !== false
  const cacheWanted =
    cacheable && (rawOpts.cache === true || (rawOpts.cache !== false && (cache?.enabled ?? false)))

  const t0 = Date.now()
  let output: LetterOutput
  let fromCache = false

  try {
    if (cacheWanted && cache) {
      const key = cache.key({
        letter: name,
        model: (opts.model as string | undefined) ?? '',
        system: opts.system as string | undefined,
        prompt,
        opts,
      })
      const hit = await cache.get<CachedLetterValue>(key)
      if (hit) {
        span?.emit({ kind: 'cache-hit', key })
        output = letterOutputFromCache(hit.value, t0)
        fromCache = true
      } else {
        span?.emit({ kind: 'cache-miss', key })
        output = await execute(trace, def, prompt, opts, env, span, t0)
        const payload: CachedLetterValue =
          output.answer !== undefined || output.modelId !== undefined
            ? {
                text: output.text,
                ...(output.modelId !== undefined ? { modelId: output.modelId } : {}),
                ...(output.answer !== undefined ? { answer: output.answer } : {}),
              }
            : output.text
        await cache.set(key, payload)
      }
    } else {
      output = await execute(trace, def, prompt, opts, env, span, t0)
    }
    span?.end('ok', output.text, fromCache)
    return { output, fromCache }
  } catch (err) {
    const message = getErrorMessage(err)
    span?.emit({ kind: 'error', message })
    span?.end('error', message, fromCache)
    throw err
  }
}

async function execute(
  trace: Trace | undefined,
  def: LetterDefinition,
  prompt: string,
  opts: Record<string, unknown>,
  env: LetterEnv,
  span: TraceSpan | undefined,
  t0: number
): Promise<LetterOutput> {
  const run = () => def.run(prompt, opts, env)
  const result = await (span && trace ? trace.within(span, run) : run())
  if (result instanceof LetterOutput) {
    if (span) result._attach(span)
    return result
  }
  const output = new LetterOutput(result, span?.model, false, t0, Date.now())
  if (span) output._attach(span)
  return output
}

// ── Tag factory ─────────────────────────────────────────────────────────────

/**
 * Build a letter tag from a definition. Option chaining, .quiet, .cache and
 * .stream all come from this single factory.
 */
export function createLetterTag<T extends Record<string, unknown> = Record<string, unknown>>(
  ctx: Context,
  name: string,
  def: LetterDefinition<T>,
  baseOpts: Record<string, unknown> = {}
): LetterFn<T> {
  function make(base: Record<string, unknown>): LetterFn<T> {
    const fn = ((
      pieces: TemplateStringsArray | Record<string, unknown>,
      ...args: unknown[]
    ): LetterPromise | LetterFn<T> => {
      if (!Array.isArray(pieces)) {
        return make({ ...base, ...pieces })
      }
      const rawOpts = { ...base }
      const opts = applyOptions(def, rawOpts)
      return new LetterPromise((resolve, reject) => {
        runLetter(ctx, name, def, pieces as TemplateStringsArray, args, opts, rawOpts).then(
          (r) => resolve(r.output),
          reject
        )
      })
    }) as unknown as LetterFn<T>

    for (const [variant, value] of [
      ['quiet', { ...base, quiet: true }],
      ['cache', { ...base, cache: true }],
    ] as const) {
      Object.defineProperty(fn, variant, {
        get: () => make(value),
        enumerable: true,
        configurable: true,
      })
    }

    fn.stream = async function* streamLetter(
      pieces: TemplateStringsArray,
      ...args: unknown[]
    ): AsyncGenerator<string> {
      if (!def.stream) {
        throw new PizxError('VALIDATION', `pizx: letter '${name}' does not support streaming`)
      }
      const rawOpts = { ...base }
      const opts = applyOptions(def, rawOpts)
      const prompt = build(pieces, args)
      const trace = ctx.get('trace')
      const span = trace?.enabled
        ? trace.span(name, prompt, opts.model as string | undefined)
        : undefined
      const env: LetterEnv = { ctx, pieces, args, span }
      const run = () => {
        if (!def.stream) {
          throw new PizxError('VALIDATION', `pizx: letter '${name}' does not support streaming`)
        }
        return def.stream(prompt, opts as never, env)
      }
      try {
        yield* span && trace ? trace.within(span, run) : run()
        span?.end('ok', '', false)
      } catch (err) {
        const message = getErrorMessage(err)
        span?.emit({ kind: 'error', message })
        span?.end('error', message)
        throw err
      }
    }

    return fn
  }

  return make(baseOpts)
}

// ── Forwarding tag (for default-app exports) ────────────────────────────────

type LetterGetter = (name: string) => Promise<LetterFn | undefined>

/**
 * A tag that forwards every call to a lazily-resolved target tag. Used by the
 * main entry to expose π/Π without booting the app until first use.
 */
export function forwardTag(
  name: string,
  getLetter: LetterGetter,
  baseOpts: Record<string, unknown> = {}
): LetterFn {
  function make(base: Record<string, unknown>): LetterFn {
    const fn = ((
      pieces: TemplateStringsArray | Record<string, unknown>,
      ...args: unknown[]
    ): LetterPromise | LetterFn => {
      if (!Array.isArray(pieces)) {
        return make({ ...base, ...pieces })
      }
      return new LetterPromise((resolve, reject) => {
        getLetter(name)
          .then((tag) => {
            if (!tag) {
              throw new PizxError(
                'VALIDATION',
                `pizx: letter '${name}' is not registered (missing plugin?)`
              )
            }
            // Re-apply the chained options onto the resolved target. Without this,
            // named-import usage (π({ model })) would silently drop every option.
            return tag({ ...base })(pieces as TemplateStringsArray, ...args)
          })
          .then(resolve, reject)
      })
    }) as unknown as LetterFn

    for (const [variant, value] of [
      ['quiet', { ...base, quiet: true }],
      ['cache', { ...base, cache: true }],
    ] as const) {
      Object.defineProperty(fn, variant, {
        get: () => make(value),
        enumerable: true,
        configurable: true,
      })
    }

    fn.stream = async function* streamForward(
      pieces: TemplateStringsArray,
      ...args: unknown[]
    ): AsyncGenerator<string> {
      const tag = await getLetter(name)
      if (!tag) {
        throw new PizxError(
          'VALIDATION',
          `pizx: letter '${name}' is not registered (missing plugin?)`
        )
      }
      yield* tag({ ...base }).stream(pieces, ...args)
    }

    return fn
  }

  return make(baseOpts)
}
