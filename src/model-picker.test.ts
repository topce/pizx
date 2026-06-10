/**
 * Unit tests for model-picker.ts — pickModel logic.
 *
 * Mocks @earendil-works/pi-ai (getProviders, getModels, getEnvApiKey) and
 * load-pi-settings (isPiInstalled, loadPiSettings) to test all pickModel
 * branching paths without real API calls.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@earendil-works/pi-ai', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@earendil-works/pi-ai')>()
  return {
    ...mod,
    getProviders: vi.fn(() => []),
    getModels: vi.fn(() => []),
    getEnvApiKey: vi.fn(() => undefined),
  }
})

vi.mock('./load-pi-settings.ts', () => ({
  isPiInstalled: vi.fn(() => false),
  loadPiSettings: vi.fn(() => ({})),
  getPiAgentDir: vi.fn(() => '/tmp/mock-pi-agent'),
}))

// ── Imports ────────────────────────────────────────────────────────────────

import { getProviders, getModels, getEnvApiKey } from '@earendil-works/pi-ai'
import { isPiInstalled, loadPiSettings } from './load-pi-settings.ts'
import { pickModel } from './model-picker.ts'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Create a fake model entry as returned by pi-ai's getModels(). */
function fakeModel(id: string, provider: string, overrides: Record<string, unknown> = {}) {
  return { id, provider, name: id, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no providers, no models, no auth
  vi.mocked(getProviders).mockReturnValue([])
  vi.mocked(getModels).mockReturnValue([])
  vi.mocked(getEnvApiKey).mockReturnValue(undefined)
  vi.mocked(isPiInstalled).mockReturnValue(false)
  vi.mocked(loadPiSettings).mockReturnValue({})
})

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('pickModel', () => {
  // ── No models available ────────────────────────────────────────────────

  it('returns undefined when no models exist in registry', () => {
    vi.mocked(getProviders).mockReturnValue([])
    expect(pickModel()).toBeUndefined()
  })

  it('returns undefined when all providers have no models', () => {
    vi.mocked(getProviders).mockReturnValue(['anthropic', 'openai'])
    vi.mocked(getModels).mockReturnValue([])
    expect(pickModel()).toBeUndefined()
  })

  // ── Explicit preferred model ───────────────────────────────────────────

  it('returns exact match by full id (provider/model)', () => {
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
    ])
    const result = pickModel('anthropic/claude-sonnet-4-5')
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('returns match by modelId only (provider omitted)', () => {
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
    ])
    const result = pickModel('claude-sonnet-4-5')
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('returns undefined when preferred model not found and registry is empty', () => {
    vi.mocked(getProviders).mockReturnValue([])
    vi.mocked(getModels).mockReturnValue([])
    const result = pickModel('nonexistent/model')
    expect(result).toBeUndefined()
  })

  it('falls through to best available when preferred model not found', () => {
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
    ])
    // No API key configured → falls to registry fallback
    const result = pickModel('nonexistent/model')
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('returns match by endsWith when provider/model format used', () => {
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5-20250219', 'anthropic'),
    ])
    // "anthropic/claude-sonnet-4-5" should match via endsWith
    const result = pickModel('anthropic/claude-sonnet-4-5')
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5-20250219')
  })

  // ── defaultModel from Pi settings ──────────────────────────────────────

  it('uses defaultModel from Pi settings when no preferred model', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({
      defaultModel: 'claude-sonnet-4-5',
    })
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
    ])
    const result = pickModel()
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('ignores defaultModel when not found, falls through', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({
      defaultModel: 'nonexistent-model',
    })
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
    ])
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test') // make it configured
    const result = pickModel()
    // Falls through to first configured model
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  // ── defaultProvider from Pi settings ───────────────────────────────────

  it('uses defaultProvider first model when configured with auth', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({
      defaultProvider: 'openai',
    })
    vi.mocked(getProviders).mockReturnValue(['anthropic', 'openai'])
    vi.mocked(getModels).mockImplementation((provider) => {
      if (provider === 'openai')
        return [fakeModel('openai/gpt-4o', 'openai')]
      return []
    })
    vi.mocked(getEnvApiKey).mockImplementation((provider) => {
      return provider === 'openai' ? 'sk-test' : undefined
    })
    const result = pickModel()
    expect(result?.id).toBe('openai/gpt-4o')
  })

  it('skips defaultProvider when no API key configured', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({
      defaultProvider: 'openai',
    })
    vi.mocked(getProviders).mockReturnValue(['openai', 'anthropic'])
    vi.mocked(getModels).mockImplementation((provider) => {
      if (provider === 'openai')
        return [fakeModel('openai/gpt-4o', 'openai')]
      if (provider === 'anthropic')
        return [fakeModel('anthropic/claude-sonnet-4-5', 'anthropic')]
      return []
    })
    // No API key for openai, but anthropic has one
    vi.mocked(getEnvApiKey).mockImplementation((provider) => {
      return provider === 'anthropic' ? 'sk-ant-test' : undefined
    })
    const result = pickModel()
    // Falls through to first configured model (anthropic)
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('skips defaultProvider when it has no models registered', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({
      defaultProvider: 'unknown',
    })
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockImplementation((provider) => {
      if (provider === 'anthropic')
        return [fakeModel('anthropic/claude-sonnet-4-5', 'anthropic')]
      return []
    })
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test')
    const result = pickModel()
    // Falls through to configured model
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  // ── First configured model in preference order ─────────────────────────

  it('returns claude-sonnet-4-5 when available and configured', () => {
    vi.mocked(getProviders).mockReturnValue(['anthropic', 'openai', 'google'])
    vi.mocked(getModels).mockImplementation((provider) => {
      const models: Record<string, Array<ReturnType<typeof fakeModel>>> = {
        anthropic: [
          fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
          fakeModel('anthropic/claude-sonnet-4', 'anthropic'),
        ],
        openai: [fakeModel('openai/gpt-4o-mini', 'openai')],
        google: [fakeModel('google/gemini-2.5-flash', 'google')],
      }
      return models[provider as string] ?? []
    })
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test') // all configured
    const result = pickModel()
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('falls back through preference order when top picks unavailable', () => {
    vi.mocked(getProviders).mockReturnValue(['openai'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('openai/gpt-4o-mini', 'openai'),
    ])
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test')
    const result = pickModel()
    // gpt-4o-mini is last in preference order but only model available
    expect(result?.id).toBe('openai/gpt-4o-mini')
  })

  it('returns first configured model when no preference match', () => {
    vi.mocked(getProviders).mockReturnValue(['mistral'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('mistral/mistral-large', 'mistral'),
    ])
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test')
    const result = pickModel()
    expect(result?.id).toBe('mistral/mistral-large')
  })

  // ── Fallback: any model from full registry ─────────────────────────────

  it('falls back to full registry when no configured providers', () => {
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
    ])
    // No API keys configured
    vi.mocked(getEnvApiKey).mockReturnValue(undefined)
    const result = pickModel()
    // Falls back to any model from full registry
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('preference-orders fallback models from full registry', () => {
    vi.mocked(getProviders).mockReturnValue(['openai', 'google'])
    vi.mocked(getModels).mockImplementation((provider) => {
      const models: Record<string, Array<ReturnType<typeof fakeModel>>> = {
        openai: [fakeModel('openai/gpt-4o-mini', 'openai')],
        google: [fakeModel('google/gemini-2.5-flash', 'google')],
      }
      return models[provider as string] ?? []
    })
    vi.mocked(getEnvApiKey).mockReturnValue(undefined) // no auth
    const result = pickModel()
    // gemini-2.5-flash is preferred over gpt-4o-mini
    expect(result?.id).toBe('google/gemini-2.5-flash')
  })

  it('returns first fallback model when no preference matches', () => {
    vi.mocked(getProviders).mockReturnValue(['mistral'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('mistral/mistral-large', 'mistral'),
    ])
    vi.mocked(getEnvApiKey).mockReturnValue(undefined)
    const result = pickModel()
    expect(result?.id).toBe('mistral/mistral-large')
  })

  // ── Pi settings behavior ───────────────────────────────────────────────

  it('skips settings when Pi not installed', () => {
    vi.mocked(isPiInstalled).mockReturnValue(false)
    vi.mocked(getProviders).mockReturnValue(['anthropic'])
    vi.mocked(getModels).mockReturnValue([
      fakeModel('anthropic/claude-sonnet-4-5', 'anthropic'),
    ])
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test')

    pickModel()

    // loadPiSettings should NOT be called
    expect(loadPiSettings).not.toHaveBeenCalled()
  })

  // ── Preferred model overrides defaults ─────────────────────────────────

  it('preferred model takes priority over defaultModel', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({
      defaultModel: 'gpt-4o-mini',
    })
    vi.mocked(getProviders).mockReturnValue(['anthropic', 'openai'])
    vi.mocked(getModels).mockImplementation((provider) => {
      if (provider === 'anthropic')
        return [fakeModel('anthropic/claude-sonnet-4-5', 'anthropic')]
      if (provider === 'openai')
        return [fakeModel('openai/gpt-4o-mini', 'openai')]
      return []
    })
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test')

    const result = pickModel('anthropic/claude-sonnet-4-5')
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })

  it('preferred model takes priority over defaultProvider', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({
      defaultProvider: 'openai',
    })
    vi.mocked(getProviders).mockReturnValue(['anthropic', 'openai'])
    vi.mocked(getModels).mockImplementation((provider) => {
      if (provider === 'anthropic')
        return [fakeModel('anthropic/claude-sonnet-4-5', 'anthropic')]
      if (provider === 'openai')
        return [fakeModel('openai/gpt-4o', 'openai')]
      return []
    })
    vi.mocked(getEnvApiKey).mockReturnValue('sk-test')

    const result = pickModel('anthropic/claude-sonnet-4-5')
    expect(result?.id).toBe('anthropic/claude-sonnet-4-5')
  })
})
