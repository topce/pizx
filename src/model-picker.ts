/**
 * Shared model-picking logic for π (pi.ts) and all pattern tags (patterns/types.ts).
 *
 * Picks the best available AI model using this priority:
 *   1. Explicit model id passed by the caller
 *   2. Pi's defaultModel / defaultProvider from ~/.pi/agent/settings.json
 *   3. First configured model (has API key) matching a preference order
 *   4. First fallback model from the full registry matching a preference order
 */

import {
  getEnvApiKey,
  getModels,
  getProviders,
  type Api,
  type KnownProvider,
  type Model,
} from '@earendil-works/pi-ai'

import { isPiInstalled, loadPiSettings, type PiSettings } from './load-pi-settings.ts'

// ── Cached Pi settings ──────────────────────────────────────────────────────

let _piSettings: PiSettings | undefined

function getPiDefaults(): PiSettings {
  if (_piSettings === undefined) {
    _piSettings = isPiInstalled() ? loadPiSettings() : {}
  }
  return _piSettings
}

// ── Model registry helpers ──────────────────────────────────────────────────

/** Return all known models from the pi-ai static registry. */
function allModels(): Model<Api>[] {
  const result: Model<Api>[] = []
  for (const p of getProviders()) {
    const ms = getModels(p)
    if (ms && ms.length > 0) result.push(...ms)
  }
  return result
}

/** Return only providers that have an API key configured. */
function getConfiguredProviders(): string[] {
  return getProviders().filter((p) => getEnvApiKey(p) !== undefined)
}

/** Return models only from providers that have configured auth. */
function configuredModels(): Model<Api>[] {
  const configured = new Set<string>(getConfiguredProviders())
  return allModels().filter((m) => configured.has(m.provider))
}

/** Find a model by provider/modelId or modelId-only string. */
function findModelById(id: string): Model<Api> | undefined {
  const all = allModels()
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
 *   4. First configured model in preference order (claude-sonnet-4-5, claude-sonnet-4,
 *      gemini-2.5-flash, gpt-4o-mini)
 *   5. First fallback model from the full registry in the same preference order
 *
 * Returns `undefined` only when the registry is completely empty (no models registered).
 */
export function pickModel(preferred?: string): Model<Api> | undefined {
  // 1. Explicit preferred model
  if (preferred) {
    const hit = findModelById(preferred)
    if (hit) return hit
  }

  // 2. Pi's defaultModel from settings.json
  const settings = getPiDefaults()

  if (settings.defaultModel) {
    const hit = findModelById(settings.defaultModel)
    if (hit) return hit
  }

  // 3. Pi's defaultProvider first model
  if (settings.defaultProvider) {
    const provider = settings.defaultProvider as KnownProvider
    const providerModels = getModels(provider)
    if (providerModels && providerModels.length > 0) {
      const configured = new Set<string>(getConfiguredProviders())
      if (configured.has(settings.defaultProvider)) {
        return providerModels[0]
      }
    }
  }

  // 4. First configured model in preference order
  const available = configuredModels()
  if (available.length > 0) {
    const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
    for (const id of order) {
      const m = available.find((m) => m.id.includes(id))
      if (m) return m
    }
    return available[0]
  }

  // 5. Fallback: any model from the full registry
  const models = allModels()
  if (models.length === 0) return undefined
  const order = ['claude-sonnet-4-5', 'claude-sonnet-4', 'gemini-2.5-flash', 'gpt-4o-mini']
  for (const id of order) {
    const m = models.find((m) => m.id.includes(id))
    if (m) return m
  }
  return models[0]
}
