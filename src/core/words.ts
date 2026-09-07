/**
 * pizx words service — the composition layer over letters.
 *
 * A letter is a plugin that registers a template tag (π text, Π agent, α ACP
 * agent). A *word* is an AI pattern — a fixed shape (loop, parallel fan-out,
 * pipeline, …) whose positions are filled by letters. Words are themselves
 * letters, so they compose recursively: letters → words → sentences → a whole
 * script.
 *
 * The key idea: a word's letters live in replaceable *slots*. A slot is either
 * a registered letter name (`'α'`) or a direct tag (`Π`). Operators resolve
 * names through `ctx.letters` at call time, so the same word runs against
 * different letters — `ralph({ execute: 'α' })` swaps the execution step from
 * the Π agent to any ACP agent without changing the pattern.
 */

import { type Context, Service } from '@cordisjs/core'
import Schema from 'schemastery'
import { PizxError } from './errors.ts'
import type { LetterEnv, LetterFn, LetterOutput } from './tags.ts'
import { getErrorMessage } from './utils.ts'

/** A slot value: a registered letter name, or a letter tag directly. */
export type LetterRef = string | LetterFn

/**
 * Letter options a word may forward to its slot letters. Word schemas are
 * loose (schemastery keeps extra keys), so any of these can be passed to a
 * word without declaring them; `slotOptions` picks the recognized ones out.
 */
const LETTER_OPTION_KEYS = [
  'model',
  'thinkingLevel',
  'thinkingBudgets',
  'system',
  'appendSystemPrompt',
  'maxTokens',
  'timeoutMs',
  'maxRetries',
  'apiKey',
  'cwd',
  'env',
  'server',
  'harness',
  'tools',
  'excludeTools',
  'skills',
] as const

/** A per-item result from a parallel fan-out. */
export interface WordResult {
  /** The input prompt given to this fan-out member. */
  input: string
  /** The letter output, when the member succeeded. */
  output: LetterOutput | undefined
  /** True when the member resolved without throwing. */
  ok: boolean
  /** Error message, when the member failed. */
  error?: string
}

/** The result of a generic loop. */
export interface LoopResult<T> {
  /** The per-iteration results, in order. */
  results: T[]
  /** Number of iterations actually run. */
  iterations: number
  /** True when the `until` predicate stopped the loop before `maxIterations`. */
  terminatedEarly: boolean
}

export interface WordDefinition<TOpts = Record<string, unknown>> {
  /** Extra names the word answers to. */
  aliases?: string[]
  /** One-line description shown in `pizx --letters`. */
  description?: string
  /** Default slot bindings: role → letter name or tag. */
  slots?: Record<string, LetterRef>
  /** Extra (non-slot) option schemas, merged with the auto-generated slot fields. */
  options?: Record<string, unknown>
  /**
   * Whether this word's results may be served from the cache. Default false:
   * words compose agents by default (side effects), so they are never cached
   * unless a pure word opts in.
   */
  cacheable?: boolean
  /** Compose the slot letters into the word's pattern. */
  run(
    prompt: string,
    opts: TOpts,
    env: LetterEnv
  ): LetterOutput | string | Promise<LetterOutput | string>
}

declare module '@cordisjs/core' {
  interface Context {
    words: Words
  }
}

/** A schemastery schema for a slot: a letter name (string) or a tag (function). */
export function slotSchema(defaultRef: LetterRef) {
  return Schema.union([Schema.string(), Schema.function()]).default(defaultRef)
}

/** Wrap a plain string as a TemplateStringsArray for programmatic tag calls. */
function asPieces(prompt: string): TemplateStringsArray {
  return Object.assign([prompt], { raw: [prompt] })
}

export class Words extends Service {
  static inject = ['letters']

  constructor(ctx: Context) {
    super(ctx, 'words')
  }

  /** Resolve a slot ref to a callable letter tag. */
  resolve(ref: LetterRef): LetterFn {
    if (typeof ref === 'function') return ref
    const tag = this.ctx.letters.get(ref)
    if (!tag) {
      throw new PizxError('VALIDATION', `pizx/words: slot letter '${ref}' is not registered`, {
        letter: ref,
      })
    }
    return tag
  }

  /** Invoke a slot letter with a prompt and per-call options; return its output. */
  async call(
    ref: LetterRef,
    prompt: string,
    opts: Record<string, unknown> = {}
  ): Promise<LetterOutput> {
    return await this.resolve(ref)(opts)(asPieces(prompt))
  }

  /**
   * Fan one slot letter out over many inputs, `concurrency` at a time.
   * Failures are captured per item (never thrown), so one bad member does not
   * sink the fleet.
   */
  async parallel(
    ref: LetterRef,
    inputs: string[],
    opts: { concurrency?: number; options?: Record<string, unknown> } = {}
  ): Promise<WordResult[]> {
    const { concurrency = 5, options = {} } = opts
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new PizxError(
        'VALIDATION',
        `pizx/words: parallel concurrency must be a positive integer (got ${String(concurrency)})`,
        { letter: String(ref) }
      )
    }
    const tag = this.resolve(ref)
    const results: WordResult[] = []
    for (let i = 0; i < inputs.length; i += concurrency) {
      const batch = inputs.slice(i, i + concurrency)
      const settled = await Promise.allSettled(batch.map((input) => tag(options)(asPieces(input))))
      settled.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          results.push({ input: batch[idx], output: r.value, ok: true })
        } else {
          results.push({
            input: batch[idx],
            output: undefined,
            ok: false,
            error: getErrorMessage(r.reason),
          })
        }
      })
    }
    return results
  }

  /**
   * Extract the subset of a word's options that letters understand, for
   * forwarding to slot calls. `quiet` is intentionally excluded — slot calls
   * should stay quiet and let the word own its status output.
   */
  slotOptions(opts: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const key of LETTER_OPTION_KEYS) {
      if (opts[key] !== undefined) out[key] = opts[key]
    }
    return out
  }

  /**
   * Run `body` up to `maxIterations` times, stopping early when `until` is
   * satisfied. Returns every iteration's result plus the stop reason.
   */
  async loop<T>(
    body: (iteration: number) => Promise<T>,
    until: (result: T, iteration: number) => boolean | Promise<boolean>,
    maxIterations: number
  ): Promise<LoopResult<T>> {
    if (!Number.isInteger(maxIterations) || maxIterations < 1) {
      throw new PizxError(
        'VALIDATION',
        `pizx/words: loop maxIterations must be a positive integer (got ${String(maxIterations)})`
      )
    }
    const results: T[] = []
    for (let i = 1; i <= maxIterations; i++) {
      const result = await body(i)
      results.push(result)
      if (await until(result, i)) return { results, iterations: i, terminatedEarly: true }
    }
    return { results, iterations: results.length, terminatedEarly: false }
  }

  /**
   * Register a word. Builds the letter schema by merging one slot field per
   * declared slot (string name or tag) with any extra option schemas, then
   * registers the word as an ordinary letter — so it gets option chaining,
   * `.quiet`/`.cache`/`.stream`, tracing, and recursive composition for free.
   */
  define<TOpts extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    def: WordDefinition<TOpts>
  ): LetterFn<TOpts> {
    const fields: Record<string, unknown> = {}
    for (const [role, defaultRef] of Object.entries(def.slots ?? {})) {
      fields[role] = slotSchema(defaultRef)
    }
    Object.assign(fields, def.options ?? {})

    return this.ctx.letters.define<TOpts>(name, {
      aliases: def.aliases,
      description: def.description,
      options: Schema.object(fields) as unknown as (value: unknown) => TOpts,
      cacheable: def.cacheable ?? false,
      run: (prompt, opts, env) => def.run(prompt, opts, env),
    })
  }
}
