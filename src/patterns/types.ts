/**
 * Shared types for all pizx agent patterns (Ρ, Φ, Σ, Δ, Λ, Ψ, Ω).
 *
 * Each pattern follows the same conventions as the existing π and Π tags:
 * template literal call, function chaining for options, .quiet variant,
 * and a typed result object.
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'

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
}

// ── Base output class ───────────────────────────────────────────────────────

/**
 * Base output for all pattern tags.
 * Provides common fields and coercion methods like PiOutput/AgentOutput.
 */
export class PatternOutput {
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

// ── Helper: make a factory function ─────────────────────────────────────────

import { completeSimple, getEnvApiKey, getModels, getProviders } from '@earendil-works/pi-ai'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = import('@earendil-works/pi-ai').Model<any>

/** Cached Pi settings — loaded lazily. */
import { isPiInstalled, loadPiSettings, type PiSettings } from '../load-pi-settings.ts'

let _piSettings: PiSettings | undefined

function getPiDefaults(): PiSettings {
  if (_piSettings === undefined) {
    _piSettings = isPiInstalled() ? loadPiSettings() : {}
  }
  return _piSettings
}

/** Return all known models from the pi-ai static registry. */
function allModels(): AnyModel[] {
  const result: AnyModel[] = []
  for (const p of getProviders()) {
    const ms = getModels(p)
    if (ms && ms.length > 0) result.push(...ms)
  }
  return result
}

function getConfiguredProviders(): string[] {
  return getProviders().filter((p) => getEnvApiKey(p) !== undefined)
}

function configuredModels(): AnyModel[] {
  const configured = new Set<string>(getConfiguredProviders())
  return allModels().filter((m) => configured.has(m.provider))
}

function findModelById(id: string): AnyModel | undefined {
  const all = allModels()
  if (id.includes('/')) {
    const [provider, modelId] = id.split('/', 2)
    return all.find(
      (m) => m.provider === provider && (m.id === modelId || m.id.endsWith(`/${modelId}`))
    )
  }
  return all.find((m) => m.id === id || m.id.endsWith(`/${id}`))
}

/**
 * Pick a model based on preferred id, Pi settings, or first available.
 * Mirrors the logic in pi.ts but exported for pattern use.
 */
export function pickModel(preferred?: string): AnyModel | undefined {
  if (preferred) {
    const hit = findModelById(preferred)
    if (hit) return hit
  }

  const settings = getPiDefaults()

  if (settings.defaultModel) {
    const hit = findModelById(settings.defaultModel)
    if (hit) return hit
  }

  if (settings.defaultProvider) {
    const providerModels = (getModels as (p: string) => AnyModel[])(settings.defaultProvider)
    if (providerModels && providerModels.length > 0) {
      const configured = new Set<string>(getConfiguredProviders())
      if (configured.has(settings.defaultProvider as string)) {
        return providerModels[0]
      }
    }
  }

  const available = configuredModels()
  if (available.length > 0) {
    const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
    for (const id of order) {
      const m = available.find((m) => m.id.includes(id))
      if (m) return m
    }
    return available[0]
  }

  const models = allModels()
  if (models.length === 0) return undefined
  const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
  for (const id of order) {
    const m = models.find((m) => m.id.includes(id))
    if (m) return m
  }
  return models[0]
}

/**
 * Ask a model a simple question (no tools, no streaming).
 * Used internally by patterns for analysis, review, planning.
 */
export async function ask(
  prompt: string,
  opts: { model?: string; maxTokens?: number; thinkingLevel?: ThinkingLevel; system?: string } = {}
): Promise<string> {
  const model = pickModel(opts.model)
  if (!model) throw new Error('pizx/patterns: No AI models configured. Run `pi auth login` first.')

  const result = await completeSimple(
    model,
    {
      systemPrompt: opts.system,
      messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
    },
    {
      maxTokens: opts.maxTokens ?? 4096,
      reasoning: opts.thinkingLevel ?? ('medium' as ThinkingLevel),
    }
  )

  const text = result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('')

  return text.trim()
}
