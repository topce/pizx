import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LetterFn } from '../core/tags.ts'
import { type FakeTypeSafe, mountTestCore } from '../testing/helpers.ts'
import { typesafePlugin } from './typesafe.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
})

function mustLetter(name: string): LetterFn {
  const fn = ctx.letters.get(name)
  if (!fn) throw new Error(`letter ${name} not registered`)
  return fn
}

async function boot(cache = false) {
  const dir = await mkdtemp(join(tmpdir(), 'pizx-typesafe-'))
  mountTestCore(ctx, { cache, cacheDir: dir })
  ctx.plugin(typesafePlugin)
  await ctx.start()
  return dir
}

function fake(): FakeTypeSafe {
  return ctx.typesafe as unknown as FakeTypeSafe
}

describe('TypeSafe primitive letters', () => {
  it('noul returns the probability and the typed answer', async () => {
    await boot()
    const out = await mustLetter('noul')({ instructions: 'Is this urgent?', quiet: true })`state`
    expect(out.text).toBe('0.87')
    expect(out.answer).toMatchObject({ type: 'noul', noul: 0.87 })
    expect(out.modelId).toBe('fake-jev')
  })

  it('choice returns the label and the typed answer', async () => {
    await boot()
    const out = await mustLetter('choice')({
      instructions: 'Which team?',
      criteria: { billing: 'payment', technical: 'bugs' },
      quiet: true,
    })`ticket`
    expect(out.text).toBe('billing')
    expect(out.answer).toMatchObject({ type: 'choice', choice: 'billing', confidence: 0.78 })
  })

  it('score returns the score and the typed answer', async () => {
    await boot()
    const out = await mustLetter('score')({
      instructions: 'How frustrated?',
      criteria: ['calm', 'civil', 'angry'],
      quiet: true,
    })`ticket`
    expect(out.text).toBe('1')
    expect(out.answer).toMatchObject({ type: 'score', score: 1, confidence: 0.9 })
  })

  it('uses the template body as the question when instructions is omitted', async () => {
    await boot()
    await mustLetter('noul')({ quiet: true })`Is this urgent?`
    const q = fake().calls[0].questions.noul
    expect(q.instructions).toBe('Is this urgent?')
    // The service normalizes the absent state to '' (the API rejects null).
    expect(fake().calls[0].state).toBe('')
  })

  it('uses the template body as state when instructions is given', async () => {
    await boot()
    await mustLetter('noul')({ instructions: 'Is this urgent?', quiet: true })`BIG STATE`
    expect(fake().calls[0].state).toBe('BIG STATE')
  })

  it('passes structured state through the state option', async () => {
    await boot()
    await mustLetter('noul')({
      instructions: 'Is this urgent?',
      state: { ticket: 1 },
      quiet: true,
    })``
    expect(fake().calls[0].state).toEqual({ ticket: 1 })
  })

  it('registers capitalized aliases', async () => {
    await boot()
    expect(ctx.letters.get('Noul')).toBe(ctx.letters.get('noul'))
    expect(ctx.letters.get('Choice')).toBe(ctx.letters.get('choice'))
    expect(ctx.letters.get('Score')).toBe(ctx.letters.get('score'))
  })

  it('validates criteria at the boundary', async () => {
    await boot()
    await expect(mustLetter('choice')({ instructions: 'q', criteria: {} })`s`).rejects.toThrow(
      /criteria/
    )
    await expect(mustLetter('score')({ instructions: 'q', criteria: ['only'] })`s`).rejects.toThrow(
      /criteria/
    )
    await expect(mustLetter('noul')({ quiet: true })``).rejects.toThrow(/no question/)
  })

  it('preserves the typed answer across a cache hit', async () => {
    await boot(true)
    const noul = mustLetter('noul')
    const first = await noul({ instructions: 'Is this urgent?', quiet: true })`state`
    const second = await noul({ instructions: 'Is this urgent?', quiet: true })`state`
    expect(first.isFromCache).toBe(false)
    expect(second.isFromCache).toBe(true)
    expect(second.text).toBe('0.87')
    expect(second.modelId).toBe('fake-jev')
    expect(second.answer).toMatchObject({ type: 'noul', noul: 0.87 })
  })
})
