/**
 * π (small pi) — pi-ai text generation as a zx-style template tag.
 *
 *   const answer = await π`what is 7! + 5?`
 *   const answer = await π({ model: 'anthropic/claude-sonnet-4-5' })`explain`
 *   const answer = await π.quiet()`generate JSON`
 *   for await (const c of π.stream`tell me a story`) { process.stdout.write(c) }
 */

import {
  type Context,
  type SimpleStreamOptions,
  streamSimple,
  type ThinkingBudgets,
  type ThinkingLevel,
} from '@earendil-works/pi-ai'
import { PiOutput } from './pi-output.ts'

export { PiOutput }

import { pickModel } from './model-picker.ts'
import type { CallTrace } from './patterns/types.ts'
import { build } from './patterns/types.ts'
import { getErrorMessage } from './utils.ts'

export interface PiOptions {
  model?: string
  thinkingLevel?: ThinkingLevel
  /** Token budgets per thinking level (token-based providers only). */
  thinkingBudgets?: ThinkingBudgets
  quiet?: boolean
  system?: string
  /** Text appended after the system prompt. */
  appendSystemPrompt?: string
  maxTokens?: number
  /** Timeout in milliseconds for each LLM call. Default: provider SDK default. */
  timeoutMs?: number
  /** Maximum retry attempts for transient failures. Default: provider SDK default (typically 2). */
  maxRetries?: number
}

const defaults: PiOptions = {
  thinkingLevel: 'medium' as ThinkingLevel,
  quiet: false,
  maxTokens: 4096,
}

function makeContext(pieces: TemplateStringsArray, args: unknown[], opts: PiOptions): Context {
  const systemParts: string[] = []
  if (opts.system) systemParts.push(opts.system)
  if (opts.appendSystemPrompt) systemParts.push(opts.appendSystemPrompt)
  return {
    systemPrompt: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: [
      {
        role: 'user' as const,
        content: build(pieces, args),
        timestamp: Date.now(),
      },
    ],
  }
}

function makeOpts(opts: PiOptions): SimpleStreamOptions {
  return {
    maxTokens: opts.maxTokens,
    reasoning: opts.thinkingLevel,
    thinkingBudgets: opts.thinkingBudgets,
    timeoutMs: opts.timeoutMs,
    maxRetries: opts.maxRetries,
  }
}

async function run(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: PiOptions
): Promise<PiOutput> {
  const model = pickModel(opts.model)
  if (!model) throw new Error('pizx/π: No AI models configured. Run `pi auth login` first.')

  const t0 = Date.now()
  let text = ''
  let traceEntry: CallTrace | undefined
  try {
    for await (const ev of streamSimple(model, makeContext(pieces, args, opts), makeOpts(opts))) {
      if (ev.type === 'text_delta') {
        text += ev.delta
        if (!opts.quiet) process.stdout.write(ev.delta)
      } else if (ev.type === 'done') {
        const msg = (
          ev as {
            message?: {
              usage?: {
                input: number
                output: number
                cacheRead: number
                cacheWrite: number
                totalTokens: number
                cost: { total: number }
              }
            }
          }
        ).message
        if (msg?.usage) {
          traceEntry = {
            call: 1,
            modelId: model.id,
            promptPreview: build(pieces, args).slice(0, 200),
            outputPreview: text.slice(0, 200),
            inputTokens: msg.usage.input,
            outputTokens: msg.usage.output,
            cacheReadTokens: msg.usage.cacheRead,
            cacheWriteTokens: msg.usage.cacheWrite,
            totalTokens: msg.usage.totalTokens,
            cost: msg.usage.cost.total,
            durationMs: Date.now() - t0,
          }
        }
      }
    }
  } catch (err) {
    throw new Error(`pizx/π: AI generation failed: ${getErrorMessage(err)}`)
  }
  if (!opts.quiet && text) process.stdout.write('\n')
  const output = new PiOutput(text.trim(), model.id, [], t0, Date.now())
  if (traceEntry) output.trace = [traceEntry]
  return output
}

async function* runStream(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: PiOptions
): AsyncGenerator<string> {
  const model = pickModel(opts.model)
  if (!model) throw new Error('pizx/π: No AI models configured')
  for await (const ev of streamSimple(model, makeContext(pieces, args, opts), makeOpts(opts))) {
    if (ev.type === 'text_delta') yield ev.delta
  }
}

// ── PiPromise ───────────────────────────────────────────────────────────────

export class PiPromise extends Promise<PiOutput> {
  private _modelId = ''
  constructor(fn: (r: (v: PiOutput) => void, rj: (e: unknown) => void) => void, modelId?: string) {
    super(fn)
    if (modelId) this._modelId = modelId
  }
  get modelUsed() {
    return this._modelId
  }
}

// ── π tag type ──────────────────────────────────────────────────────────────

interface PiFn {
  (pieces: TemplateStringsArray, ...args: unknown[]): PiPromise
  (opts: Partial<PiOptions>): PiFn
  quiet: PiFn
  stream(pieces: TemplateStringsArray, ...args: unknown[]): AsyncGenerator<string>
}

function makePi(opts: Partial<PiOptions> = {}): PiFn {
  const merged = { ...defaults, ...opts }

  const fn = ((
    pieces: TemplateStringsArray | Partial<PiOptions>,
    ...args: unknown[]
  ): PiPromise | PiFn => {
    // π({ model: 'x' })
    if (!Array.isArray(pieces)) {
      return makePi({ ...merged, ...(pieces as Partial<PiOptions>) })
    }
    // π`template`
    return new PiPromise((resolve, reject) => {
      run(pieces as TemplateStringsArray, args, merged).then(resolve, reject)
    })
  }) as unknown as PiFn

  // Lazy quiet
  let _quiet: PiFn | undefined
  Object.defineProperty(fn, 'quiet', {
    get(): PiFn {
      if (!_quiet) _quiet = makePi({ ...merged, quiet: true })
      return _quiet
    },
    enumerable: true,
    configurable: true,
  })

  fn.stream = async function* stream_pi(pieces: TemplateStringsArray, ...args: unknown[]) {
    yield* runStream(pieces, args, merged)
  } as unknown as PiFn['stream']

  return fn
}

/** π template tag — call pi-ai for text generation */
export const π: PiFn = makePi()

export function configurePi(opts: Partial<PiOptions>): void {
  Object.assign(defaults, opts)
}
