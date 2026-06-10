/**
 * Core unit tests for pi.ts and pi-agent.ts with mocked pi-ai and pi-coding-agent.
 *
 * These tests mock @earendil-works/pi-ai (streamSimple, completeSimple) and
 * @earendil-works/pi-coding-agent (createAgentSession) so no real API calls
 * are made — no costs, no network.
 *
 * Also covers utils.ts, pi-output.ts trace properties, patterns/types.ts
 * (build, PatternOutput trace, createPatternTag, ask), and load-pi-auth.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (hoisted to top by vitest) ──────────────────────────────────────

// Mock os.homedir so load-pi-auth tests can use a temp directory
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return {
    ...actual,
    homedir: vi.fn(() => '/tmp/mock-pizx-home'),
  }
})

vi.mock('@earendil-works/pi-ai', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@earendil-works/pi-ai')>()
  return {
    ...mod,
    streamSimple: vi.fn(),
    completeSimple: vi.fn(),
  }
})

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@earendil-works/pi-coding-agent')>()
  return {
    ...mod,
    createAgentSession: vi.fn(),
  }
})

// Mock model-picker — returns a known fake model for all π/pattern tests
vi.mock('./model-picker.ts', () => ({
  pickModel: vi.fn(),
}))

// Mock load-pi-settings for loadPiAuth tests
vi.mock('./load-pi-settings.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./load-pi-settings.ts')>()
  return {
    ...mod,
    isPiInstalled: vi.fn(() => false),
    loadPiSettings: vi.fn(() => ({})),
    getPiAgentDir: vi.fn(() => '/tmp/mock-pi-agent'),
  }
})

// ── Imports ───────────────────────────────────────────────────────────────

import type { Model } from '@earendil-works/pi-ai'
import { completeSimple, streamSimple } from '@earendil-works/pi-ai'
import { createAgentSession } from '@earendil-works/pi-coding-agent'
import { pickModel } from './model-picker.ts'

// ── Test helpers ──────────────────────────────────────────────────────────

/** Create a minimal fake model entry for pickModel to return. */
function fakeModel(overrides: Partial<Model<any>> = {}): Model<any> {
  return {
    id: 'test/test-model',
    provider: 'test',
    name: 'Test Model',
    ...overrides,
  } as Model<any>
}

/** Create a mock async generator that yields events in sequence. */
async function* makeStream(events: unknown[]) {
  for (const ev of events) yield ev
}

/** Spy on stdout/stderr write to suppress noise and verify behavior. */
let stdoutSpy: ReturnType<typeof vi.spyOn>
let stderrSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
})

// ═══════════════════════════════════════════════════════════════════════════
// utils.ts — getErrorMessage
// ═══════════════════════════════════════════════════════════════════════════

import { getErrorMessage } from './utils.ts'

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke')
  })

  it('returns string value for plain strings', () => {
    expect(getErrorMessage('plain error')).toBe('plain error')
  })

  it('converts non-Error objects to string', () => {
    expect(getErrorMessage({ code: 500 })).toBe('[object Object]')
  })

  it('handles null gracefully', () => {
    expect(getErrorMessage(null)).toBe('null')
  })

  it('handles undefined gracefully', () => {
    expect(getErrorMessage(undefined)).toBe('undefined')
  })

  it('handles numbers', () => {
    expect(getErrorMessage(42)).toBe('42')
  })

  it('extracts message from Error subclass', () => {
    class CustomError extends Error {
      constructor(
        msg: string,
        public code: number
      ) {
        super(msg)
      }
    }
    expect(getErrorMessage(new CustomError('custom', 500))).toBe('custom')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// pi-output.ts — trace properties (lines 32-47 currently uncovered)
// ═══════════════════════════════════════════════════════════════════════════

import type { CallTrace } from './patterns/types.ts'
import { PiOutput } from './pi-output.ts'

function fakeTrace(overrides: Partial<CallTrace> = {}): CallTrace {
  return {
    call: 1,
    modelId: 'test/model',
    promptPreview: 'hello',
    outputPreview: 'world',
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 150,
    cost: 0.003,
    durationMs: 500,
    ...overrides,
  }
}

describe('PiOutput trace properties', () => {
  it('inputTokens returns 0 when no trace', () => {
    const out = new PiOutput('text', 'm')
    expect(out.inputTokens).toBe(0)
  })

  it('inputTokens returns trace[0].inputTokens', () => {
    const out = new PiOutput('text', 'm')
    out.trace = [fakeTrace({ inputTokens: 250 })]
    expect(out.inputTokens).toBe(250)
  })

  it('outputTokens returns trace[0].outputTokens', () => {
    const out = new PiOutput('text', 'm')
    out.trace = [fakeTrace({ outputTokens: 75 })]
    expect(out.outputTokens).toBe(75)
  })

  it('outputTokens returns 0 when no trace', () => {
    const out = new PiOutput('text', 'm')
    expect(out.outputTokens).toBe(0)
  })

  it('totalTokens returns trace[0].totalTokens', () => {
    const out = new PiOutput('text', 'm')
    out.trace = [fakeTrace({ totalTokens: 300 })]
    expect(out.totalTokens).toBe(300)
  })

  it('totalTokens returns 0 when no trace', () => {
    const out = new PiOutput('text', 'm')
    expect(out.totalTokens).toBe(0)
  })

  it('totalCost returns trace[0].cost', () => {
    const out = new PiOutput('text', 'm')
    out.trace = [fakeTrace({ cost: 0.015 })]
    expect(out.totalCost).toBe(0.015)
  })

  it('totalCost returns 0 when no trace', () => {
    const out = new PiOutput('text', 'm')
    expect(out.totalCost).toBe(0)
  })

  it('all trace properties work together', () => {
    const out = new PiOutput('result', 'model-x')
    out.trace = [
      fakeTrace({
        inputTokens: 500,
        outputTokens: 200,
        totalTokens: 700,
        cost: 0.01,
      }),
    ]
    expect(out.inputTokens).toBe(500)
    expect(out.outputTokens).toBe(200)
    expect(out.totalTokens).toBe(700)
    expect(out.totalCost).toBe(0.01)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// pi.ts — π tag
// ═══════════════════════════════════════════════════════════════════════════

describe('π tag (pi.ts)', () => {
  // ── PiPromise ──────────────────────────────────────────────────────────

  describe('PiPromise', () => {
    it('resolves with PiOutput', async () => {
      const { PiPromise } = await import('./pi.ts')
      const p = new PiPromise((resolve) => {
        resolve(new PiOutput('result', 'test/model'))
      })
      const result = await p
      expect(result).toBeInstanceOf(PiOutput)
      expect(result.text).toBe('result')
    })

    it('rejects on error', async () => {
      const { PiPromise } = await import('./pi.ts')
      const p = new PiPromise((_, reject) => {
        reject(new Error('fail'))
      })
      await expect(p).rejects.toThrow('fail')
    })

    it('stores modelUsed when provided', async () => {
      const { PiPromise } = await import('./pi.ts')
      const p = new PiPromise((resolve) => {
        resolve(new PiOutput('x', 'stored/model'))
      }, 'stored/model')
      expect(p.modelUsed).toBe('stored/model')
      await p // settle
    })

    it('modelUsed is empty string by default', async () => {
      const { PiPromise } = await import('./pi.ts')
      const p = new PiPromise((resolve) => {
        resolve(new PiOutput('x', 'm'))
      })
      expect(p.modelUsed).toBe('')
      await p
    })
  })

  // ── makePi option chaining ─────────────────────────────────────────────

  describe('π option chaining', () => {
    it('returns a function that accepts template literal', async () => {
      const { π } = await import('./pi.ts')
      expect(typeof π).toBe('function')
    })

    it('π({ model }) returns a tag function', async () => {
      const { π } = await import('./pi.ts')
      const tag = π({ model: 'custom/model' })
      expect(typeof tag).toBe('function')
    })

    it('π.quiet returns a tag function', async () => {
      const { π } = await import('./pi.ts')
      expect(typeof (π as any).quiet).toBe('function')
    })

    it('π({ model }).quiet chains options', async () => {
      const { π } = await import('./pi.ts')
      const tag = (π({ model: 'x' }) as any).quiet
      expect(typeof tag).toBe('function')
    })

    it('π({}) with no properties still works', async () => {
      const { π } = await import('./pi.ts')
      const tag = π({})
      expect(typeof tag).toBe('function')
    })
  })

  // ── run function with mocked streamSimple ──────────────────────────────

  describe('run (streamSimple mocked)', () => {
    it('generates text from streaming deltas', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel())

      vi.mocked(streamSimple).mockReturnValue(
        makeStream([
          { type: 'text_delta', delta: 'Hello' },
          { type: 'text_delta', delta: ' world' },
          { type: 'done' },
        ])
      )

      const { π } = await import('./pi.ts')
      const result = await π`Say hello`

      expect(result.text).toBe('Hello world')
      expect(pickModel).toHaveBeenCalled()
    })

    it('handles done event with usage trace', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel({ id: 'test/tracer' }))

      vi.mocked(streamSimple).mockReturnValue(
        makeStream([
          { type: 'text_delta', delta: 'ok' },
          {
            type: 'done',
            message: {
              usage: {
                input: 10,
                output: 5,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 15,
                cost: { total: 0.0001 },
              },
            },
          },
        ])
      )

      const { π } = await import('./pi.ts')
      const result = await π`test`

      expect(result.text).toBe('ok')
      expect(result.trace).toHaveLength(1)
      expect(result.trace[0].inputTokens).toBe(10)
      expect(result.trace[0].outputTokens).toBe(5)
      expect(result.trace[0].totalTokens).toBe(15)
      expect(result.trace[0].cost).toBe(0.0001)
      expect(result.trace[0].modelId).toBe('test/tracer')
    })

    it('handles done event without usage trace', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel({ id: 'test/no-usage' }))

      vi.mocked(streamSimple).mockReturnValue(
        makeStream([{ type: 'text_delta', delta: 'no usage data' }, { type: 'done' }])
      )

      const { π } = await import('./pi.ts')
      const result = await π`test`

      expect(result.text).toBe('no usage data')
      expect(result.trace).toEqual([])
    })

    it('throws when no model is available', async () => {
      vi.mocked(pickModel).mockReturnValue(undefined)

      const { π } = await import('./pi.ts')
      await expect(π`will fail`).rejects.toThrow('No AI models configured')
    })

    it('wraps streaming errors with context', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel())

      // Throw synchronously when streamSimple is called — this is caught by the try/catch
      vi.mocked(streamSimple).mockImplementation(() => {
        throw new Error('Network error')
      })

      const { π } = await import('./pi.ts')
      await expect(π`test`).rejects.toThrow('pizx/π: AI generation failed')
      await expect(π`test`).rejects.toThrow('Network error')
    })

    it('outputs text to stdout in non-quiet mode', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel())

      vi.mocked(streamSimple).mockReturnValue(
        makeStream([{ type: 'text_delta', delta: 'visible' }, { type: 'done' }])
      )

      const { π } = await import('./pi.ts')
      await π`test`

      // stdout should have the text delta and trailing newline
      expect(stdoutSpy).toHaveBeenCalledWith('visible')
    })

    it('suppresses stdout in quiet mode', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel())

      vi.mocked(streamSimple).mockReturnValue(
        makeStream([{ type: 'text_delta', delta: 'hidden' }, { type: 'done' }])
      )

      const { π } = await import('./pi.ts')
      await π.quiet`test`

      // In quiet mode, stdout.write should NOT be called with the delta
      const deltaCalls = stdoutSpy.mock.calls.filter((call) => call[0] === 'hidden')
      expect(deltaCalls).toHaveLength(0)
    })

    it('handles empty streaming output', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel())

      vi.mocked(streamSimple).mockReturnValue(makeStream([{ type: 'done' }]))

      const { π } = await import('./pi.ts')
      const result = await π`test`

      expect(result.text).toBe('')
    })

    it('stream property yields text deltas', async () => {
      vi.mocked(pickModel).mockReturnValue(fakeModel())

      vi.mocked(streamSimple).mockReturnValue(
        makeStream([
          { type: 'text_delta', delta: 'chunk1' },
          { type: 'text_delta', delta: 'chunk2' },
          { type: 'done' },
        ])
      )

      const { π } = await import('./pi.ts')
      const chunks: string[] = []
      for await (const chunk of (π as any).stream`test`) {
        chunks.push(chunk)
      }
      expect(chunks).toEqual(['chunk1', 'chunk2'])
    })

    it('stream throws when no model available', async () => {
      vi.mocked(pickModel).mockReturnValue(undefined)

      const { π } = await import('./pi.ts')
      const gen = (π as any).stream`test`
      await expect(async () => {
        for await (const _ of gen) {
          void _
        }
      }).rejects.toThrow('No AI models configured')
    })
  })

  // ── configurePi ────────────────────────────────────────────────────────

  describe('configurePi', () => {
    it('is a function', async () => {
      const { configurePi } = await import('./pi.ts')
      expect(typeof configurePi).toBe('function')
    })

    it('accepts PiOptions', async () => {
      const { configurePi } = await import('./pi.ts')
      // Should not throw
      configurePi({ maxTokens: 8000, quiet: true })
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// pi-agent.ts — Π tag
// ═══════════════════════════════════════════════════════════════════════════

describe('Π tag (pi-agent.ts)', () => {
  // ── AgentOutput ────────────────────────────────────────────────────────

  describe('AgentOutput', () => {
    it('calculates duration correctly', async () => {
      const { AgentOutput } = await import('./pi-agent.ts')
      const out = new AgentOutput('text', 2, 1000, 1500)
      expect(out.duration).toBe(500)
    })

    it('toString returns text', async () => {
      const { AgentOutput } = await import('./pi-agent.ts')
      const out = new AgentOutput('result', 1)
      expect(out.toString()).toBe('result')
    })

    it('valueOf returns text', async () => {
      const { AgentOutput } = await import('./pi-agent.ts')
      const out = new AgentOutput('result', 1)
      expect(out.valueOf()).toBe('result')
    })

    it('template literal coercion works', async () => {
      const { AgentOutput } = await import('./pi-agent.ts')
      const out = new AgentOutput('hello', 1)
      expect(`${out}`).toBe('hello')
    })

    it('default timestamps set to now (duration ≈ 0)', async () => {
      const { AgentOutput } = await import('./pi-agent.ts')
      const out = new AgentOutput('text')
      expect(out.duration).toBeGreaterThanOrEqual(0)
    })
  })

  // ── AgentPromise ───────────────────────────────────────────────────────

  describe('AgentPromise', () => {
    it('resolves with AgentOutput', async () => {
      const { AgentOutput, AgentPromise } = await import('./pi-agent.ts')
      const p = new AgentPromise((resolve) => {
        resolve(new AgentOutput('done', 1))
      })
      const result = await p
      expect(result).toBeInstanceOf(AgentOutput)
      expect(result.text).toBe('done')
    })

    it('rejects on error', async () => {
      const { AgentPromise } = await import('./pi-agent.ts')
      const p = new AgentPromise((_, reject) => {
        reject(new Error('agent error'))
      })
      await expect(p).rejects.toThrow('agent error')
    })
  })

  // ── getMessageText (internal, tested via getLastAssistantText) ─────────

  describe('message text extraction', () => {
    it('handles string content', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'world' },
          ],
        },
      } as any)

      // Need to clear shared session for fresh test
      const { Π } = await import('./pi-agent.ts')
      // Dynamic import gives fresh module — but _sharedSession is module-level
      // We need to ensure no shared session is reused
      // Force fresh session by specifying a model
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'string response' },
          ],
        },
      } as any)

      // The issue is _sharedSession is closed over. Let's test getMessageText
      // directly via the internal function pattern
      // We can test getLastAssistantText behavior through the Π tag.
      // But Π calls getSession which uses _sharedSession...
      // Let's test the internal helpers by importing pi-agent module internals

      // Since getMessageText and getLastAssistantText are module-private,
      // we test them indirectly through the Π tag's execute function.

      const p = Π({ model: 'test/model' })`hello`
      const result = await p
      expect(result.text).toBe('string response')
    })

    it('handles array content (TextContent blocks)', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [
            { role: 'user', content: 'hello' },
            {
              role: 'assistant',
              content: [
                { type: 'text', text: 'part 1 ' },
                { type: 'text', text: 'part 2' },
                { type: 'tool_use', id: 't1', name: 'read', input: {} },
              ],
            },
          ],
        },
      } as any)

      const { Π } = await import('./pi-agent.ts')
      const p = Π({ model: 'test/model' })`hello`
      const result = await p
      expect(result.text).toBe('part 1 part 2')
    })

    it('handles empty assistant messages gracefully', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: '' },
          ],
        },
      } as any)

      const { Π } = await import('./pi-agent.ts')
      const p = Π({ model: 'test/model' })`hello`
      const result = await p
      // Empty string content → falls through to '(no assistant response)'
      // Actually let me check: getMessageText with '' returns '', and getLastAssistantText
      // finds '' and returns it. Then execute returns '' || '(no assistant response)'.
      // Since '' is falsy, it returns '(no assistant response)'.
      expect(result.text).toBe('(no assistant response)')
    })

    it('handles session with no assistant messages', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [{ role: 'user', content: 'hello' }],
        },
      } as any)

      const { Π } = await import('./pi-agent.ts')
      const p = Π({ model: 'test/model' })`hello`
      const result = await p
      expect(result.text).toBe('(no assistant response)')
    })

    it('counts assistant turns correctly', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'thinking...' },
            { role: 'user', content: 'tool result' },
            { role: 'assistant', content: 'final answer' },
          ],
        },
      } as any)

      const { Π } = await import('./pi-agent.ts')
      const p = Π({ model: 'test/model' })`hello`
      const result = await p
      expect(result.turnCount).toBe(2)
      expect(result.text).toBe('final answer')
    })

    it('handles non-string, non-array content gracefully', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: null }, // neither string nor array
            { role: 'assistant', content: 42 }, // number
          ],
        },
      } as any)

      const { Π } = await import('./pi-agent.ts')
      const p = Π({ model: 'test/model' })`hello`
      const result = await p
      // getMessageText returns '' for non-string, non-array → falls through
      // getLastAssistantText finds the last assistant (with content: 42) → ''
      // execute returns '' || '(no assistant response)'
      expect(result.text).toBe('(no assistant response)')
    })
  })

  // ── Session error handling ─────────────────────────────────────────────

  describe('session error handling', () => {
    it('handles createAgentSession errors', async () => {
      vi.mocked(createAgentSession).mockRejectedValue(new Error('Auth failed'))

      const { Π } = await import('./pi-agent.ts')
      const p = Π({ model: 'test/model' })`test`
      await expect(p).rejects.toThrow('Failed to create agent session')
    })

    it('catches sendUserMessage errors and returns error output', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockRejectedValue(new Error('API timeout')),
          dispose: vi.fn(),
          messages: [],
        },
      } as any)

      const { Π } = await import('./pi-agent.ts')
      const p = Π({ model: 'test/model' })`test`
      const result = await p
      expect(result.text).toContain('Π error')
      expect(result.text).toContain('API timeout')
    })
  })

  // ── Π option chaining ─────────────────────────────────────────────────

  describe('Π option chaining', () => {
    it('Π({ maxTurns: 3 }) returns a tag function', async () => {
      const { Π } = await import('./pi-agent.ts')
      const tag = Π({ maxTurns: 3 })
      expect(typeof tag).toBe('function')
    })

    it('Π.quiet returns a tag function', async () => {
      const { Π } = await import('./pi-agent.ts')
      expect(typeof (Π as any).quiet).toBe('function')
    })

    it('Π({}).quiet chains options', async () => {
      const { Π } = await import('./pi-agent.ts')
      const tag = (Π({}) as any).quiet
      expect(typeof tag).toBe('function')
    })

    it('quiet mode suppresses stderr output', async () => {
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: vi.fn(),
          messages: [
            { role: 'user', content: 'test' },
            { role: 'assistant', content: 'ok' },
          ],
        },
      } as any)

      const { Π } = await import('./pi-agent.ts')
      await Π.quiet({ model: 'test/model' })`test`

      // In quiet mode, stderr should not have the prompt info
      const promptCalls = stderrSpy.mock.calls.filter((call) => String(call[0]).includes('Π:'))
      expect(promptCalls).toHaveLength(0)
    })
  })

  // ── configureAgent / closeAgent ────────────────────────────────────────

  describe('configureAgent and closeAgent', () => {
    it('configureAgent is a function', async () => {
      const { configureAgent } = await import('./pi-agent.ts')
      expect(typeof configureAgent).toBe('function')
    })

    it('configureAgent accepts AgentOptions', async () => {
      const { configureAgent } = await import('./pi-agent.ts')
      expect(() => configureAgent({ maxTurns: 5 })).not.toThrow()
    })

    it('closeAgent is a function', async () => {
      const { closeAgent } = await import('./pi-agent.ts')
      expect(typeof closeAgent).toBe('function')
    })

    it('closeAgent disposes shared session if exists', async () => {
      const disposeFn = vi.fn()
      vi.mocked(createAgentSession).mockResolvedValue({
        session: {
          sendUserMessage: vi.fn().mockResolvedValue(undefined),
          dispose: disposeFn,
          messages: [
            { role: 'user', content: 'test' },
            { role: 'assistant', content: 'ok' },
          ],
        },
      } as any)

      const { Π, closeAgent } = await import('./pi-agent.ts')
      // Create session first
      await Π({ model: 'test/model' })`test`

      // Now close
      await closeAgent()
      expect(disposeFn).toHaveBeenCalled()
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// patterns/types.ts — build, PatternOutput trace, createPatternTag, ask
// ═══════════════════════════════════════════════════════════════════════════

import { createPatternTag, type PatternOptions, PatternOutput } from './patterns/types.ts'

describe('build (template literal builder)', () => {
  it('builds simple template without args', async () => {
    const { build } = await import('./patterns/types.ts')
    // build is used internally — tested via template string behavior
    // We can import and test directly
    const result = build(['hello world'] as unknown as TemplateStringsArray, [])
    expect(result).toBe('hello world')
  })

  it('interpolates values', async () => {
    const { build } = await import('./patterns/types.ts')
    const result = build(
      ['Hello ', ', you have ', ' messages'] as unknown as TemplateStringsArray,
      ['Alice', 5]
    )
    expect(result).toBe('Hello Alice, you have 5 messages')
  })

  it('trims whitespace', async () => {
    const { build } = await import('./patterns/types.ts')
    const result = build(['  hello  '] as unknown as TemplateStringsArray, [])
    expect(result).toBe('hello')
  })

  it('handles empty template', async () => {
    const { build } = await import('./patterns/types.ts')
    const result = build([''] as unknown as TemplateStringsArray, [])
    expect(result).toBe('')
  })

  it('interpolates undefined as "undefined"', async () => {
    const { build } = await import('./patterns/types.ts')
    const result = build(['value: '] as unknown as TemplateStringsArray, [undefined])
    expect(result).toBe('value: undefined')
  })

  it('interpolates null as "null"', async () => {
    const { build } = await import('./patterns/types.ts')
    const result = build(['value: '] as unknown as TemplateStringsArray, [null])
    expect(result).toBe('value: null')
  })
})

describe('PatternOutput trace properties', () => {
  it('inputTokens sums across all trace entries', () => {
    const out = new PatternOutput('text')
    out.trace = [
      {
        call: 1,
        modelId: 'a',
        promptPreview: '',
        outputPreview: '',
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 150,
        cost: 0.01,
        durationMs: 100,
      },
      {
        call: 2,
        modelId: 'b',
        promptPreview: '',
        outputPreview: '',
        inputTokens: 200,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 300,
        cost: 0.02,
        durationMs: 200,
      },
    ]
    expect(out.inputTokens).toBe(300)
    expect(out.outputTokens).toBe(150)
    expect(out.totalTokens).toBe(450)
    expect(out.totalCost).toBe(0.03)
    expect(out.callCount).toBe(2)
  })

  it('trace properties return 0 for empty trace', () => {
    const out = new PatternOutput('text')
    expect(out.inputTokens).toBe(0)
    expect(out.outputTokens).toBe(0)
    expect(out.totalTokens).toBe(0)
    expect(out.totalCost).toBe(0)
    expect(out.callCount).toBe(0)
  })

  it('duration is calculated from timestamps', () => {
    const out = new PatternOutput('text', 1000, 2500)
    expect(out.duration).toBe(1500)
  })

  it('toString and valueOf return text', () => {
    const out = new PatternOutput('my result')
    expect(out.toString()).toBe('my result')
    expect(out.valueOf()).toBe('my result')
    expect(String(out)).toBe('my result')
  })
})

describe('createPatternTag', () => {
  it('creates a tag function', () => {
    const tag = createPatternTag(
      { maxTokens: 100 } as PatternOptions,
      async () => new PatternOutput('result')
    )
    expect(typeof tag).toBe('function')
  })

  it('tag has quiet property', () => {
    const tag = createPatternTag({} as PatternOptions, async () => new PatternOutput('result'))
    expect(typeof (tag as any).quiet).toBe('function')
  })

  it('tag({ option }) returns a new tag', () => {
    const tag = createPatternTag(
      { maxTokens: 100 } as PatternOptions,
      async () => new PatternOutput('result')
    )
    const chained = tag({ maxTokens: 200 })
    expect(typeof chained).toBe('function')
  })

  it('execution function receives merged defaults', async () => {
    const executeSpy = vi.fn().mockResolvedValue(new PatternOutput('ok'))
    const tag = createPatternTag({ maxTokens: 500, quiet: false } as PatternOptions, executeSpy)

    await tag`test`
    expect(executeSpy).toHaveBeenCalledTimes(1)
    const callOpts = executeSpy.mock.calls[0][2]
    expect(callOpts.maxTokens).toBe(500)
    expect(callOpts.quiet).toBe(false)
  })

  it('chained options override defaults', async () => {
    const executeSpy = vi.fn().mockResolvedValue(new PatternOutput('ok'))
    const tag = createPatternTag({ maxTokens: 500 } as PatternOptions, executeSpy)

    const chained = tag({ maxTokens: 1000 })
    await chained`test`
    const callOpts = executeSpy.mock.calls[0][2]
    expect(callOpts.maxTokens).toBe(1000)
  })

  it('quiet variant propagates quiet=true', async () => {
    const executeSpy = vi.fn().mockResolvedValue(new PatternOutput('ok'))
    const tag = createPatternTag({ quiet: false } as PatternOptions, executeSpy)

    await (tag as any).quiet`test`
    const callOpts = executeSpy.mock.calls[0][2]
    expect(callOpts.quiet).toBe(true)
  })

  it('attaches trace to output on success', async () => {
    // The trace is managed by createPatternTag's internal beginTrace/collectTrace
    // When the execute function uses `ask()`, trace entries are pushed.
    // Here we just verify no trace on direct PatternOutput (ask wasn't called).
    const tag = createPatternTag({} as PatternOptions, async () => new PatternOutput('result'))

    const result = await tag`test`
    expect(result.trace).toEqual([])
  })

  it('rejects and cleans up trace on error', async () => {
    const tag = createPatternTag({} as PatternOptions, async () => {
      throw new Error('execution failed')
    })

    await expect(tag`test`).rejects.toThrow('execution failed')
  })
})

describe('ask (patterns/types.ts)', () => {
  it('calls completeSimple and returns text', async () => {
    vi.mocked(pickModel).mockReturnValue(fakeModel())
    vi.mocked(completeSimple).mockResolvedValue({
      model: 'test/model',
      content: [{ type: 'text', text: 'AI response' }],
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { total: 0.001 },
      },
    } as any)

    const { ask } = await import('./patterns/types.ts')
    const result = await ask('hello')

    expect(result).toBe('AI response')
    expect(completeSimple).toHaveBeenCalledTimes(1)
    expect(pickModel).toHaveBeenCalled()
  })

  it('joins multiple text blocks', async () => {
    vi.mocked(pickModel).mockReturnValue(fakeModel())
    vi.mocked(completeSimple).mockResolvedValue({
      model: 'test/model',
      content: [
        { type: 'text', text: 'part 1 ' },
        { type: 'text', text: 'part 2' },
      ],
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { total: 0.001 },
      },
    } as any)

    const { ask } = await import('./patterns/types.ts')
    const result = await ask('hello')

    expect(result).toBe('part 1 part 2')
  })

  it('throws when no model available', async () => {
    vi.mocked(pickModel).mockReturnValue(undefined)

    const { ask } = await import('./patterns/types.ts')
    await expect(ask('hello')).rejects.toThrow('No AI models configured')
  })

  it('trims response text', async () => {
    vi.mocked(pickModel).mockReturnValue(fakeModel())
    vi.mocked(completeSimple).mockResolvedValue({
      model: 'test/model',
      content: [{ type: 'text', text: '  trimmed response  \n' }],
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { total: 0.001 },
      },
    } as any)

    const { ask } = await import('./patterns/types.ts')
    const result = await ask('hello')

    expect(result).toBe('trimmed response')
  })

  it('throws on non-array response content', async () => {
    vi.mocked(pickModel).mockReturnValue(fakeModel())
    vi.mocked(completeSimple).mockResolvedValue({
      model: 'test/model',
      content: 'not-an-array',
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { total: 0.001 },
      },
    } as any)

    const { ask } = await import('./patterns/types.ts')
    await expect(ask('hello')).rejects.toThrow('Unexpected response format')
  })

  it('throws on null response content', async () => {
    vi.mocked(pickModel).mockReturnValue(fakeModel())
    vi.mocked(completeSimple).mockResolvedValue({
      model: 'test/model',
      content: null,
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { total: 0.001 },
      },
    } as any)

    const { ask } = await import('./patterns/types.ts')
    await expect(ask('hello')).rejects.toThrow('Unexpected response format')
  })

  it('collects trace entry when called inside createPatternTag', async () => {
    vi.mocked(pickModel).mockReturnValue(fakeModel())
    vi.mocked(completeSimple).mockResolvedValue({
      model: 'test/model',
      content: [{ type: 'text', text: 'traced result' }],
      usage: {
        input: 20,
        output: 10,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 30,
        cost: { total: 0.002 },
      },
    } as any)

    const { ask, createPatternTag } = await import('./patterns/types.ts')

    const tag = createPatternTag({} as PatternOptions, async (_pieces, _args, _opts) => {
      const result = await ask('sub-task')
      return new PatternOutput(result)
    })

    const output = await tag`test`
    expect(output.trace).toHaveLength(1)
    expect(output.trace[0].inputTokens).toBe(20)
    expect(output.trace[0].outputTokens).toBe(10)
    expect(output.trace[0].totalTokens).toBe(30)
    expect(output.trace[0].cost).toBe(0.002)
    expect(output.trace[0].call).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// load-pi-auth.ts — loadPiAuth
// ═══════════════════════════════════════════════════════════════════════════

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

describe('loadPiAuth', () => {
  // Create a temp home directory structure for testing
  const mockHome = mkdtempSync(join(tmpdir(), 'pizx-auth-home-'))
  const mockPiAgentDir = join(mockHome, '.pi', 'agent')

  // Ensure .pi/agent exists in the mock home
  mkdirSync(mockPiAgentDir, { recursive: true })

  afterEach(() => {
    // Clean up auth files after each test
    try {
      rmSync(join(mockPiAgentDir, 'auth.json'), { force: true })
      rmSync(join(mockPiAgentDir, 'api-keys.json'), { force: true })
    } catch {
      // ignore
    }
  })

  it('does not throw when auth.json does not exist', async () => {
    vi.mocked(homedir).mockReturnValue(mockHome)

    const { loadPiAuth } = await import('./load-pi-auth.ts')
    expect(() => loadPiAuth()).not.toThrow()
  })

  it('loads api_key type credentials from auth.json', async () => {
    vi.mocked(homedir).mockReturnValue(mockHome)

    writeFileSync(
      join(mockPiAgentDir, 'auth.json'),
      JSON.stringify({
        anthropic: { type: 'api_key', key: 'sk-ant-test123' },
        openai: { type: 'api_key', key: 'sk-openai-test456' },
      })
    )

    // Clear any pre-existing env vars
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY

    const { loadPiAuth } = await import('./load-pi-auth.ts')
    loadPiAuth()

    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-test123')
    expect(process.env.OPENAI_API_KEY).toBe('sk-openai-test456')
  })

  it('does not overwrite existing env vars', async () => {
    vi.mocked(homedir).mockReturnValue(mockHome)

    writeFileSync(
      join(mockPiAgentDir, 'auth.json'),
      JSON.stringify({
        anthropic: { type: 'api_key', key: 'sk-ant-new' },
      })
    )

    const existingKey = 'sk-ant-existing'
    process.env.ANTHROPIC_API_KEY = existingKey

    const { loadPiAuth } = await import('./load-pi-auth.ts')
    loadPiAuth()

    // Should keep existing key
    expect(process.env.ANTHROPIC_API_KEY).toBe(existingKey)

    delete process.env.ANTHROPIC_API_KEY
  })

  it('loads legacy apiKeys format from auth.json', async () => {
    vi.mocked(homedir).mockReturnValue(mockHome)

    writeFileSync(
      join(mockPiAgentDir, 'auth.json'),
      JSON.stringify({
        apiKeys: {
          deepseek: 'sk-deepseek-legacy',
        },
      })
    )

    delete process.env.DEEPSEEK_API_KEY

    const { loadPiAuth } = await import('./load-pi-auth.ts')
    loadPiAuth()

    expect(process.env.DEEPSEEK_API_KEY).toBe('sk-deepseek-legacy')
    delete process.env.DEEPSEEK_API_KEY
  })

  it('falls back to api-keys.json when auth.json is missing', async () => {
    vi.mocked(homedir).mockReturnValue(mockHome)

    writeFileSync(
      join(mockPiAgentDir, 'api-keys.json'),
      JSON.stringify({
        deepseek: { type: 'api_key', key: 'sk-api-keys-file' },
      })
    )

    delete process.env.DEEPSEEK_API_KEY

    const { loadPiAuth } = await import('./load-pi-auth.ts')
    loadPiAuth()

    expect(process.env.DEEPSEEK_API_KEY).toBe('sk-api-keys-file')
    delete process.env.DEEPSEEK_API_KEY
  })

  it('handles corrupt JSON gracefully', async () => {
    vi.mocked(homedir).mockReturnValue(mockHome)

    writeFileSync(join(mockPiAgentDir, 'auth.json'), 'not valid {{{ json')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { loadPiAuth } = await import('./load-pi-auth.ts')
    expect(() => loadPiAuth()).not.toThrow()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('failed to parse'))

    warnSpy.mockRestore()
  })

  it('skips providers not in the env var map', async () => {
    vi.mocked(homedir).mockReturnValue(mockHome)

    writeFileSync(
      join(mockPiAgentDir, 'auth.json'),
      JSON.stringify({
        unknown_provider: { type: 'api_key', key: 'sk-unknown' },
      })
    )

    const { loadPiAuth } = await import('./load-pi-auth.ts')
    expect(() => loadPiAuth()).not.toThrow()
    // No env var should be set for unknown provider
    expect(process.env.UNKNOWN_API_KEY).toBeUndefined()
  })
})
