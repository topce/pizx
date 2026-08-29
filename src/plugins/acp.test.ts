/**
 * α letter plugin tests — boot a context WITHOUT any llm service to prove the
 * letter is fully independent of pi, and run it against the mock ACP server.
 */

import { fileURLToPath } from 'node:url'
import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Letters } from '../core/letters.ts'
import type { LetterFn } from '../core/tags.ts'
import { Trace } from '../core/trace.ts'
import { acpPlugin } from './acp.ts'

const MOCK = fileURLToPath(new URL('../testing/acp-mock-server.mjs', import.meta.url))

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
  vi.restoreAllMocks()
})

async function boot(): Promise<void> {
  ctx.plugin({
    name: 'test-core',
    apply(ctx: Context) {
      ctx.plugin(Trace)
      ctx.plugin(Letters)
    },
  })
  ctx.plugin(acpPlugin)
  await ctx.start()
}

function mustLetter(name: string): LetterFn {
  const fn = ctx.letters.get(name)
  if (!fn) throw new Error(`letter ${name} not registered`)
  return fn
}

describe('α letter plugin', () => {
  it('registers α with the acp/agent aliases and cache: false', async () => {
    await boot()
    const entry = ctx.letters.entries().find((e) => e.name === 'α')
    expect(entry).toBeTruthy()
    expect(entry?.aliases).toEqual(['acp', 'agent'])
    expect(entry?.cacheable).toBe(false)
    expect(ctx.letters.get('acp')).toBe(ctx.letters.get('α'))
    expect(ctx.letters.get('agent')).toBe(ctx.letters.get('α'))
  })

  it('rejects with a friendly error when no server is specified', async () => {
    await boot()
    const α = mustLetter('α')
    await expect(α`hello`).rejects.toThrow('no ACP server specified')
  })

  it('runs a prompt turn without any llm service (no pi involved)', async () => {
    await boot()
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const α = mustLetter('α')

    const out = await α({ server: [process.execPath, MOCK] })`hello`

    expect(out.text).toBe('Hello from the mock agent')
    expect(out.modelUsed).toBe(`acp:${process.execPath} ${MOCK}`)
    expect(out.turnCount).toBe(1)
    expect(out.fromCache).toBe(false)
    expect(out.duration).toBeGreaterThanOrEqual(0)
    // stdout receives the streamed chunks (not quiet by default)
    expect(write.mock.calls.map((c) => String(c[0])).join('')).toContain(
      'Hello from the mock agent'
    )
  })

  it('records tool-call and usage trace events on the letter span', async () => {
    await boot()
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const α = mustLetter('α')

    const out = await α({ server: [process.execPath, MOCK] })`hello`

    const toolEvents = ctx.trace.events.filter((e) => e.kind === 'tool-call')
    expect(toolEvents).toHaveLength(2) // call-1 pending + completed
    expect(toolEvents[0]).toMatchObject({
      server: `${process.execPath} ${MOCK}`,
      toolCallId: 'call-1',
      status: 'pending',
    })

    const llmCalls = ctx.trace.events.filter((e) => e.kind === 'llm-call')
    expect(llmCalls).toHaveLength(1)
    expect(llmCalls[0]).toMatchObject({
      modelId: `acp:${process.execPath} ${MOCK}`,
      inputTokens: 20,
      outputTokens: 22,
      totalTokens: 42,
    })

    // The letter output carries the span's LLM calls for token getters.
    expect(out.inputTokens).toBe(20)
    expect(out.outputTokens).toBe(22)
    expect(out.totalTokens).toBe(42)
  })

  it('suppresses streamed output in quiet mode', async () => {
    await boot()
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const α = mustLetter('α')

    await α.quiet({ server: [process.execPath, MOCK] })`hello`

    const stdout = write.mock.calls.map((c) => String(c[0])).join('')
    expect(stdout).not.toContain('Hello from the mock agent')
  })

  it('streams text chunks via .stream', async () => {
    await boot()
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const α = mustLetter('α')

    const chunks: string[] = []
    for await (const chunk of α({ server: [process.execPath, MOCK] }).stream`hello`) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Hello from ', 'the mock agent'])
  })
})
