/**
 * pizx llm service — model resolution, auth, and typed LLM/agent entry points.
 *
 * Absorbs the former model-picker.ts + load-pi-auth.ts: Pi credentials are
 * injected from ~/.pi/agent on start, models come from pi-coding-agent's
 * ModelRegistry, and every LLM call is recorded as a trace llm-call event in
 * the active span (when a trace service is present).
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { type Context, Service } from '@cordisjs/core'
import type {
  Api,
  AssistantMessageEventStream,
  Model,
  Context as PiContext,
  SimpleStreamOptions,
  ThinkingBudgets,
  ThinkingLevel,
  Usage,
} from '@earendil-works/pi-ai'
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai'
import { completeSimple, streamSimple } from '@earendil-works/pi-ai/compat'
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent'
import { PizxError } from './errors.ts'
import { isPiInstalled, loadPiSettings, type PiSettings } from './load-pi-settings.ts'
import type { TraceSpan } from './trace.ts'
import { getErrorMessage } from './utils.ts'

export type { PiSettings }

// ── Pi auth loading (moved from load-pi-auth.ts) ────────────────────────────

const PI_AUTH_DIR = join(homedir(), '.pi', 'agent')

// Matches Pi's resolve-config-value env var grammar.
const ENV_VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const ENV_VAR_NAME_PREFIX_RE = /^[A-Za-z_][A-Za-z0-9_]*/

// Provider name → env var name mapping (from pi-ai internals)
const PROVIDER_ENV_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  'openai-codex': 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  'google-vertex': 'GOOGLE_CLOUD_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  xai: 'XAI_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
  cloudflare: 'CLOUDFLARE_API_KEY',
  'cloudflare-ai-gateway': 'CLOUDFLARE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

/**
 * Resolve a credential value written in Pi's config-value syntax:
 *   - `$VAR` / `${VAR}` interpolate the named environment variable
 *   - `$$` and `$!` emit a literal `$` / `!`
 *   - `!command` (shell command) is left to Pi's AuthStorage to execute
 *
 * Returns `undefined` when an interpolated variable is missing, so callers can
 * skip injecting a value instead of polluting the environment with the raw
 * template (which would otherwise be sent verbatim as the API key).
 */
export function resolveConfigValue(value: string): string | undefined {
  if (typeof value !== 'string') return undefined
  if (value.startsWith('!')) return undefined

  let result = ''
  let index = 0

  while (index < value.length) {
    const dollarIndex = value.indexOf('$', index)
    if (dollarIndex < 0) {
      result += value.slice(index)
      break
    }

    result += value.slice(index, dollarIndex)
    const next = value[dollarIndex + 1]

    if (next === '$' || next === '!') {
      result += next
      index = dollarIndex + 2
      continue
    }

    if (next === '{') {
      const endIndex = value.indexOf('}', dollarIndex + 2)
      if (endIndex < 0) {
        result += '$'
        index = dollarIndex + 1
        continue
      }
      const name = value.slice(dollarIndex + 2, endIndex)
      if (!ENV_VAR_NAME_RE.test(name)) {
        result += value.slice(dollarIndex, endIndex + 1)
        index = endIndex + 1
        continue
      }
      const resolved = process.env[name]
      if (resolved === undefined) return undefined
      result += resolved
      index = endIndex + 1
      continue
    }

    const match = value.slice(dollarIndex + 1).match(ENV_VAR_NAME_PREFIX_RE)
    if (match) {
      const name = match[0]
      const resolved = process.env[name]
      if (resolved === undefined) return undefined
      result += resolved
      index = dollarIndex + 1 + name.length
      continue
    }

    result += '$'
    index = dollarIndex + 1
  }

  return result
}

/**
 * Reads ~/.pi/agent/auth.json (or api-keys.json) and sets the corresponding
 * environment variables if not already set. Must run before any registry use.
 */
export function loadPiAuth(): void {
  const candidates = ['auth.json', 'api-keys.json']

  for (const file of candidates) {
    const path = join(PI_AUTH_DIR, file)
    if (!existsSync(path)) continue

    try {
      const config = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>

      for (const [provider, cred] of Object.entries(config)) {
        const envVar = PROVIDER_ENV_MAP[provider]
        if (!envVar || process.env[envVar]) continue

        const credObj = cred as { type: string; key?: string }
        if (credObj.type === 'api_key' && credObj.key) {
          const resolved = resolveConfigValue(credObj.key)
          if (resolved !== undefined) process.env[envVar] = resolved
        }
      }

      if (config.apiKeys) {
        for (const [provider, key] of Object.entries(config.apiKeys as Record<string, string>)) {
          const envVar = PROVIDER_ENV_MAP[provider]
          if (!envVar || process.env[envVar]) continue
          if (typeof key === 'string') {
            const resolved = resolveConfigValue(key)
            if (resolved !== undefined) process.env[envVar] = resolved
          }
        }
      }
    } catch (err) {
      console.warn(`pizx: failed to parse ${path}: ${getErrorMessage(err)}`)
    }
  }
}

// ── Registry singletons ─────────────────────────────────────────────────────

let _registryPromise: Promise<ModelRegistry> | undefined
let _piSettings: PiSettings | undefined

function getRegistry(): Promise<ModelRegistry> {
  if (!_registryPromise) {
    _registryPromise = ModelRuntime.create({ allowModelNetwork: false }).then(
      (runtime) => new ModelRegistry(runtime)
    )
  }
  return _registryPromise
}

function getPiDefaults(): PiSettings {
  if (_piSettings === undefined) {
    _piSettings = isPiInstalled() ? loadPiSettings() : {}
  }
  return _piSettings
}

/** @internal — test hook to reset registry/settings singletons. */
export function _resetForTests(): void {
  _registryPromise = undefined
  _piSettings = undefined
}

// ── Auth-resolved streaming wrapper ─────────────────────────────────────────

/**
 * Wrap streamSimple with async auth resolution: the returned stream resolves
 * credentials before delegating to the pi-ai compat stream. An explicit
 * `options.apiKey` always wins over the registry lookup, and lets a call run
 * without any stored credentials.
 */
function streamWithAuth(
  regPromise: Promise<ModelRegistry>,
  model: Model<Api>,
  context: PiContext,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  const outer = createAssistantMessageEventStream()
  void (async () => {
    const reg = await regPromise
    const explicitApiKey = options?.apiKey
    const auth = await reg.getApiKeyAndHeaders(model)
    if (!explicitApiKey && !auth.ok) {
      outer.push({
        type: 'error',
        reason: 'error',
        error: {
          role: 'assistant',
          content: [],
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: emptyUsage(),
          stopReason: 'error',
          errorMessage: `Auth failed: ${auth.error}`,
          timestamp: Date.now(),
        },
      })
      outer.end()
      return
    }
    const inner = streamSimple(model, context, {
      ...options,
      apiKey: explicitApiKey ?? (auth.ok ? auth.apiKey : undefined),
      headers: auth.ok ? auth.headers : options?.headers,
    })
    try {
      for await (const event of inner) outer.push(event)
      outer.end(await inner.result())
    } catch (err) {
      outer.push({
        type: 'error',
        reason: 'error',
        error: {
          role: 'assistant',
          content: [],
          api: model.api,
          provider: model.provider,
          model: model.id,
          usage: emptyUsage(),
          stopReason: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        },
      })
      outer.end()
    }
  })()
  return outer
}

function emptyUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

// ── Service ─────────────────────────────────────────────────────────────────

export interface LlmConfig {
  /** Default model id used when a letter does not specify one. */
  model?: string
  /** Default thinking level. */
  thinkingLevel?: ThinkingLevel
  /** Default max tokens per call. */
  maxTokens?: number
  /** Whether cacheable letters may use the cache by default. */
  cache?: boolean
}

/**
 * Options shared by every LLM-call surface (`ask`, `stream`, and the π/Π/α
 * letters). The π/Π schemastery schemas are the runtime source of truth for the
 * letters; this is the TypeScript contract those surfaces share, so a new
 * field added to one surface is kept in lock-step with the others.
 */
export interface LlmCallOptions {
  model?: string
  system?: string
  appendSystemPrompt?: string
  maxTokens?: number
  thinkingLevel?: ThinkingLevel
  thinkingBudgets?: ThinkingBudgets
  timeoutMs?: number
  maxRetries?: number
  apiKey?: string
}

export interface AskOptions extends LlmCallOptions {
  /** Record the call in the current trace span. Default true. */
  trace?: boolean
}

export interface AskResult {
  text: string
  modelId: string
  usage: Usage
  durationMs: number
}

/** Options that select and shape a Π (coding agent) session. */
export interface AgentSessionOptions {
  cwd?: string
  model?: string
  thinkingLevel?: ThinkingLevel
  tools?: string[]
  excludeTools?: string[]
  system?: string
  appendSystemPrompt?: string
  skills?: string[]
  /** Name of a persistent session to resume (or create). Omit for an in-memory session. */
  session?: string
  /** Per-provider-request timeout in ms (Pi `retry.provider.timeoutMs`). */
  timeoutMs?: number
  /** Retry budget for transient failures (Pi `retry.maxRetries` + `retry.provider.maxRetries`). */
  maxRetries?: number
}

declare module '@cordisjs/core' {
  interface Context {
    llm: Llm
  }
}

export class Llm extends Service<LlmConfig> {
  private readonly sessions = new Map<string, AgentSession>()

  constructor(ctx: Context, config?: LlmConfig) {
    super(ctx, 'llm')
    this.config = {
      thinkingLevel: config?.thinkingLevel ?? 'medium',
      maxTokens: config?.maxTokens ?? 4096,
      cache: config?.cache ?? false,
      model: config?.model,
    }
  }

  protected start(): void {
    // Credentials must be in the environment before the first registry use.
    loadPiAuth()
  }

  protected stop(): void {
    this.closeAgentSessions()
  }

  // ── Model resolution ──────────────────────────────────────────────────────

  /** All models known to the registry. */
  async models(): Promise<Model<Api>[]> {
    const reg = await getRegistry()
    return reg.getAll()
  }

  /**
   * Pick a model by id, Pi defaults, or the first available model.
   * Returns undefined only when the registry is completely empty.
   */
  async pick(preferred?: string): Promise<Model<Api> | undefined> {
    const reg = await getRegistry()

    if (preferred) {
      const hit = findModelById(reg, preferred)
      if (hit) return hit
    }

    const settings = getPiDefaults()
    if (settings.defaultModel) {
      const all = reg.getAll()
      if (settings.defaultProvider) {
        const providerHit = all.find(
          (m) =>
            m.provider === settings.defaultProvider &&
            (m.id === settings.defaultModel || m.id.endsWith(`/${settings.defaultModel}`))
        )
        if (providerHit) return providerHit
      }
      const hit = findModelById(reg, settings.defaultModel)
      if (hit) return hit
    }

    if (settings.defaultProvider) {
      const providerModels = reg.getAll().filter((m) => m.provider === settings.defaultProvider)
      if (providerModels.length > 0) return providerModels[0]
    }

    const available = reg.getAvailable()
    const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
    for (const id of order) {
      const m = available.find((model) => model.id.includes(id))
      if (m) return m
    }
    if (available.length > 0) return available[0]

    const models = reg.getAll()
    if (models.length === 0) return undefined
    for (const id of order) {
      const m = models.find((model) => model.id.includes(id))
      if (m) return m
    }
    return models[0]
  }

  // ── Text generation ───────────────────────────────────────────────────────

  /** One-shot text generation with usage; records a trace llm-call event. */
  async ask(prompt: string, opts: AskOptions = {}): Promise<AskResult> {
    const model = await this.pick(opts.model ?? this.config.model)
    if (!model) {
      throw new PizxError('AUTH', 'pizx: No AI models configured. Run `pi auth login` first.')
    }

    const systemParts: string[] = []
    if (opts.system) systemParts.push(opts.system)
    if (opts.appendSystemPrompt) systemParts.push(opts.appendSystemPrompt)

    const t0 = Date.now()
    const result = await completeSimple(
      model,
      {
        systemPrompt: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
        messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
      },
      {
        maxTokens: opts.maxTokens ?? this.config.maxTokens,
        reasoning: opts.thinkingLevel ?? this.config.thinkingLevel,
        thinkingBudgets: opts.thinkingBudgets,
        timeoutMs: opts.timeoutMs,
        maxRetries: opts.maxRetries,
        apiKey: opts.apiKey,
      }
    )
    const durationMs = Date.now() - t0

    const text = Array.isArray(result.content)
      ? result.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)
          .join('')
      : typeof result.content === 'string'
        ? result.content
        : ''

    const usage = result.usage ?? emptyUsage()
    if (opts.trace !== false) this.recordUsage(model.id, usage, durationMs)
    return { text: text.trim(), modelId: model.id, usage, durationMs }
  }

  /**
   * Streaming text generation with auth resolution. Yields pi-ai events; the
   * caller consumes the done event to obtain usage. Usage is auto-recorded
   * into the active span unless `trace` is false.
   */
  stream(
    model: Model<Api>,
    context: PiContext,
    options?: SimpleStreamOptions & { trace?: boolean }
  ): AssistantMessageEventStream {
    const { trace = true, ...rest } = options ?? {}
    const inner = streamWithAuth(getRegistry(), model, context, rest)
    if (!trace) return inner

    const t0 = Date.now()
    const outer = createAssistantMessageEventStream()
    void (async () => {
      try {
        for await (const ev of inner) {
          if (ev.type === 'done' && ev.message?.usage) {
            this.recordUsage(model.id, ev.message.usage, Date.now() - t0)
          }
          outer.push(ev)
        }
        outer.end(await inner.result())
      } catch (err) {
        // Surface inner stream failures as an error event instead of ending
        // the stream silently — consumers (π) otherwise see an empty/partial
        // result with no indication that generation failed.
        outer.push({
          type: 'error',
          reason: 'error',
          error: {
            role: 'assistant',
            content: [],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: emptyUsage(),
            stopReason: 'error',
            errorMessage: getErrorMessage(err),
            timestamp: Date.now(),
          },
        })
        outer.end()
      }
    })()
    return outer
  }

  /** Record a llm-call event into the current trace span (if any). */
  recordUsage(modelId: string, usage: Usage, durationMs: number): void {
    const span: TraceSpan | undefined = this.ctx.get('trace')?.current()
    if (!span) return
    span.emit({
      kind: 'llm-call',
      modelId,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheReadTokens: usage.cacheRead,
      cacheWriteTokens: usage.cacheWrite,
      totalTokens: usage.totalTokens,
      costUsd: usage.cost.total,
      durationMs,
    })
  }

  // ── Coding agent (Π) ──────────────────────────────────────────────────────

  /** Get (or reuse) a shared agent session keyed by every behavior-affecting option. */
  async agentSession(
    opts: AgentSessionOptions
  ): Promise<{ session: AgentSession; modelId: string }> {
    const model = await this.pick(opts.model ?? this.config.model)
    if (!model) {
      throw new PizxError('AUTH', 'pizx: No AI models configured. Run `pi auth login` first.')
    }
    const key = agentSessionKey({
      ...opts,
      model: model.id,
      cwd: opts.cwd ?? process.cwd(),
      thinkingLevel: opts.thinkingLevel ?? this.config.thinkingLevel ?? 'medium',
    })

    const entry = this.sessions.get(key)
    if (entry) return { session: entry, modelId: model.id }

    const loader = createLoader(opts)
    if (loader && opts.skills?.length) {
      const skillMap = await loadSkillContents(opts.skills)
      if (skillMap.size > 0) {
        const skillPaths: Array<{
          path: string
          metadata: { source: string; scope: 'project' | 'user' | 'temporary'; origin: 'top-level' }
        }> = []
        for (const [name] of skillMap) {
          for (const base of SKILL_PATHS) {
            skillPaths.push({
              path: `${base}/${name}`,
              metadata: { source: 'pizx', scope: 'project', origin: 'top-level' },
            })
          }
        }
        loader.extendResources({ skillPaths })
      }
    }

    const sessionManager = opts.session
      ? await openNamedSession(opts.cwd ?? process.cwd(), opts.session)
      : SessionManager.inMemory()

    const created = await createAgentSession({
      cwd: opts.cwd,
      model,
      thinkingLevel: opts.thinkingLevel,
      tools: opts.tools,
      excludeTools: opts.excludeTools,
      resourceLoader: loader,
      settingsManager: agentSettingsManager(opts),
      sessionManager,
    }).catch((err: unknown) => {
      // A failed build must not leave the durable name claimed forever.
      releaseNamedSession(sessionManager.getSessionFile())
      throw err
    })
    const { session } = created
    this.sessions.set(key, session)
    return { session, modelId: model.id }
  }

  /**
   * Dispose every pooled agent session — used by `stop()` and by Π resets.
   * Durable sessions release their name claim, so a later app in this process
   * can open the same name again.
   */
  closeAgentSessions(): void {
    for (const session of this.sessions.values()) {
      releaseNamedSession(session.sessionFile)
      try {
        session.dispose()
      } catch {
        // best-effort teardown
      }
    }
    this.sessions.clear()
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

import { loadSkillContents, SKILL_PATHS } from './skill-loader.ts'

function findModelById(reg: ModelRegistry, id: string): Model<Api> | undefined {
  const all = reg.getAll()
  if (id.includes('/')) {
    const [provider, modelId] = id.split('/', 2)
    return all.find(
      (m) => m.provider === provider && (m.id === modelId || m.id.endsWith(`/${modelId}`))
    )
  }
  return all.find((m) => m.id === id || m.id.endsWith(`/${id}`))
}

function createLoader(opts: {
  cwd?: string
  system?: string
  appendSystemPrompt?: string
}): DefaultResourceLoader | undefined {
  const hasSystem = opts.system !== undefined
  const hasAppend = opts.appendSystemPrompt !== undefined
  if (!hasSystem && !hasAppend) return undefined

  return new DefaultResourceLoader({
    cwd: opts.cwd ?? process.cwd(),
    agentDir: '',
    systemPrompt: opts.system,
    appendSystemPrompt: opts.appendSystemPrompt ? [opts.appendSystemPrompt] : undefined,
  })
}

/**
 * Build a settings manager that layers the letter's `timeoutMs`/`maxRetries`
 * overrides over the user's real Pi settings. Pi reads provider request
 * timeouts/retries from `retry.provider` and agent-turn retries from
 * `retry.maxRetries`, so passing this to `createAgentSession` makes the
 * documented Π options take effect without disturbing other settings.
 *
 * Returns undefined when neither option is set, letting Pi build its own
 * default manager.
 *
 * @internal — exported for tests only; not part of the public API.
 */
export function agentSettingsManager(opts: {
  cwd?: string
  timeoutMs?: number
  maxRetries?: number
}): SettingsManager | undefined {
  const hasTimeout = opts.timeoutMs !== undefined
  const hasRetries = opts.maxRetries !== undefined
  if (!hasTimeout && !hasRetries) return undefined

  const manager = SettingsManager.create(opts.cwd ?? process.cwd())
  manager.applyOverrides({
    retry: {
      ...(hasRetries ? { maxRetries: opts.maxRetries } : {}),
      provider: {
        ...(hasTimeout ? { timeoutMs: opts.timeoutMs } : {}),
        ...(hasRetries ? { maxRetries: opts.maxRetries } : {}),
      },
    },
  })
  return manager
}

/**
 * Canonical pool key for a Π session. Object keys and array values are sorted,
 * so option order never splits the pool, and `undefined` collapses to `null`.
 * Every option handed to `agentSession()` is part of the key by construction,
 * so a future option cannot be forgotten here.
 *
 * @internal — exported for tests only; not part of the public API.
 */
export function agentSessionKey(opts: Record<string, unknown>): string {
  const canonical: Record<string, unknown> = {}
  for (const key of Object.keys(opts).sort()) {
    const value = opts[key]
    canonical[key] = Array.isArray(value) ? [...value].sort() : (value ?? null)
  }
  return JSON.stringify(canonical)
}

/**
 * Durable sessions open in this process, keyed by `<cwd>\0<name>` and holding
 * the session file. Pi sessions are append-only JSONL with a leaf pointer per
 * open handle, so two live handles on one file fork the conversation: both
 * append children of the same entry, and the branch that is not last in the
 * file silently drops out of the resumed context. A second open of a name
 * already held in this process is therefore refused; the claim is released by
 * `releaseNamedSession()` when the owning app disposes.
 */
const claimedSessions = new Map<string, string>()

/**
 * Open the persisted session named `name` in `cwd`, or create and name a new
 * one. Uses pi's standard session directory, so named sessions also appear in
 * pi's own session picker and can be resumed by the `pi` CLI.
 *
 * @internal — exported for tests only; not part of the public API.
 */
export async function openNamedSession(cwd: string, name: string): Promise<SessionManager> {
  const claim = `${resolve(cwd)}\u0000${name}`
  const alreadyOpen = claimedSessions.get(claim)
  if (alreadyOpen) {
    throw new PizxError(
      'VALIDATION',
      `pizx/Π: durable session "${name}" is already open in this process (${alreadyOpen}). ` +
        'Use the same Π options, pick a different session name, or dispose the app that opened it.',
      { letter: 'Π' }
    )
  }

  const hit = (await SessionManager.list(cwd)).find((s) => s.name === name)
  const manager = hit ? SessionManager.open(hit.path) : SessionManager.create(cwd)
  if (!hit) manager.appendSessionInfo(name)
  claimedSessions.set(claim, manager.getSessionFile() ?? name)
  return manager
}

/**
 * Release the name claim held by a disposed durable session.
 *
 * @internal — exported for tests only; not part of the public API.
 */
export function releaseNamedSession(sessionFile: string | undefined): void {
  if (!sessionFile) return
  for (const [claim, file] of claimedSessions) {
    if (file === sessionFile) claimedSessions.delete(claim)
  }
}
