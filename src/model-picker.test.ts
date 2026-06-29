/**
 * Unit tests for model-picker.ts — pickModel logic.
 *
 * Mocks @earendil-works/pi-coding-agent (AuthStorage, ModelRegistry) and
 * load-pi-settings to test all pickModel branching paths without real auth.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetAll = vi.fn(() => [] as any[])
const mockGetAvailable = vi.fn(() => [] as any[])
const mockGetApiKeyAndHeaders = vi.fn(async () => ({ ok: true, apiKey: 'sk-test' }))

vi.mock('@earendil-works/pi-coding-agent', () => ({
  AuthStorage: { create: vi.fn(() => ({})) },
  ModelRegistry: {
    create: vi.fn(() => ({
      getAll: mockGetAll,
      getAvailable: mockGetAvailable,
      getApiKeyAndHeaders: mockGetApiKeyAndHeaders,
    })),
  },
}))

vi.mock('@earendil-works/pi-ai/compat', () => ({
  streamSimple: vi.fn(),
  completeSimple: vi.fn(),
}))

vi.mock('./load-pi-settings.ts', () => ({
  isPiInstalled: vi.fn(() => false),
  loadPiSettings: vi.fn(() => ({})),
  getPiAgentDir: vi.fn(() => '/tmp/mock-pi-agent'),
}))

// ── Imports ────────────────────────────────────────────────────────────────

import { isPiInstalled, loadPiSettings } from './load-pi-settings.ts'
import { pickModel } from './model-picker.ts'

// ── Helpers ────────────────────────────────────────────────────────────────

function fakeModel(id: string, provider: string, overrides: Record<string, unknown> = {}) {
  return { id, provider, name: id, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAll.mockReturnValue([])
  mockGetAvailable.mockReturnValue([])
  vi.mocked(isPiInstalled).mockReturnValue(false)
  vi.mocked(loadPiSettings).mockReturnValue({})
})

// ═══════════════════════════════════════════════════════════════════════════

describe('pickModel', () => {
  it('returns undefined when no models exist in registry', () => {
    expect(pickModel()).toBeUndefined()
  })

  it('returns undefined when all providers have no models', () => {
    mockGetAll.mockReturnValue([])
    expect(pickModel()).toBeUndefined()
  })

  it('returns exact match by full id (provider/model)', () => {
    mockGetAll.mockReturnValue([fakeModel('claude-sonnet-4-5', 'anthropic')])
    const result = pickModel('anthropic/claude-sonnet-4-5')
    expect(result?.id).toBe('claude-sonnet-4-5')
  })

  it('returns match by modelId only (provider omitted)', () => {
    mockGetAll.mockReturnValue([fakeModel('claude-sonnet-4-5', 'anthropic')])
    const result = pickModel('claude-sonnet-4-5')
    expect(result?.id).toBe('claude-sonnet-4-5')
  })

  it('returns undefined when preferred model not found and registry is empty', () => {
    const result = pickModel('nonexistent/model')
    expect(result).toBeUndefined()
  })

  it('falls through to best available when preferred model not found', () => {
    mockGetAll.mockReturnValue([fakeModel('claude-sonnet-4-5', 'anthropic')])
    const result = pickModel('nonexistent/model')
    expect(result?.id).toBe('claude-sonnet-4-5')
  })

  it('returns match by endsWith when provider/model format used', () => {
    mockGetAll.mockReturnValue([fakeModel('claude-sonnet-4-5-20250219', 'anthropic')])
    const result = pickModel('anthropic/claude-sonnet-4-5')
    expect(result?.id).toBe('claude-sonnet-4-5-20250219')
  })

  // ── defaultModel from Pi settings ──────────────────────────────────────

  it('uses defaultModel from Pi settings when no preferred model', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({ defaultModel: 'claude-sonnet-4-5' })
    mockGetAll.mockReturnValue([fakeModel('claude-sonnet-4-5', 'anthropic')])
    const result = pickModel()
    expect(result?.id).toBe('claude-sonnet-4-5')
  })

  // NOTE: defaultProvider + defaultModel resolution with custom providers is tested
  // end-to-end (pizx -p with ecgpt/gpt-5.1) because the _piSettings cache in
  // model-picker.ts is module-scoped and can't be reset between unit tests.

  // ── First configured model in preference order ─────────────────────────

  it('returns claude-sonnet-4-5 when available and configured', () => {
    mockGetAvailable.mockReturnValue([
      fakeModel('claude-sonnet-4-5', 'anthropic'),
      fakeModel('gpt-4o-mini', 'openai'),
    ])
    mockGetAll.mockReturnValue([
      fakeModel('claude-sonnet-4-5', 'anthropic'),
      fakeModel('gpt-4o-mini', 'openai'),
    ])
    const result = pickModel()
    expect(result?.id).toBe('claude-sonnet-4-5')
  })

  it('returns first configured model when no preference match', () => {
    mockGetAvailable.mockReturnValue([fakeModel('mistral-large', 'mistral')])
    mockGetAll.mockReturnValue([fakeModel('mistral-large', 'mistral')])
    const result = pickModel()
    expect(result?.id).toBe('mistral-large')
  })

  // ── Fallback: any model from full registry ─────────────────────────────

  it('falls back to full registry when no configured providers', () => {
    mockGetAvailable.mockReturnValue([])
    mockGetAll.mockReturnValue([fakeModel('claude-sonnet-4-5', 'anthropic')])
    const result = pickModel()
    expect(result?.id).toBe('claude-sonnet-4-5')
  })

  it('preference-orders fallback models from full registry', () => {
    mockGetAvailable.mockReturnValue([])
    mockGetAll.mockReturnValue([
      fakeModel('gpt-4o-mini', 'openai'),
      fakeModel('gemini-2.5-flash', 'google'),
    ])
    const result = pickModel()
    expect(result?.id).toBe('gemini-2.5-flash')
  })

  // ── Pi settings behavior ───────────────────────────────────────────────

  it('skips settings when Pi not installed', () => {
    vi.mocked(isPiInstalled).mockReturnValue(false)
    mockGetAvailable.mockReturnValue([fakeModel('claude-sonnet-4-5', 'anthropic')])
    mockGetAll.mockReturnValue([fakeModel('claude-sonnet-4-5', 'anthropic')])
    pickModel()
    expect(loadPiSettings).not.toHaveBeenCalled()
  })

  // ── Preferred model overrides defaults ─────────────────────────────────

  it('preferred model takes priority over defaultModel', () => {
    vi.mocked(isPiInstalled).mockReturnValue(true)
    vi.mocked(loadPiSettings).mockReturnValue({ defaultModel: 'gpt-4o-mini' })
    mockGetAll.mockReturnValue([
      fakeModel('claude-sonnet-4-5', 'anthropic'),
      fakeModel('gpt-4o-mini', 'openai'),
    ])
    const result = pickModel('anthropic/claude-sonnet-4-5')
    expect(result?.id).toBe('claude-sonnet-4-5')
  })
})
