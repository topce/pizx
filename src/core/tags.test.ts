import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@cordisjs/core'
import Schema from 'schemastery'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FAKE_MODEL, mountTestCore } from '../testing/helpers.ts'
import { type LetterFn, LetterOutput } from './tags.ts'

let ctx: Context
let cacheDir: string

beforeEach(async () => {
  ctx = new Context()
  cacheDir = await mkdtemp(join(tmpdir(), 'pizx-tags-'))
})

afterEach(async () => {
  await ctx.stop()
})

function mustLetter(name: string): LetterFn {
  const fn = ctx.letters.get(name)
  if (!fn) throw new Error(`letter ${name} not registered`)
  return fn
}

function defineEcho(cacheable = true) {
  return ctx.letters.define('η', {
    aliases: ['eta'],
    cache: cacheable ? undefined : false,
    run: (prompt, opts: { suffix?: string; cache?: boolean }, env) => {
      env.span?.emit({
        kind: 'llm-call',
        modelId: FAKE_MODEL.id,
        inputTokens: 7,
        outputTokens: 3,
        cacheReadTokens: 1,
        cacheWriteTokens: 2,
        totalTokens: 10,
        costUsd: 0.01,
        durationMs: 5,
      })
      return `${prompt}${opts.suffix ?? ''}`
    },
  })
}

describe('letter tags (createLetterTag runner)', () => {
  it('runs letters and returns a coercible LetterOutput with trace', async () => {
    mountTestCore(ctx)
    await ctx.start()
    const η = defineEcho()

    const out = await η`hello`
    expect(out).toBeInstanceOf(LetterOutput)
    expect(out.text).toBe('hello')
    expect(out.modelUsed).toBeUndefined()
    expect(`${out}`).toBe('hello')
    expect(out.valueOf()).toBe('hello')
    expect(out.trace).toHaveLength(1)
    expect(out.inputTokens).toBe(7)
    expect(out.outputTokens).toBe(3)
    expect(out.totalTokens).toBe(10)
    expect(out.totalCost).toBe(0.01)
    expect(out.duration).toBeGreaterThanOrEqual(0)
  })

  it('supports option chaining, aliases, and .quiet/.cache variants', async () => {
    mountTestCore(ctx, { cache: true, cacheDir })
    await ctx.start()
    defineEcho()

    const alias = mustLetter('eta')
    const out = await alias({ suffix: '!' })`hey`
    expect(out.text).toBe('hey!')
  })

  it('applies schemastery defaults and rejects invalid options', async () => {
    mountTestCore(ctx)
    await ctx.start()

    let received: { times: number } | undefined
    ctx.letters.define('σ', {
      options: Schema.object({
        times: Schema.natural().default(1),
      }),
      run: (_prompt, opts: { times: number }) => {
        received = opts
        return `x${opts.times}`
      },
    })
    const σ = mustLetter('σ')

    expect((await σ`go`).text).toBe('x1')
    expect(received).toEqual({ times: 1 })
    expect((await σ({ times: 3 })`go`).text).toBe('x3')
    expect(() => σ({ times: -1 })`go`).toThrow(/times/)
  })

  it('caches cacheable letters: hit skips the run entirely', async () => {
    mountTestCore(ctx, { cache: true, cacheDir })
    await ctx.start()
    const η = defineEcho()

    let runs = 0
    const tracked = ctx.letters.define('τ', {
      run: (prompt) => {
        runs++
        return `ran ${prompt}`
      },
    })

    const first = await tracked`same prompt`
    expect(first.text).toBe('ran same prompt')
    expect(first.fromCache).toBe(false)
    expect(runs).toBe(1)

    const second = await tracked`same prompt`
    expect(second.text).toBe('ran same prompt')
    expect(second.fromCache).toBe(true)
    expect(runs).toBe(1) // not re-run

    const events = ctx.trace.events
    expect(events.filter((e) => e.kind === 'cache-miss')).toHaveLength(1)
    expect(events.filter((e) => e.kind === 'cache-hit')).toHaveLength(1)
    void η
  })

  it('honors per-call cache: false even when app-wide caching is on', async () => {
    mountTestCore(ctx, { cache: true, cacheDir })
    await ctx.start()
    let runs = 0
    ctx.letters.define('υ', {
      run: (prompt) => {
        runs++
        return prompt
      },
    })
    const υ = mustLetter('υ')

    await υ({ cache: false })`q`
    await υ({ cache: false })`q`
    expect(runs).toBe(2)
    expect(ctx.trace.events.filter((e) => e.kind === 'cache-hit')).toHaveLength(0)
  })

  it('never caches cache: false letters (agents)', async () => {
    mountTestCore(ctx, { cache: true, cacheDir })
    await ctx.start()
    const agent = defineEcho(false)

    await agent`q`
    await agent`q`
    expect(ctx.trace.events.filter((e) => e.kind === 'cache-hit')).toHaveLength(0)
    expect(ctx.trace.events.filter((e) => e.kind === 'cache-miss')).toHaveLength(0)
  })

  it('does not cache when no cache service is enabled', async () => {
    mountTestCore(ctx, { cache: false })
    await ctx.start()
    const η = defineEcho()
    await η`q`
    expect(ctx.trace.events.filter((e) => e.kind === 'cache-miss')).toHaveLength(0)
  })

  it('supports .stream for letters with a stream implementation', async () => {
    mountTestCore(ctx)
    await ctx.start()
    ctx.letters.define('ω', {
      stream: async function* (prompt: string) {
        yield* prompt.split(' ')
      },
      run: (prompt) => prompt,
    })
    const ω = mustLetter('ω')

    const chunks: string[] = []
    for await (const chunk of ω.stream`a b c`) chunks.push(chunk)
    expect(chunks).toEqual(['a', 'b', 'c'])
  })

  it('throws a clear error for .stream on letters without one', async () => {
    mountTestCore(ctx)
    await ctx.start()
    const η = defineEcho()
    const it = η.stream`x`[Symbol.asyncIterator]()
    await expect(it.next()).rejects.toThrow(/does not support streaming/)
  })

  it('records letter-end error events and rejects on run failure', async () => {
    mountTestCore(ctx)
    await ctx.start()
    ctx.letters.define('ζ', {
      run: () => {
        throw new Error('boom')
      },
    })
    const ζ = mustLetter('ζ')

    await expect(ζ`q`).rejects.toThrow('boom')
    const end = ctx.trace.events.find((e) => e.kind === 'letter-end')
    expect(end).toMatchObject({ status: 'error', outputPreview: 'boom' })
    expect(ctx.trace.events.some((e) => e.kind === 'error')).toBe(true)
  })

  it('interpolates template values into the prompt', async () => {
    mountTestCore(ctx)
    await ctx.start()
    const η = defineEcho()
    const out = await η`sum of ${1} and ${2}`
    expect(out.text).toBe('sum of 1 and 2')
  })
})
