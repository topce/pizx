/**
 * Shared types for all pizx agent patterns (Ρ, Φ, Σ, Δ, Λ, Ψ, Ω).
 *
 * Each pattern follows the same conventions as the existing π and Π tags:
 * template literal call, function chaining for options, .quiet variant,
 * and a typed result object.
 */

import type { ThinkingBudgets, ThinkingLevel } from '@earendil-works/pi-ai'

// ── Tag Output interface ────────────────────────────────────────────────────

/**
 * Common output contract shared by all pizx tags (π, Π, and all patterns).
 *
 * Every tag's result implements at minimum: text access, timing, and
 * coercion methods. For token/cost tracking, see {@link PiOutput} and
 * {@link PatternOutput} which extend this with trace data.
 */
export interface TagOutput {
  /** Full result text */
  readonly text: string
  /** Start timestamp (ms since epoch) */
  readonly startTime: number
  /** End timestamp (ms since epoch) */
  readonly endTime: number
  /** Duration in milliseconds */
  readonly duration: number
  toString(): string
  valueOf(): string
  [Symbol.toPrimitive](): string
}

// ── Worker Result interface ─────────────────────────────────────────────────

/**
 * Shared shape for all sub-task / worker results across patterns.
 *
 * Used by Fleet ({@link FleetMemberOutput}), Orchestrator
 * ({@link OrchestratorWorkerResult}), Subagents ({@link SubagentResult}),
 * and Broadcast ({@link BroadcastResponse}).
 *
 * Each class provides both `text` and `output` accessors for
 * backward compatibility — they return the same value.
 */
export interface WorkerResult {
  /** Description of the assigned task */
  readonly task: string
  /** The worker's output text */
  readonly text: string
  /** Alias for text (preferred for pattern results) */
  readonly output: string
  /** Whether execution succeeded */
  readonly success: boolean
  /** Error message if execution failed */
  readonly error?: string
}

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
  confirm?: boolean | ConfirmGate
  /** API key to use for the provider (bypasses environment variable lookup). */
  apiKey?: string
  /** Execution mode: 'text' (default) uses text generation, 'agent' uses coding agent with tools. */
  mode?: 'text' | 'agent'
  /** Maximum agent turns when mode is 'agent'. Default: 10 */
  maxAgentTurns?: number
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

/**
 * A Promise that resolves to a pattern output.
 *
 * This is a type-level marker for forward compatibility — it adds no
 * runtime behavior beyond `Promise<TOutput>`. Future versions may add
 * chaining methods (e.g. `.pipe()`) without changing the return type.
 */
export class PatternPromise<TOutput extends PatternOutput> extends Promise<TOutput> {}

// ── Option validation ──────────────────────────────────────────────────────

/**
 * Validate pattern options at the boundary before execution.
 * Throws with a descriptive message for invalid values.
 */
export function validateOptions(opts: Record<string, unknown>): void {
  if (typeof opts.concurrency === 'number' && opts.concurrency < 1) {
    throw new Error(`pizx: concurrency must be >= 1, got ${opts.concurrency}`)
  }
  if (typeof opts.workers === 'number' && opts.workers < 1) {
    throw new Error(`pizx: workers must be >= 1, got ${opts.workers}`)
  }
  if (typeof opts.maxIterations === 'number' && opts.maxIterations < 1) {
    throw new Error(`pizx: maxIterations must be >= 1, got ${opts.maxIterations}`)
  }
  if (typeof opts.maxSubTasks === 'number' && opts.maxSubTasks < 1) {
    throw new Error(`pizx: maxSubTasks must be >= 1, got ${opts.maxSubTasks}`)
  }
  if (typeof opts.maxTurns === 'number' && opts.maxTurns < 1) {
    throw new Error(`pizx: maxTurns must be >= 1, got ${opts.maxTurns}`)
  }
  if (typeof opts.maxAgentTurns === 'number' && opts.maxAgentTurns < 1) {
    throw new Error(`pizx: maxAgentTurns must be >= 1, got ${opts.maxAgentTurns}`)
  }
  if (typeof opts.qualityThreshold === 'number') {
    const qt = opts.qualityThreshold
    if (qt < 0.0 || qt > 1.0) {
      throw new Error(`pizx: qualityThreshold must be between 0.0 and 1.0, got ${qt}`)
    }
  }
  if (typeof opts.rounds === 'number' && opts.rounds < 0) {
    throw new Error(`pizx: rounds must be >= 0, got ${opts.rounds}`)
  }
  const validThinkingLevels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']
  if (typeof opts.thinkingLevel === 'string' && !validThinkingLevels.includes(opts.thinkingLevel)) {
    throw new Error(
      `pizx: invalid thinkingLevel "${opts.thinkingLevel}". Valid: ${validThinkingLevels.join(', ')}`
    )
  }
  if (typeof opts.mode === 'string' && !['text', 'agent'].includes(opts.mode)) {
    throw new Error(`pizx: invalid mode "${opts.mode}". Valid: text, agent`)
  }
}

// ── Tag factory ────────────────────────────────────────────────────────────

/**
 * Create a pattern tag with option chaining and .quiet support.
 *
 * Every pattern tag (Φ, Σ, Δ, Λ, Ψ, Ω, Ρ, Θ, Μ, Β, Α, Γ, Ν, Χ, Τ)
 * uses this single factory instead of duplicating the same ~30 lines
 * of option-chaining boilerplate.
 *
 * Options are validated at the boundary before execution begins —
 * invalid values throw immediately with descriptive messages.
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

/**
 * Get the current accumulated cost from the in-progress execution trace.
 * Sums all LLM call costs made so far. Only valid during pattern execution
 * (between beginTrace and collectTrace). Returns 0 if no trace is active.
 *
 * Used by patterns to implement budgetCapUsd with real API costs instead
 * of estimated per-iteration guesses.
 */
export function getCurrentCost(): number {
  if (!_trace) return 0
  return _trace.reduce((sum, t) => sum + t.cost, 0)
}

export function createPatternTag<TOptions extends PatternOptions, TOutput extends PatternOutput>(
  defaults: TOptions,
  execute: (pieces: TemplateStringsArray, args: unknown[], opts: TOptions) => Promise<TOutput>
): PatternFn<TOptions, TOutput> {
  function make(opts: Partial<TOptions> = {}): PatternFn<TOptions, TOutput> {
    const merged = { ...defaults, ...opts }
    validateOptions(merged)

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

// ── Confirmation gate types ─────────────────────────────────────────────────

/** Execution mode for confirm gates. Exactly one key must be true. */
export type ConfirmGate =
  | { hitl: true } // Human-In-The-Loop: gate before every phase
  | { semi: true } // Semi-autonomous: gate at major decision points only
  | { auto: true } // Fully autonomous: no gates

// ── Confirmation helpers ────────────────────────────────────────────────────

import { createInterface } from 'node:readline'

/**
 * Resolve the confirm union (boolean | ConfirmGate | undefined) to a simple mode string.
 * `true` maps to 'semi' for backward compatibility.
 */
export function resolveMode(confirm: boolean | ConfirmGate | undefined): 'auto' | 'semi' | 'hitl' {
  if (confirm === undefined || confirm === false) return 'auto'
  if (confirm === true) return 'semi'
  if ('hitl' in confirm) return 'hitl'
  if ('semi' in confirm) return 'semi'
  return 'auto' // { auto: true }
}

/**
 * Decide whether to gate at this phase, given the resolved mode and
 * whether this phase counts as a "major" decision point for the pattern.
 */
export function shouldGate(mode: 'auto' | 'semi' | 'hitl', isMajorPhase: boolean): boolean {
  if (mode === 'hitl') return true // gate every phase
  if (mode === 'semi') return isMajorPhase // gate only major phases
  return false // auto: never gate
}

/**
 * If the mode indicates, pause and prompt the user for confirmation.
 * Returns true if execution should continue, false to abort.
 *
 * @param description Human-readable summary of what will execute.
 * @param phase Phase name for the prompt label and error messages (e.g. 'plan').
 * @param isMajorPhase Whether this phase counts as "major" for semi mode gating.
 * @param opts Options including the confirm setting.
 */
export async function confirmPhase(
  description: string,
  phase: string,
  isMajorPhase: boolean,
  opts: { confirm?: boolean | ConfirmGate; quiet?: boolean }
): Promise<boolean> {
  const mode = resolveMode(opts.confirm)
  if (!shouldGate(mode, isMajorPhase)) return true

  process.stderr.write(`\n  ── Confirm (${phase}) ──\n  ${description}\n  Proceed? [Y/n] `)
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
import { createAgentSession } from '@earendil-works/pi-coding-agent'

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
      reasoning: opts.thinkingLevel ?? 'medium',
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

// ── Task execution helper (text mode vs agent mode) ────────────────────────

/**
 * Execute a task using either text generation (ask) or the coding agent (with tools).
 * Controlled via opts.mode: 'text' (default) or 'agent'.
 */
export async function executeTask(
  prompt: string,
  opts: Partial<PatternOptions> & { system?: string } = {}
): Promise<string> {
  if (opts.mode === 'agent') {
    return runAgentTask(prompt, opts)
  }
  return ask(prompt, opts)
}

async function runAgentTask(
  prompt: string,
  opts: Partial<PatternOptions> & { system?: string }
): Promise<string> {
  const model = pickModel(opts.model)
  if (!model) throw new Error('pizx/patterns: No AI models configured. Run `pi auth login` first.')

  const tools = ['read', 'bash', 'edit', 'write', 'grep', 'ls']
  const { session } = await createAgentSession({
    tools,
    ...(model ? { model } : {}),
  })
  try {
    await session.sendUserMessage(prompt)
    const messages = session.messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.role !== 'assistant') continue
      const c = 'content' in msg ? (msg as { content: unknown }).content : undefined
      if (typeof c === 'string') return c.trim()
      if (Array.isArray(c)) {
        const texts = c
          .filter(
            (block: unknown): block is { type: string; text: string } =>
              typeof block === 'object' && block !== null && 'type' in block && 'text' in block
          )
          .map((block) => block.text)
        if (texts.length > 0) return texts.join('\n').trim()
      }
    }
    return ''
  } finally {
    session.dispose()
  }
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
