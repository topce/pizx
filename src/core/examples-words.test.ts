import { Context, type Plugin } from '@cordisjs/core'
import { describe, expect, it } from 'vitest'
import { FakeLlm } from '../testing/helpers.ts'
import { isPizxError } from './errors.ts'
import { Letters } from './letters.ts'
import { Words } from './words.ts'

/** Load an example word plugin (untyped .mjs) by its default export. */
async function loadPlugin(path: string): Promise<Plugin.Object> {
  return ((await import(path)) as { default: Plugin.Object }).default
}

async function boot(piCalls: string[], agentCalls: string[]): Promise<Context> {
  const ctx = new Context()
  ctx.plugin(FakeLlm)
  ctx.plugin(Letters)
  ctx.plugin(Words)
  ctx.plugin({
    name: 'fake-letters',
    inject: ['letters'],
    apply(c: Context) {
      c.letters.define('π', {
        run: (p: string) => {
          piCalls.push(p)
          return 'PI-TEXT'
        },
      })
      c.letters.define('Π', {
        run: (p: string) => {
          agentCalls.push(p)
          return 'AGENT'
        },
      })
    },
  })
  return ctx
}

/** Define a deterministic fake letter once the context has started. */
function fakeLetter(ctx: Context, name: string, run: (prompt: string) => string) {
  ctx.letters.define(name, { run })
  return ctx.letters.get(name)
}

describe('example words (ralph, fleet)', () => {
  it('ralph defaults analyze/plan/review to π and execute to Π', async () => {
    const piCalls: string[] = []
    const agentCalls: string[] = []
    const ctx = await boot(piCalls, agentCalls)
    ctx.plugin(await loadPlugin('../../examples/plugins/ralph.mjs'))
    await ctx.start()

    const tag = ctx.letters.get('ralph')
    if (!tag) throw new Error('ralph not registered')
    const out = await tag({ maxIterations: 1 })`goal`

    expect(out.text).toContain('Iteration 1:')
    expect(out.text).toContain('Final result:')
    // One iteration = 4 steps: analyze/plan/review → π, execute → Π.
    expect(piCalls).toHaveLength(3)
    expect(agentCalls).toHaveLength(1)
    await ctx.stop()
  })

  it('ralph honors the execute slot override (Π → π)', async () => {
    const piCalls: string[] = []
    const agentCalls: string[] = []
    const ctx = await boot(piCalls, agentCalls)
    ctx.plugin(await loadPlugin('../../examples/plugins/ralph.mjs'))
    await ctx.start()

    const tag = ctx.letters.get('ralph')
    if (!tag) throw new Error('ralph not registered')
    await tag({ execute: 'π', maxIterations: 1 })`goal`

    // Every step resolves to π once execute is overridden.
    expect(piCalls).toHaveLength(4)
    expect(agentCalls).toHaveLength(0)
    await ctx.stop()
  })

  it('fleet fans out over its worker slot and returns a summary', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/fleet.mjs'))
    await ctx.start()

    const tag = ctx.letters.get('fleet')
    if (!tag) throw new Error('fleet not registered')
    const out = await tag({ worker: 'π' })`task a\ntask b`
    expect(out.text).toContain('2/2 succeeded')
    await ctx.stop()
  })

  it('fleet rejects a zero concurrency as VALIDATION at the option boundary', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/fleet.mjs'))
    await ctx.start()

    const tag = ctx.letters.get('fleet')
    if (!tag) throw new Error('fleet not registered')

    // Option validation happens at the tag boundary (synchronously).
    let caught: unknown
    try {
      tag({ concurrency: 0 })`a\nb`
    } catch (err) {
      caught = err
    }
    expect(isPizxError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('VALIDATION')
    await ctx.stop()
  })

  it('ralph forwards letter options (e.g. server) to slot letters', async () => {
    const ctx = await boot([], [])
    let alphaOpts: Record<string, unknown> | undefined
    ctx.plugin({
      name: 'fake-alpha',
      inject: ['letters'],
      apply(c: Context) {
        c.letters.define('α', {
          run: (_p: string, opts: Record<string, unknown>) => {
            alphaOpts = opts
            return 'ACP'
          },
        })
      },
    })
    ctx.plugin(await loadPlugin('../../examples/plugins/ralph.mjs'))
    await ctx.start()

    const tag = ctx.letters.get('ralph')
    if (!tag) throw new Error('ralph not registered')
    await tag({ execute: 'α', server: ['kiro-cli', 'acp'], maxIterations: 1 })`goal`

    expect(alphaOpts).toMatchObject({ server: ['kiro-cli', 'acp'], quiet: true })
    await ctx.stop()
  })
})

describe('example words (chain)', () => {
  it('runs ordered steps, each consuming the previous output', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/chain.mjs'))
    await ctx.start()

    const seen: string[] = []
    fakeLetter(ctx, 'ε', (p) => {
      seen.push(p)
      return `ε:${p}`
    })
    fakeLetter(ctx, 'ζ', (p) => {
      seen.push(p)
      return `ζ:${p}`
    })

    const tag = ctx.letters.get('chain')
    if (!tag) throw new Error('chain not registered')
    const out = await tag({ steps: ['ε', 'ζ'] })`goal`

    // Step 2's input is step 1's output — the chain feeds forward.
    expect(seen).toEqual(['goal', 'ε:goal'])
    expect(out.text).toContain('Step 1 (ε)')
    expect(out.text).toContain('Step 2 (ζ)')
    expect(out.text).toContain('Final result (all 2 step(s) ran)')
    expect(out.text).toContain('ζ:ε:goal')
    await ctx.stop()
  })

  it('runs stepPrompts through the step slot and chains them', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/chain.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', (p) => `ε:${p}`)

    const tag = ctx.letters.get('chain')
    if (!tag) throw new Error('chain not registered')
    const out = await tag({ step: 'ε', stepPrompts: ['shorten', 'translate'] })`goal`

    // Each instruction lands in its step's input; step 2 sees step 1's output.
    expect(out.text).toContain('ε:Step instruction: shorten')
    expect(out.text).toContain('ε:Step instruction: translate')
    await ctx.stop()
  })

  it('gate stops the chain on FAIL and reports the reason', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/chain.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', (p) => `ε:${p}`)
    const gateCalls: string[] = []
    fakeLetter(ctx, 'η', (p) => {
      gateCalls.push(p)
      return gateCalls.length === 1 ? 'PASS' : 'FAIL: went off track'
    })

    const tag = ctx.letters.get('chain')
    if (!tag) throw new Error('chain not registered')
    const out = await tag({ steps: ['ε', 'ε', 'ε'], gate: 'η' })`goal`

    // The gate rejected step 2, so step 3 never ran.
    expect(gateCalls).toHaveLength(2)
    expect(out.text).toContain('[gate: PASS]')
    expect(out.text).toContain('[gate: FAIL]')
    expect(out.text).toContain('stopped by gate at step 2: went off track')
    expect(out.text).not.toContain('Step 3 (')
    await ctx.stop()
  })

  it('gate PASS lets the whole chain run', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/chain.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', (p) => `ε:${p}`)
    fakeLetter(ctx, 'η', () => 'PASS')

    const tag = ctx.letters.get('chain')
    if (!tag) throw new Error('chain not registered')
    const out = await tag({ steps: ['ε', 'ε'], gate: 'η' })`goal`

    expect(out.text).toContain('[gate: PASS]')
    expect(out.text).toContain('Final result (all 2 step(s) ran)')
    await ctx.stop()
  })

  it('refuses ambiguous declarations (steps + stepPrompts) as VALIDATION', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/chain.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', (p) => `ε:${p}`)

    const tag = ctx.letters.get('chain')
    if (!tag) throw new Error('chain not registered')
    await expect(tag({ steps: ['ε'], stepPrompts: ['shorten'] })`goal`).rejects.toSatisfy(
      (err: unknown) =>
        isPizxError(err) && err.code === 'VALIDATION' && /not both/.test(err.message)
    )
    await ctx.stop()
  })
})

describe('example words (route)', () => {
  it('classifies and dispatches to the per-category handler', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/route.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => 'refund')
    fakeLetter(ctx, 'ζ', (p) => `handled-refund:${p}`)
    const fallbackCalls: string[] = []
    fakeLetter(ctx, 'η', (p) => {
      fallbackCalls.push(p)
      return 'fallback'
    })

    const tag = ctx.letters.get('route')
    if (!tag) throw new Error('route not registered')
    const out = await tag({
      classifier: 'ε',
      fallback: 'η',
      routes: { refund: 'ζ', tech: 'ε' },
    })`my order is broken`

    expect(out.text).toContain("routed to 'refund'")
    expect(out.text).toContain('handled-refund:my order is broken')
    expect(fallbackCalls).toHaveLength(0)
    await ctx.stop()
  })

  it('falls back when the classifier cannot place the input', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/route.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => 'unknown-thing')
    fakeLetter(ctx, 'ζ', (p) => `handled:${p}`)
    fakeLetter(ctx, 'η', (p) => `fallback:${p}`)

    const tag = ctx.letters.get('route')
    if (!tag) throw new Error('route not registered')
    const out = await tag({ classifier: 'ε', fallback: 'η', routes: { refund: 'ζ' } })`query`

    expect(out.text).toContain("no route for 'unknown-thing' — handled by fallback")
    expect(out.text).toContain('fallback:query')
    await ctx.stop()
  })

  it('maps classifier replies echoing category descriptions back to their route', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/route.mjs'))
    await ctx.start()

    // The classifier echoes the *description*, not the route key.
    fakeLetter(ctx, 'ε', () => 'Refund requests')
    const handlerCalls: string[] = []
    fakeLetter(ctx, 'ζ', (p) => {
      handlerCalls.push(p)
      return 'handled-refund'
    })

    const tag = ctx.letters.get('route')
    if (!tag) throw new Error('route not registered')
    const out = await tag({
      classifier: 'ε',
      routes: { refund: 'ζ' },
      categories: { refund: 'Refund requests' },
    })`my order is broken`

    expect(out.text).toContain("routed to 'refund'")
    expect(handlerCalls).toHaveLength(1)
    await ctx.stop()
  })

  it('requires at least one route, reported as VALIDATION', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/route.mjs'))
    await ctx.start()

    const tag = ctx.letters.get('route')
    if (!tag) throw new Error('route not registered')
    await expect(tag({})`query`).rejects.toSatisfy(
      (err: unknown) =>
        isPizxError(err) && err.code === 'VALIDATION' && /no routes defined/.test(err.message)
    )
    await ctx.stop()
  })
})

describe('example words (vote)', () => {
  it('returns a clear majority without consulting the judge', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/vote.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => 'safe')
    const judgeCalls: string[] = []
    fakeLetter(ctx, 'η', (p) => {
      judgeCalls.push(p)
      return 'never'
    })

    const tag = ctx.letters.get('vote')
    if (!tag) throw new Error('vote not registered')
    const out = await tag({ voter: 'ε', judge: 'η', votes: 3 })`is this ok?`

    expect(out.text).toContain('3/3 voters agreed')
    expect(out.text).toContain('safe')
    expect(judgeCalls).toHaveLength(0)
    await ctx.stop()
  })

  it('sends split votes to the judge for consensus (majority mode)', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/vote.mjs'))
    await ctx.start()

    const answers: string[] = []
    fakeLetter(ctx, 'ε', () => {
      const answer = ['a', 'b', 'c'][answers.length % 3]
      answers.push(answer)
      return answer
    })
    fakeLetter(ctx, 'η', () => 'consensus')

    const tag = ctx.letters.get('vote')
    if (!tag) throw new Error('vote not registered')
    const out = await tag({ voter: 'ε', judge: 'η', votes: 3 })`pick`

    expect(out.text).toContain('judge synthesized the consensus')
    expect(out.text).toContain('consensus')
    await ctx.stop()
  })

  it('best mode always asks the judge for the best answer', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/vote.mjs'))
    await ctx.start()

    // All voters agree — a majority-mode run would skip the judge entirely.
    fakeLetter(ctx, 'ε', () => 'same')
    fakeLetter(ctx, 'η', () => 'best-answer')

    const tag = ctx.letters.get('vote')
    if (!tag) throw new Error('vote not registered')
    const out = await tag({ voter: 'ε', judge: 'η', votes: 3, mode: 'best' })`pick`

    expect(out.text).toContain('judge picked the best')
    expect(out.text).toContain('best-answer')
    await ctx.stop()
  })

  it('reports when every voter fails', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/vote.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => {
      throw new Error('boom')
    })

    const tag = ctx.letters.get('vote')
    if (!tag) throw new Error('vote not registered')
    const out = await tag({ voter: 'ε', votes: 2 })`pick`

    expect(out.text).toContain('all 2 voter(s) failed')
    expect(out.text).toContain('boom')
    await ctx.stop()
  })

  it('rejects an unknown mode as VALIDATION at the option boundary', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/vote.mjs'))
    await ctx.start()

    const tag = ctx.letters.get('vote')
    if (!tag) throw new Error('vote not registered')

    let caught: unknown
    try {
      tag({ mode: 'bogus' })`pick`
    } catch (err) {
      caught = err
    }
    expect(isPizxError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('VALIDATION')
    await ctx.stop()
  })
})

describe('example words (refine)', () => {
  it('loops until the evaluator passes', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/refine.mjs'))
    await ctx.start()

    const generated: string[] = []
    fakeLetter(ctx, 'ε', (p) => {
      const n = generated.length + 1
      generated.push(p)
      return `draft${n}`
    })
    const evaluated: string[] = []
    fakeLetter(ctx, 'η', (p) => {
      evaluated.push(p)
      return evaluated.length === 1 ? 'FAIL: too vague' : 'PASS'
    })

    const tag = ctx.letters.get('refine')
    if (!tag) throw new Error('refine not registered')
    const out = await tag({ generate: 'ε', evaluate: 'η', criteria: 'be specific' })`explain`

    // Initial draft + one revision; the criteria reach the evaluator.
    expect(generated).toHaveLength(2)
    expect(evaluated).toHaveLength(2)
    expect(evaluated[0]).toContain('be specific')
    expect(out.text).toContain('Pass 1: FAIL — too vague')
    expect(out.text).toContain('Pass 2: PASS')
    expect(out.text).toContain('evaluator said PASS')
    expect(out.text).toContain('draft2')
    await ctx.stop()
  })

  it('stops when the pass budget runs out', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/refine.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', (p) => `draft:${p}`)
    fakeLetter(ctx, 'η', () => 'FAIL: nope')

    const tag = ctx.letters.get('refine')
    if (!tag) throw new Error('refine not registered')
    const out = await tag({ generate: 'ε', evaluate: 'η', maxPasses: 2 })`explain`

    expect(out.text).toContain('Pass 1: FAIL — nope')
    expect(out.text).toContain('Pass 2: FAIL — nope')
    expect(out.text).toContain('pass budget exhausted')
    await ctx.stop()
  })
})

describe('example words (orchestrate)', () => {
  it('plans, fans out workers, and synthesizes', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/orchestrate.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => 'sub a\nsub b')
    const workerInputs: string[] = []
    fakeLetter(ctx, 'ζ', (p) => {
      workerInputs.push(p)
      return `work:${p}`
    })
    const synthInputs: string[] = []
    fakeLetter(ctx, 'η', (p) => {
      synthInputs.push(p)
      return 'synth'
    })

    const tag = ctx.letters.get('orchestrate')
    if (!tag) throw new Error('orchestrate not registered')
    const out = await tag({ planner: 'ε', worker: 'ζ', synthesizer: 'η' })`big task`

    expect(workerInputs).toEqual(['sub a', 'sub b'])
    expect(synthInputs).toHaveLength(1)
    expect(synthInputs[0]).toContain('work:sub a')
    expect(out.text).toContain('2/2 worker(s) succeeded')
    expect(out.text).toContain('Synthesis:')
    expect(out.text).toContain('synth')
    await ctx.stop()
  })

  it('skips synthesis for a single subtask', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/orchestrate.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => 'only one')
    fakeLetter(ctx, 'ζ', (p) => `work:${p}`)
    const synthCalls: string[] = []
    fakeLetter(ctx, 'η', (p) => {
      synthCalls.push(p)
      return 'synth'
    })

    const tag = ctx.letters.get('orchestrate')
    if (!tag) throw new Error('orchestrate not registered')
    const out = await tag({ planner: 'ε', worker: 'ζ', synthesizer: 'η' })`task`

    expect(out.text).toContain('work:only one')
    expect(synthCalls).toHaveLength(0)
    await ctx.stop()
  })

  it('runs the task directly when the planner fails to decompose', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/orchestrate.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => '\n  \n')
    fakeLetter(ctx, 'ζ', (p) => `direct:${p}`)

    const tag = ctx.letters.get('orchestrate')
    if (!tag) throw new Error('orchestrate not registered')
    const out = await tag({ planner: 'ε', worker: 'ζ' })`task`

    expect(out.text).toContain('ran the task directly')
    expect(out.text).toContain('direct:task')
    await ctx.stop()
  })

  it('reports when every worker fails', async () => {
    const ctx = await boot([], [])
    ctx.plugin(await loadPlugin('../../examples/plugins/orchestrate.mjs'))
    await ctx.start()

    fakeLetter(ctx, 'ε', () => 'sub a\nsub b')
    fakeLetter(ctx, 'ζ', () => {
      throw new Error('boom')
    })

    const tag = ctx.letters.get('orchestrate')
    if (!tag) throw new Error('orchestrate not registered')
    const out = await tag({ planner: 'ε', worker: 'ζ' })`task`

    expect(out.text).toContain('all 2 worker(s) failed')
    expect(out.text).toContain('boom')
    await ctx.stop()
  })
})
