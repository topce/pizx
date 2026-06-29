/**
 * Shared model-picking logic for π (pi.ts) and all pattern tags (patterns/types.ts).
 *
 * Uses ModelRegistry from pi-coding-agent (which handles builtin + custom providers,
 * OAuth, env-var auth, and models.json) plus the pi-ai compat module for streaming.
 *
 * Priority:
 *   1. Explicit model id passed by the caller
 *   2. Pi's defaultModel / defaultProvider from ~/.pi/agent/settings.json
 *   3. First configured model (has auth) matching a preference order
 *   4. First fallback model from the full registry in the same preference order
 */

import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from '@earendil-works/pi-ai'
import { completeSimple, streamSimple } from '@earendil-works/pi-ai/compat'
import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent'

import { isPiInstalled, loadPiSettings, type PiSettings } from './load-pi-settings.ts'

// ── Cached Pi settings ──────────────────────────────────────────────────────

let _piSettings: PiSettings | undefined

function getPiDefaults(): PiSettings {
  if (_piSettings === undefined) {
    _piSettings = isPiInstalled() ? loadPiSettings() : {}
  }
  return _piSettings
}

// ── Shared ModelRegistry singleton ──────────────────────────────────────────

let _registry: ModelRegistry | undefined
let _authStorage: AuthStorage | undefined

function getRegistry(): ModelRegistry {
  if (!_registry) {
    _authStorage = AuthStorage.create()
    _registry = ModelRegistry.create(_authStorage)
  }
  return _registry
}

// ── Models interface (wraps compat + auth resolution) ───────────────────────

export interface ModelsInstance {
  streamSimple(
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
  ): AssistantMessageEventStream
  completeSimple(
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
  ): Promise<AssistantMessage>
}

/** Shared models interface that resolves auth from ModelRegistry before each call. */
export function getModelsInstance(): ModelsInstance {
  return {
    streamSimple(model, context, options) {
      const reg = getRegistry()
      // Resolve auth synchronously is not possible, so we create a wrapper stream
      // that resolves auth first then delegates. The compat streamSimple accepts apiKey in options.
      return streamWithAuth(reg, model, context, options)
    },
    async completeSimple(model, context, options) {
      const reg = getRegistry()
      const auth = await reg.getApiKeyAndHeaders(model)
      if (!auth.ok) throw new Error(`Auth failed for ${model.provider}/${model.id}: ${auth.error}`)
      return completeSimple(model, context, {
        ...options,
        apiKey: auth.apiKey,
        headers: auth.headers,
      })
    },
  }
}

/**
 * Wraps streamSimple with async auth resolution.
 * Returns an AssistantMessageEventStream that resolves auth before streaming.
 */
function streamWithAuth(
  reg: ModelRegistry,
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  let innerIterator: AsyncIterator<AssistantMessageEvent> | null = null
  let authResolved = false

  const stream = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<AssistantMessageEvent>> {
          if (!authResolved) {
            const auth = await reg.getApiKeyAndHeaders(model)
            if (!auth.ok)
              return {
                done: false,
                value: {
                  type: 'error',
                  reason: 'error' as const,
                  error: {
                    role: 'assistant' as const,
                    content: [],
                    api: model.api,
                    provider: model.provider,
                    model: model.id,
                    usage: {
                      input: 0,
                      output: 0,
                      cacheRead: 0,
                      cacheWrite: 0,
                      totalTokens: 0,
                      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
                    },
                    stopReason: 'error' as const,
                    errorMessage: `Auth failed: ${auth.error}`,
                    timestamp: Date.now(),
                  },
                },
              }
            const inner = streamSimple(model, context, {
              ...options,
              apiKey: auth.apiKey,
              headers: auth.headers,
            })
            innerIterator = inner[Symbol.asyncIterator]()
            authResolved = true
          }
          // biome-ignore lint/style/noNonNullAssertion: innerIterator is guaranteed set after authResolved
          return innerIterator!.next()
        },
        async return(value?: AssistantMessageEvent) {
          if (innerIterator?.return) {
            return innerIterator.return(value)
          }
          return { done: true as const, value }
        },
      }
    },
  }
  return stream as AssistantMessageEventStream
}

// ── Model registry helpers ──────────────────────────────────────────────────

/** Find a model by provider/modelId or modelId-only string. */
function findModelById(id: string): Model<Api> | undefined {
  const all = getRegistry().getAll()
  if (id.includes('/')) {
    const [provider, modelId] = id.split('/', 2)
    return all.find(
      (m) => m.provider === provider && (m.id === modelId || m.id.endsWith(`/${modelId}`))
    )
  }
  return all.find((m) => m.id === id || m.id.endsWith(`/${id}`))
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Pick the most appropriate AI model.
 *
 * Priority:
 *   1. `preferred` — explicit model id (e.g. "anthropic/claude-sonnet-4-5")
 *   2. Pi's `defaultModel` from settings.json
 *   3. Pi's `defaultProvider` first model from settings.json
 *   4. First configured model in preference order
 *   5. First fallback model from the full registry in the same preference order
 *
 * Returns `undefined` only when the registry is completely empty (no models registered).
 */
export function pickModel(preferred?: string): Model<Api> | undefined {
  const reg = getRegistry()

  // 1. Explicit preferred model
  if (preferred) {
    const hit = findModelById(preferred)
    if (hit) return hit
  }

  // 2. Pi's defaultModel from settings.json (prefer defaultProvider match)
  const settings = getPiDefaults()

  if (settings.defaultModel) {
    const all = reg.getAll()
    // If defaultProvider is set, prefer the model from that provider
    if (settings.defaultProvider) {
      const providerHit = all.find(
        (m) =>
          m.provider === settings.defaultProvider &&
          (m.id === settings.defaultModel || m.id.endsWith(`/${settings.defaultModel}`))
      )
      if (providerHit) return providerHit
    }
    const hit = findModelById(settings.defaultModel)
    if (hit) return hit
  }

  // 3. Pi's defaultProvider first model
  if (settings.defaultProvider) {
    const providerModels = reg.getAll().filter((m) => m.provider === settings.defaultProvider)
    if (providerModels.length > 0) {
      return providerModels[0]
    }
  }

  // 4. First configured model in preference order
  const available = reg.getAvailable()
  if (available.length > 0) {
    const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
    for (const id of order) {
      const m = available.find((m) => m.id.includes(id))
      if (m) return m
    }
    return available[0]
  }

  // 5. Fallback: any model from the full registry
  const models = reg.getAll()
  if (models.length === 0) return undefined
  const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
  for (const id of order) {
    const m = models.find((m) => m.id.includes(id))
    if (m) return m
  }
  return models[0]
}
