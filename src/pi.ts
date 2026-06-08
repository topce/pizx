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
  getEnvApiKey,
  getModels,
  getProviders,
  type Model,
  type SimpleStreamOptions,
  streamSimple,
  type ThinkingLevel,
} from '@earendil-works/pi-ai'
import { PiOutput } from './pi-output.ts'

export { PiOutput }

import { isPiInstalled, loadPiSettings, type PiSettings } from './load-pi-settings.ts'

export interface PiOptions {
  model?: string
  thinkingLevel?: ThinkingLevel
  quiet?: boolean
  system?: string
  maxTokens?: number
}

const defaults: PiOptions = {
  thinkingLevel: 'medium' as ThinkingLevel,
  quiet: false,
  maxTokens: 4096,
}

/** Cached Pi settings — loaded lazily on first use. */
let _piSettings: PiSettings | undefined

function getPiDefaults(): PiSettings {
  if (_piSettings === undefined) {
    _piSettings = isPiInstalled() ? loadPiSettings() : {}
  }
  return _piSettings
}

/** Return all known models from the pi-ai static registry. */
function allModels() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Model<any>[] = []
  for (const p of getProviders()) {
    const ms = getModels(p)
    if (ms && ms.length > 0) result.push(...ms)
  }
  return result
}

/**
 * Return only providers that have an API key configured
 * (via env var, or loaded from auth.json by loadPiAuth).
 */
function getConfiguredProviders() {
  return getProviders().filter((p) => getEnvApiKey(p) !== undefined)
}

/** Return models only from providers that have configured auth. */
function configuredModels() {
  const configured = new Set<string>(getConfiguredProviders())
  return allModels().filter((m) => configured.has(m.provider))
}

/**
 * Try to find a model matching a provider/modelId string.
 * Supported formats:
 *   "anthropic/claude-sonnet-4-5"  (provider/modelId)
 *   "claude-sonnet-4-5"            (modelId only)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findModelById(id: string): Model<any> | undefined {
  const all = allModels()
  // Try provider/modelId format
  if (id.includes('/')) {
    const [provider, modelId] = id.split('/', 2)
    return all.find(
      (m) => m.provider === provider && (m.id === modelId || m.id.endsWith(`/${modelId}`))
    )
  }
  // modelId only
  return all.find((m) => m.id === id || m.id.endsWith(`/${id}`))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickModel(preferred?: string): Model<any> | undefined {
  // 1. Explicit --model flag has highest priority
  if (preferred) {
    const hit = findModelById(preferred)
    if (hit) return hit
  }

  // 2. Pi's defaultModel / defaultProvider from settings.json
  const settings = getPiDefaults()

  if (settings.defaultModel) {
    const hit = findModelById(settings.defaultModel)
    if (hit) return hit
  }

  if (settings.defaultProvider) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providerModels = getModels(settings.defaultProvider as any)
    if (providerModels && providerModels.length > 0) {
      // Prefer a model that has auth configured
      const configured = new Set<string>(getConfiguredProviders())
      if (configured.has(settings.defaultProvider as string)) {
        return providerModels[0]
      }
    }
  }

  // 3. First model from a provider that has configured auth
  const available = configuredModels()
  if (available.length > 0) {
    const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
    for (const id of order) {
      const m = available.find((m) => m.id.includes(id))
      if (m) return m
    }
    return available[0]
  }

  // 4. Fallback: any model from the full registry
  const models = allModels()
  if (models.length === 0) return undefined
  const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
  for (const id of order) {
    const m = models.find((m) => m.id.includes(id))
    if (m) return m
  }
  return models[0]
}

function build(pieces: TemplateStringsArray, args: unknown[]): string {
  let s = ''
  for (let i = 0; i < pieces.length; i++) {
    s += pieces[i]
    if (i < args.length) s += String(args[i])
  }
  return s
}

function makeContext(pieces: TemplateStringsArray, args: unknown[], opts: PiOptions): Context {
  return {
    systemPrompt: opts.system,
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
  for await (const ev of streamSimple(model, makeContext(pieces, args, opts), makeOpts(opts))) {
    if (ev.type === 'text_delta') {
      text += ev.delta
      if (!opts.quiet) process.stdout.write(ev.delta)
    }
  }
  if (!opts.quiet && text) process.stdout.write('\n')
  return new PiOutput(text.trim(), model.id, [], t0, Date.now())
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

  fn.stream = function* stream_pi(pieces: TemplateStringsArray, ...args: unknown[]) {
    return runStream(pieces, args, merged)
  } as unknown as PiFn['stream']

  return fn
}

/** π template tag — call pi-ai for text generation */
export const π: PiFn = makePi()

export function configurePi(opts: Partial<PiOptions>): void {
  Object.assign(defaults, opts)
}
