/**
 * Shared types for all pizx agent patterns (Ρ, Φ, Σ, Δ, Λ, Ψ, Ω).
 *
 * Each pattern follows the same conventions as the existing π and Π tags:
 * template literal call, function chaining for options, .quiet variant,
 * and a typed result object.
 */

import type { ThinkingBudgets, ThinkingLevel } from '@earendil-works/pi-ai'

// ── Common options ──────────────────────────────────────────────────────────

/** Options shared by all pattern tags. Each pattern extends this. */
export interface PatternOptions {
  /** Model id for all phases (fallback if per-phase models not specified). */
  model?: string
  /** Model for high-level reasoning phases: planning, analysis, synthesis, critique. */
  plannerModel?: string
  /** Model for execution/worker phases: sub-tasks, perspectives, pipeline stages. */
  workerModel?: string
  /** Thinking level for reasoning models */
  thinkingLevel?: ThinkingLevel
  /** Suppress streaming output to stdout/stderr */
  quiet?: boolean
  /** Max tokens for each LLM call */
  maxTokens?: number
  /** System prompt context */
  system?: string
  /** Timeout in milliseconds for each LLM call. Default: provider SDK default (typically 10 min). */
  timeoutMs?: number
  /** Maximum retry attempts for transient failures (network errors, rate limits). Default: provider SDK default (typically 2). */
  maxRetries?: number
  /** Token budgets per thinking level (token-based providers only). */
  thinkingBudgets?: ThinkingBudgets
  /** Skill names to load and inject as system context (e.g. ['code-simplification']). */
  skills?: string[]
  /** If true, pause before the first major execution phase and ask for confirmation via stdin. Default: false */
  confirm?: boolean
  /** API key to use for the provider (bypasses environment variable lookup). */
  apiKey?: string
}

// ── Execution trace ─────────────────────────────────────────────────────────

/** A task that can be either a plain string (LLM call) or a lazy pattern call receiving previous output. */
export type TaskDescriptor = string | ((previousOutput: string) => Promise<string>)

/** A single LLM call recorded during pattern execution. */
export interface CallTrace {
  /** Auto-indexed call number (1-based) */
  call: number
  /** Model id used for this call */
  modelId: string
  /** First 200 chars of the prompt */
  promptPreview: string
  /** First 200 chars of the output */
  outputPreview: string
  /** Input tokens consumed */
  inputTokens: number
  /** Output tokens generated */
  outputTokens: number
  /** Cache read tokens */
  cacheReadTokens: number
  /** Cache write tokens */
  cacheWriteTokens: number
  /** Total tokens (input + output) */
  totalTokens: number
  /** Cost in USD */
  cost: number
  /** Duration of this call in ms */
  durationMs: number
}

// ── Base output class ───────────────────────────────────────────────────────

/** A single structured phase entry in a pattern execution. */
export interface PhaseEntry {
  /** Phase name — e.g. 'plan', 'decompose', 'execute', 'synthesize', 'review' */
  phase: string
  /** Duration of this phase in milliseconds */
  durationMs: number
  /** Brief description of what happened */
  description: string
  /** The model used for this phase, if any */
  modelUsed?: string
  /** How many LLM calls this phase made */
  callCount?: number
}

/**
 * Base output for all pattern tags.
 * Provides common fields and coercion methods like PiOutput/AgentOutput.
 */
export class PatternOutput {
  /** Execution trace: one entry per LLM call within this pattern run. Populated by createPatternTag. */
  public trace: CallTrace[] = []
  /** Structured phase log: key phases during execution, populated by each pattern. */
  public phaseLog: PhaseEntry[] = []

  constructor(
    /** Full text result from the pattern execution */
    public readonly text: string,
    /** Start timestamp (ms) */
    public readonly startTime: number = Date.now(),
    /** End timestamp (ms) */
    public readonly endTime: number = Date.now()
  ) {}

  /** Duration in milliseconds */
  get duration(): number {
    return this.endTime - this.startTime
  }

  /** Total input tokens across all calls */
  get inputTokens(): number {
    return this.trace.reduce((s, t) => s + t.inputTokens, 0)
  }

  /** Total output tokens across all calls */
  get outputTokens(): number {
    return this.trace.reduce((s, t) => s + t.outputTokens, 0)
  }

  /** Total tokens (input + output) across all calls */
  get totalTokens(): number {
    return this.trace.reduce((s, t) => s + t.totalTokens, 0)
  }

  /** Total cost in USD across all calls */
  get totalCost(): number {
    return this.trace.reduce((s, t) => s + t.cost, 0)
  }

  /** Number of LLM calls made during this pattern execution */
  get callCount(): number {
    return this.trace.length
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
}

// ── Pattern function interface ─────────────────────────────────────────────

/** A pattern that supports template-tag invocation and option chaining. */
export interface PatternFn<TOptions extends PatternOptions, TOutput extends PatternOutput> {
  (pieces: TemplateStringsArray, ...args: unknown[]): PatternPromise<TOutput>
  (opts: Partial<TOptions>): PatternFn<TOptions, TOutput>
  quiet: PatternFn<TOptions, TOutput>
}

/** A Promise that resolves to a pattern output. */
export class PatternPromise<TOutput extends PatternOutput> extends Promise<TOutput> {}

// ── Tag factory ────────────────────────────────────────────────────────────

/**
 * Create a pattern tag with option chaining and .quiet support.
 *
 * Every pattern tag (Φ, Σ, Δ, Λ, Ψ, Ω, Ρ, Θ, Μ, Β, Α, Γ, Ν, Χ, Τ)
 * uses this single factory instead of duplicating the same ~30 lines
 * of option-chaining boilerplate.
 */
// ── Trace accumulator (module-level, managed by createPatternTag) ───────────

let _trace: CallTrace[] | null = null

function beginTrace(): void {
  _trace = []
}

function collectTrace(): CallTrace[] {
  const t = _trace ?? []
  _trace = null
  return t
}

function pushTrace(entry: CallTrace): void {
  if (_trace) _trace.push(entry)
}

export function createPatternTag<TOptions extends PatternOptions, TOutput extends PatternOutput>(
  defaults: TOptions,
  execute: (pieces: TemplateStringsArray, args: unknown[], opts: TOptions) => Promise<TOutput>
): PatternFn<TOptions, TOutput> {
  function make(opts: Partial<TOptions> = {}): PatternFn<TOptions, TOutput> {
    const merged = { ...defaults, ...opts }

    const fn = ((
      pieces: TemplateStringsArray | Partial<TOptions>,
      ...args: unknown[]
    ): PatternPromise<TOutput> | PatternFn<TOptions, TOutput> => {
      if (!Array.isArray(pieces)) {
        return make({ ...merged, ...(pieces as Partial<TOptions>) })
      }
      beginTrace()
      return new PatternPromise((resolve, reject) => {
        execute(pieces as TemplateStringsArray, args, merged).then(
          (output) => {
            output.trace = collectTrace()
            resolve(output)
          },
          (err) => {
            collectTrace() // discard trace on error
            reject(err)
          }
        )
      })
    }) as unknown as PatternFn<TOptions, TOutput>

    let _quiet: PatternFn<TOptions, TOutput> | undefined
    Object.defineProperty(fn, 'quiet', {
      get(): PatternFn<TOptions, TOutput> {
        if (!_quiet) _quiet = make({ ...merged, quiet: true })
        return _quiet
      },
      enumerable: true,
      configurable: true,
    })

    return fn
  }

  return make()
}

// ── Utility: build template string ─────────────────────────────────────────

/** Build a string from a template literal with interpolated values. */
export function build(pieces: TemplateStringsArray, args: unknown[]): string {
  let s = ''
  for (let i = 0; i < pieces.length; i++) {
    s += pieces[i]
    if (i < args.length) s += String(args[i])
  }
  return s.trim()
}

// ── System prompt merging ──────────────────────────────────────────────────

/**
 * Combine a user-provided system prompt with a pattern's default system prompt.
 * If no user system is provided, returns the pattern prompt as-is.
 */
export function mergeSystem(userSystem: string | undefined, patternSystem: string): string {
  if (!userSystem) return patternSystem
  return `${userSystem}\n\n${patternSystem}`
}

// ── Confirmation helper ─────────────────────────────────────────────────────

import { createInterface } from 'node:readline'

/**
 * If opts.confirm is true, pause and prompt the user for confirmation.
 * Returns true if execution should continue, false to abort.
 */
export async function confirmPhase(
  description: string,
  opts: { confirm?: boolean; quiet?: boolean }
): Promise<boolean> {
  if (!opts.confirm) return true
  if (!opts.quiet) {
    process.stderr.write(`\n  ── Confirm ──\n  ${description}\n  Proceed? [Y/n] `)
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  const answer = await new Promise<string>((resolve) => {
    rl.question('', (ans: string) => resolve(ans))
  })
  rl.close()
  const trimmed = answer.trim().toLowerCase()
  if (trimmed === '' || trimmed === 'y' || trimmed === 'yes') return true
  return false
}

// ── Helper: make a factory function ─────────────────────────────────────────

import { completeSimple } from '@earendil-works/pi-ai'

import { pickModel } from '../model-picker.ts'
import { loadSkillContents } from '../skill-loader.ts'

export { pickModel }

/**
 * Ask a model a simple question (no tools, no streaming).
 * Used internally by patterns for analysis, review, planning.
 */
export async function ask(prompt: string, opts: Partial<PatternOptions> = {}): Promise<string> {
  const model = pickModel(opts.model)
  if (!model) throw new Error('pizx/patterns: No AI models configured. Run `pi auth login` first.')

  // Load and inject skills into the system prompt
  let systemPrompt = opts.system
  if (opts.skills && opts.skills.length > 0) {
    const skillMap = await loadSkillContents(opts.skills)
    if (skillMap.size > 0) {
      const skillBlocks: string[] = []
      for (const [name, content] of skillMap) {
        skillBlocks.push(`Skill context (${name}):\n${content}`)
      }
      const skillContext = skillBlocks.join('\n\n')
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${skillContext}` : skillContext
    }
  }

  const t0 = Date.now()
  const result = await completeSimple(
    model,
    {
      systemPrompt,
      messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
    },
    {
      maxTokens: opts.maxTokens ?? 4096,
      reasoning: opts.thinkingLevel ?? ('medium' as ThinkingLevel),
      thinkingBudgets: opts.thinkingBudgets,
      timeoutMs: opts.timeoutMs,
      maxRetries: opts.maxRetries,
      apiKey: opts.apiKey,
    }
  )
  const durationMs = Date.now() - t0

  if (!result.content || !Array.isArray(result.content)) {
    throw new Error('pizx/patterns: Unexpected response format from AI model.')
  }

  const text = result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('')

  // Collect trace entry
  if (_trace !== null) {
    pushTrace({
      call: _trace.length + 1,
      modelId: result.model,
      promptPreview: prompt.slice(0, 200),
      outputPreview: text.slice(0, 200),
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
      cacheReadTokens: result.usage.cacheRead,
      cacheWriteTokens: result.usage.cacheWrite,
      totalTokens: result.usage.totalTokens,
      cost: result.usage.cost.total,
      durationMs,
    })
  }

  return text.trim()
}

// ── Quality Review Helper ──────────────────────────────────────────────────

/** Structured quality review result shared by all patterns. */
export interface QualityReviewResult {
  /** Quality score from 0.0 (poor) to 1.0 (perfect) */
  score: number
  /** 1-2 sentence assessment */
  assessment: string
  /** 1 sentence recommendation for improvement */
  recommendation: string
}

const QUALITY_REVIEW_SYSTEM = `You are a quality assurance reviewer. Evaluate the final deliverable against the original request.

Output format:
SCORE: 0.XX (quality score from 0.0 to 1.0)
ASSESSMENT: (1-2 sentences — is the output complete, consistent, and actionable?)
RECOMMENDATION: (1 sentence — what would improve this output?)`

/**
 * Run a quality review on the final output of a pattern.
 * Returns a structured assessment or undefined if qualityCheck is disabled.
 */
export async function runQualityReview(
  originalRequest: string,
  finalOutput: string,
  opts: {
    qualityCheck?: boolean
    quiet?: boolean
    plannerModel?: string
    model?: string
    maxTokens?: number
    timeoutMs?: number
    maxRetries?: number
  }
): Promise<QualityReviewResult | undefined> {
  if (!opts.qualityCheck) return undefined

  const reviewText = await ask(
    `Original request:\n${originalRequest}\n\nFinal deliverable:\n${finalOutput}\n\nEvaluate the quality.`,
    {
      model: opts.plannerModel ?? opts.model,
      maxTokens: 512,
      thinkingLevel: 'high' as ThinkingLevel,
      timeoutMs: opts.timeoutMs,
      maxRetries: opts.maxRetries,
      system: QUALITY_REVIEW_SYSTEM,
    }
  )

  const scoreMatch = reviewText.match(/SCORE:\s*([\d.]+)/i)
  const assessMatch = reviewText.match(/ASSESSMENT:\s*(.+)/i)
  const recMatch = reviewText.match(/RECOMMENDATION:\s*(.+)/i)

  const result: QualityReviewResult = {
    score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.5,
    assessment: assessMatch?.[1]?.trim() ?? '(no assessment)',
    recommendation: recMatch?.[1]?.trim() ?? '(no recommendation)',
  }

  if (!opts.quiet) {
    process.stderr.write(`      Quality score: ${result.score.toFixed(2)}\n`)
    process.stderr.write(`      ${result.assessment.slice(0, 80)}...\n`)
  }

  return result
}
