import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LetterFn } from '../core/tags.ts'
import { FAKE_MODEL, mountTestCore } from '../testing/helpers.ts'
import { piPlugin } from './pi.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
  vi.restoreAllMocks()
})

function mustLetter(name: string): LetterFn {
  const fn = ctx.letters.get(name)
  if (!fn) throw new Error(`letter ${name} not registered`)
  return fn
}

async function bootPi(cache = false) {
  const dir = await mkdtemp(join(tmpdir(), 'pizx-pi-'))
  mountTestCore(ctx, { cache, cacheDir: dir })
  ctx.plugin(piPlugin)
  await ctx.start()
  return dir
}

describe('π letter plugin', () => {
  it('streams text deltas and returns a LetterOutput', async () => {
    await bootPi()
    const π = mustLetter('π')
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const out = await π`hello`
    expect(out.text).toBe('hello from fake')
    expect(out.modelUsed).toBe(FAKE_MODEL.id)
    expect(out.trace).toHaveLength(0) // usage recording lives in the real Llm service
    expect(write).toHaveBeenCalled()
    expect(out.duration).toBeGreaterThanOrEqual(0)
  })

  it('suppresses output in quiet mode', async () => {
    await bootPi()
    const π = mustLetter('π')
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await π.quiet`hello`
    const writes = write.mock.calls.map((c) => String(c[0]))
    expect(writes.join('')).not.toContain('hello from fake')
  })

  it('registers the pi/ai aliases', async () => {
    await bootPi()
    expect(ctx.letters.get('pi')).toBe(ctx.letters.get('π'))
    expect(ctx.letters.get('ai')).toBe(ctx.letters.get('π'))
  })

  it('validates options at the boundary', async () => {
    await bootPi()
    const π = mustLetter('π')
    expect(() => π({ maxTokens: -5 })`q`).toThrow(/maxTokens/)
  })

  it('streams via π.stream', async () => {
    await bootPi()
    const π = mustLetter('π')
    const chunks: string[] = []
    for await (const chunk of π.stream`hi`) chunks.push(chunk)
    expect(chunks).toEqual(['hello from fake'])
  })

  it('caches results when the cache is enabled', async () => {
    await bootPi(true)
    const π = mustLetter('π')

    const first = await π.cache`repeatable`
    expect(first.fromCache).toBe(false)

    const second = await π.cache`repeatable`
    expect(second.fromCache).toBe(true)
    expect(second.text).toBe(first.text)

    expect(ctx.trace.events.filter((e) => e.kind === 'cache-miss')).toHaveLength(1)
    expect(ctx.trace.events.filter((e) => e.kind === 'cache-hit')).toHaveLength(1)
  })
})
