import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountTestCore } from '../testing/helpers.ts'
import { Letters } from './letters.ts'
import type { LetterEnv } from './tags.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
})

function noopLetter() {
  return 'ok'
}

describe('Letters service', () => {
  it('registers letters with aliases and resolves both', async () => {
    ctx.plugin(Letters)
    await ctx.start()

    const fn = ctx.letters.define('Σ', {
      aliases: ['sum', 'sig'],
      description: 'summarize',
      run: noopLetter,
    })
    expect(ctx.letters.get('Σ')).toBe(fn)
    expect(ctx.letters.get('sum')).toBe(fn)
    expect(ctx.letters.get('sig')).toBe(fn)
    expect(ctx.letters.get('nope')).toBeUndefined()
    expect(ctx.letters.names()).toContain('Σ')
    expect(ctx.letters.entries()[0]).toMatchObject({
      name: 'Σ',
      aliases: ['sum', 'sig'],
      description: 'summarize',
      cacheable: true,
    })
  })

  it('throws descriptive errors on collisions', async () => {
    ctx.plugin(Letters)
    await ctx.start()

    ctx.letters.define('Φ', { run: noopLetter })
    expect(() => ctx.letters.define('Φ', { run: noopLetter })).toThrow(
      /letter 'Φ' is already registered/
    )
    ctx.letters.define('Δ', { aliases: ['phi'], run: noopLetter })
    expect(() => ctx.letters.define('Ξ', { aliases: ['phi'], run: noopLetter })).toThrow(
      /letter 'phi' is already registered/
    )
  })

  it('removes letters (and aliases) when the owning plugin unloads', async () => {
    ctx.plugin(Letters)
    const plugin = {
      name: 'letters-owner',
      inject: ['letters'],
      apply(ctx: Context) {
        ctx.letters.define('Ψ', { aliases: ['psi'], run: noopLetter })
      },
    }
    ctx.plugin(plugin)
    await ctx.start()
    expect(ctx.letters.get('Ψ')).toBeDefined()

    // Dispose the plugin's scope — its effect must remove the letter.
    const runtime = ctx.registry.get(plugin)
    runtime?.dispose()
    expect(ctx.letters.get('Ψ')).toBeUndefined()
    expect(ctx.letters.get('psi')).toBeUndefined()
  })

  it('exposes env with ctx, pieces, args and a span at run time', async () => {
    mountTestCore(ctx)
    await ctx.start()

    let captured: LetterEnv | undefined
    ctx.letters.define('Θ', {
      run: (_prompt, _opts, env) => {
        captured = env
        return `got ${env.args.join(',')}`
      },
    })

    const tag = ctx.letters.get('Θ')
    if (!tag) throw new Error('Θ not registered')
    const pieces = Object.assign(['a: ', ' b'], { raw: ['a: ', ' b'] })
    const out = await tag(pieces, 'X', 'Y')
    expect(out.text).toBe('got X,Y')
    expect(captured?.ctx).toBe(ctx)
    expect(captured?.span).toBeDefined()
    expect(captured?.pieces.raw).toEqual(['a: ', ' b'])
  })

  it('marks non-cacheable letters (agents)', async () => {
    ctx.plugin(Letters)
    await ctx.start()
    ctx.letters.define('Π', { cache: false, run: noopLetter })
    expect(ctx.letters.entries()[0].cacheable).toBe(false)
  })

  it('emits pizx/letter-removed on removal', async () => {
    ctx.plugin(Letters)
    await ctx.start()
    const seen: string[] = []
    ctx.on('pizx/letter-removed', (name) => seen.push(name))
    ctx.letters.define('X', { run: noopLetter })
    ctx.letters.remove('X')
    expect(seen).toEqual(['X'])
  })
})
