import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPizxError } from './errors.ts'
import { Letters } from './letters.ts'
import type { LetterRef } from './words.ts'
import { Words } from './words.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
  ctx.plugin(Letters)
  ctx.plugin(Words)
})

afterEach(async () => {
  await ctx.stop()
})

describe('Words service', () => {
  it('resolves slot refs by name and by tag', async () => {
    await ctx.start()

    ctx.letters.define('ε', { run: (p: string) => `ε:${p}` })

    // Name resolution returns a callable tag.
    const byName = ctx.words.resolve('ε')
    expect((await byName`q`).text).toBe('ε:q')

    // Direct tag resolution passes the tag through as a callable.
    const byTag = ctx.words.resolve(byName)
    expect((await byTag`r`).text).toBe('ε:r')

    expect(() => ctx.words.resolve('missing')).toThrow(/not registered/)
  })

  it('call invokes a slot letter and returns its output', async () => {
    await ctx.start()

    ctx.letters.define('ε', { run: (p: string) => `got:${p}` })
    const out = await ctx.words.call('ε', 'hello')
    expect(out.text).toBe('got:hello')
  })

  it('parallel fans out with concurrency and isolates failures', async () => {
    await ctx.start()

    ctx.letters.define('ε', {
      run: (p: string) => {
        if (p === 'bad') throw new Error('boom')
        return `ok:${p}`
      },
    })

    const results = await ctx.words.parallel('ε', ['a', 'bad', 'c'], { concurrency: 2 })
    expect(results).toHaveLength(3)
    expect(results[0]).toMatchObject({ input: 'a', ok: true })
    expect(results[0].output?.text).toBe('ok:a')
    expect(results[1]).toMatchObject({ input: 'bad', ok: false })
    expect(results[1].error).toContain('boom')
    expect(results[2].ok).toBe(true)
  })

  it('loop stops on the predicate or on maxIterations', async () => {
    await ctx.start()

    const early = await ctx.words.loop(
      async (i) => i,
      (v) => v >= 3,
      5
    )
    expect(early.iterations).toBe(3)
    expect(early.terminatedEarly).toBe(true)

    const capped = await ctx.words.loop(
      async (i) => i,
      () => false,
      2
    )
    expect(capped.iterations).toBe(2)
    expect(capped.terminatedEarly).toBe(false)
  })

  it('parallel rejects a non-positive concurrency as VALIDATION', async () => {
    await ctx.start()

    ctx.letters.define('ε', { run: (p: string) => p })
    await expect(ctx.words.parallel('ε', ['a'], { concurrency: 0 })).rejects.toSatisfy(
      (err: unknown) => isPizxError(err) && err.code === 'VALIDATION'
    )
    await expect(ctx.words.parallel('ε', ['a'], { concurrency: 1.5 })).rejects.toSatisfy(
      (err: unknown) => isPizxError(err) && err.code === 'VALIDATION'
    )
  })

  it('loop rejects a non-positive maxIterations as VALIDATION', async () => {
    await ctx.start()

    await expect(
      ctx.words.loop(
        async (i) => i,
        () => false,
        0
      )
    ).rejects.toSatisfy((err: unknown) => isPizxError(err) && err.code === 'VALIDATION')
  })

  it('define registers a word whose slots default and override by name or tag', async () => {
    await ctx.start()

    ctx.letters.define('ε', { run: (p: string) => `ε:${p}` })
    const ζ = ctx.letters.define('ζ', { run: (p: string) => `ζ:${p}` })

    const seen: string[] = []
    ctx.words.define<{ first?: LetterRef }>('ω', {
      slots: { first: 'ε' },
      run: async (prompt, opts, env) => {
        const out = await env.ctx.words.call(opts.first ?? 'ε', prompt)
        seen.push(out.text)
        return 'done'
      },
    })

    const tag = ctx.letters.get('ω')
    if (!tag) throw new Error('ω not registered')

    // Default slot binding (name resolution).
    await tag`x`
    expect(seen).toEqual(['ε:x'])

    // Override by name.
    await tag({ first: 'ζ' })`y`
    expect(seen).toEqual(['ε:x', 'ζ:y'])

    // Override by direct tag.
    await tag({ first: ζ })`z`
    expect(seen).toEqual(['ε:x', 'ζ:y', 'ζ:z'])
  })

  it('define defaults words to non-cacheable', async () => {
    await ctx.start()

    ctx.words.define('ω', { slots: { first: 'ε' }, run: (p) => p })
    expect(ctx.letters.entries().find((e) => e.name === 'ω')?.cacheable).toBe(false)
  })

  it('slotOptions extracts letter options and drops word-only keys', async () => {
    await ctx.start()

    const opts: Record<string, unknown> = {
      execute: 'α', // slot ref — not a letter option
      maxIterations: 2, // word-only option
      quiet: false, // never forwarded (slot calls stay quiet)
      model: 'm',
      server: ['kiro-cli', 'acp'],
      cwd: '/x',
      env: undefined, // undefined values are skipped
      unknown: 1, // unrecognized keys are skipped
    }
    expect(ctx.words.slotOptions(opts)).toEqual({
      model: 'm',
      server: ['kiro-cli', 'acp'],
      cwd: '/x',
    })
  })
})
