import { Context, type Plugin } from '@cordisjs/core'
import { describe, expect, it } from 'vitest'
import { type FakeTypeSafe, mountTestCore } from '../testing/helpers.ts'

async function loadPlugin(path: string): Promise<Plugin.Object> {
  return ((await import(path)) as { default: Plugin.Object }).default
}

async function boot(): Promise<Context> {
  const ctx = new Context()
  mountTestCore(ctx)
  ctx.plugin({
    name: 'fake-letters',
    inject: ['letters'],
    apply(c: Context) {
      c.letters.define('π', { run: () => 'PI' })
      c.letters.define('showBalance', { run: () => 'BALANCE' })
      c.letters.define('approveTransfer', { run: () => 'TRANSFERRED' })
      c.letters.define('supportAgent', { run: () => 'HUMAN' })
      c.letters.define('billingFlow', { run: () => 'BILLING' })
      c.letters.define('capture', {
        run: (_p: string, opts: Record<string, unknown>) => JSON.stringify(opts),
      })
    },
  })
  for (const p of ['fanout', 'composite', 'gate', 'intent']) {
    ctx.plugin(await loadPlugin(`../../examples/plugins/${p}.mjs`))
  }
  await ctx.start()
  return ctx
}

function mustTag(ctx: Context, name: string) {
  const tag = ctx.letters.get(name)
  if (!tag) throw new Error(`${name} not registered`)
  return tag
}

function calls(ctx: Context) {
  return (ctx.typesafe as unknown as FakeTypeSafe).calls
}

describe('TypeSafe pattern words', () => {
  it('fanout asks every question in a single call', async () => {
    const ctx = await boot()
    const out = await mustTag(
      ctx,
      'fanout'
    )({
      quiet: true,
      questions: {
        category: { type: 'choice', instructions: 'Which?', criteria: { billing: '', bug: '' } },
        refund: { type: 'noul', instructions: 'Refund?' },
      },
    })`ticket`
    expect(calls(ctx)).toHaveLength(1)
    expect(Object.keys(calls(ctx)[0].questions)).toHaveLength(2)
    expect(out.answer).toMatchObject({ category: { choice: 'billing' }, refund: { noul: 0.87 } })
    expect(JSON.parse(out.text).refund.noul).toBe(0.87)
    await ctx.stop()
  })

  it('fanout validates an empty question set', async () => {
    const ctx = await boot()
    await expect(mustTag(ctx, 'fanout')({ quiet: true, questions: {} })`x`).rejects.toThrow(
      /questions/
    )
    await ctx.stop()
  })

  it('composite normalizes and weights dimensions', async () => {
    const ctx = await boot()
    const out = await mustTag(
      ctx,
      'composite'
    )({
      quiet: true,
      dimensions: {
        python: { instructions: 'Python?', criteria: ['a', 'b', 'c'], weight: 0.5 },
        design: { instructions: 'Design?', criteria: ['a', 'b'], weight: 0.5 },
      },
    })`resume`
    // score 1 on 3 levels → 0.5; score 1 on 2 levels → 1.0; mean = 0.75
    expect((out.answer as { score: number }).score).toBeCloseTo(0.75, 6)
    expect(calls(ctx)).toHaveLength(1)
    await ctx.stop()
  })

  it('composite rejects negative weights', async () => {
    const ctx = await boot()
    expect(
      () => mustTag(ctx, 'composite')({ quiet: true, dimensions: {}, weights: { a: -1 } })`x`
    ).toThrow()
    await expect(
      mustTag(
        ctx,
        'composite'
      )({
        quiet: true,
        dimensions: { a: { instructions: 'x', criteria: ['a', 'b'], weight: -1 } },
      })`x`
    ).rejects.toThrow(/weight/)
    await ctx.stop()
  })

  it('gate routes to the per-choice handler when confidence clears the floor', async () => {
    const ctx = await boot()
    const out = await mustTag(
      ctx,
      'gate'
    )({
      quiet: true,
      instructions: 'What action?',
      criteria: { check_balance: 'see balance', approve_transfer: 'move money', other: 'x' },
      routes: { check_balance: 'showBalance', approve_transfer: 'approveTransfer' },
      thresholds: { approve_transfer: 0.85 },
      floor: 0.6,
      escalate: 'supportAgent',
    })`command`
    expect(out.text).toContain('BALANCE')
    expect(out.answer).toMatchObject({
      choice: 'check_balance',
      escalated: false,
      handledBy: 'showBalance',
    })
    await ctx.stop()
  })

  it('gate escalates below the floor', async () => {
    const ctx = await boot()
    const out = await mustTag(
      ctx,
      'gate'
    )({
      quiet: true,
      instructions: 'What action?',
      criteria: { check_balance: 'x' },
      routes: { check_balance: 'showBalance' },
      floor: 0.9,
      escalate: 'supportAgent',
    })`command`
    expect(out.text).toContain('HUMAN')
    expect(out.answer).toMatchObject({ escalated: true, handledBy: 'supportAgent' })
    await ctx.stop()
  })

  it('gate sends classifierModel to TypeSafe and model to the handler', async () => {
    const ctx = await boot()
    const out = await mustTag(
      ctx,
      'gate'
    )({
      quiet: true,
      instructions: 'Which?',
      criteria: { check_balance: 'x' },
      routes: { check_balance: 'capture' },
      classifierModel: 'classifier-model',
      model: 'handler-model',
    })`command`
    expect(calls(ctx)[0].model).toBe('classifier-model')
    expect(out.text).toContain('"model":"handler-model"')
    await ctx.stop()
  })

  it('intent classifies and dispatches to the matching handler', async () => {
    const ctx = await boot()
    const out = await mustTag(
      ctx,
      'intent'
    )({
      quiet: true,
      instructions: 'What does the user want?',
      criteria: { refund: 'money back', technical: 'bug' },
      intents: { refund: 'billingFlow', technical: 'π' },
      fallback: 'supportAgent',
      floor: 0.6,
    })`query`
    expect(out.text).toContain('BILLING')
    expect(out.answer).toMatchObject({
      choice: 'refund',
      escalated: false,
      handledBy: 'billingFlow',
    })
    await ctx.stop()
  })

  it('intent escalates below the floor', async () => {
    const ctx = await boot()
    const out = await mustTag(
      ctx,
      'intent'
    )({
      quiet: true,
      instructions: 'What does the user want?',
      criteria: { refund: 'money back' },
      intents: { refund: 'billingFlow' },
      fallback: 'supportFlow',
      escalate: 'supportAgent',
      floor: 0.9,
    })`query`
    expect(out.text).toContain('HUMAN')
    expect(out.answer).toMatchObject({ escalated: true, handledBy: 'supportAgent' })
    await ctx.stop()
  })
})
