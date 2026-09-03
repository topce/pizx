/**
 * chain — a "word": prompt chaining (the sequential-workflow pattern from
 * Anthropic's "Building effective agents"). Each step consumes the previous
 * step's output; an optional gate letter checks every intermediate result
 * and can stop the chain early when the process goes off track.
 *
 * Two ways to declare the steps:
 *   steps       — ordered letter refs (names or tags); each gets the previous output.
 *   stepPrompts — ordered instructions, all run through the `step` slot.
 *
 * Declaring both is an error — the word refuses to guess which one you meant.
 *
 *   await chain({ steps: ['outline', 'π'] })`write a document about X`
 *   await chain({ stepPrompts: ['translate to French', 'make it rhyme'] })`text`
 *   await chain({ stepPrompts: ['summarize'], gate: 'critic' })`text`
 *
 * Slots:
 *   step → π — the letter that runs each stepPrompt (ignored when `steps` is given).
 *
 * Options:
 *   steps       — ordered LetterRefs; each step's output feeds the next.
 *   stepPrompts — ordered instructions run through the `step` slot, chained.
 *   gate        — optional LetterRef checked after every step: PASS continues,
 *                 FAIL stops the chain and is reported.
 *   maxSteps    — hard cap on the number of steps (default 10).
 */

import Schema from 'schemastery'
import { PizxError } from '@topce/pizx'

export const name = 'chain'

// Words depend on the words + letters services (and llm, transitively).
export const inject = ['words', 'letters', 'llm']

const GATE =
  'Reply with exactly one line: PASS if this step is on track toward the goal, or FAIL followed by the reason.'

export function apply(ctx) {
  ctx.words.define('chain', {
    aliases: ['pipeline'],
    description: 'Chain — sequential steps, each consuming the previous output (prompt chaining)',
    slots: { step: 'π' },
    options: {
      steps: Schema.array(Schema.union([Schema.string(), Schema.function()])).default([]),
      stepPrompts: Schema.array(Schema.string()).default([]),
      gate: Schema.union([Schema.string(), Schema.function()]),
      maxSteps: Schema.natural().min(1).default(10),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: async (prompt, opts, env) => {
      const { ctx } = env
      // Forward any letter options (model, server, cwd, …) to slot letters.
      const slotOpts = { quiet: true, ...ctx.words.slotOptions(opts) }

      // `steps` and `stepPrompts` are two different ways to declare the chain;
      // both at once is ambiguous, so refuse instead of silently dropping one.
      if (opts.steps.length > 0 && opts.stepPrompts.length > 0) {
        throw new PizxError(
          'VALIDATION',
          'chain: pass either `steps` or `stepPrompts`, not both — they declare the chain in two different ways'
        )
      }

      // Explicit steps win; otherwise run the `step` slot once per stepPrompt.
      // Neither → a single pass-through step.
      const useSteps = opts.steps.length > 0
      const refs = useSteps ? opts.steps : opts.stepPrompts.map(() => opts.step)
      const steps = (refs.length > 0 ? refs : [opts.step]).slice(0, opts.maxSteps)

      if (!opts.quiet) {
        process.stderr.write(`chain: ${steps.length} step(s)${opts.gate ? ' + gate' : ''}\n`)
      }

      const log = []
      let current = prompt
      let stoppedByGate = false
      let gateReason = ''

      for (let i = 0; i < steps.length; i++) {
        const instruction = useSteps ? undefined : opts.stepPrompts[i]
        const input = instruction
          ? `Step instruction: ${instruction}\n\nInput:\n${current}`
          : current
        const out = await ctx.words.call(steps[i], input, slotOpts)

        let verdict = 'PASS'
        if (opts.gate) {
          const raw = (
            await ctx.words.call(
              opts.gate,
              `Goal: ${prompt}\n\nStep ${i + 1} output:\n${out.text}\n\n${GATE}`,
              slotOpts
            )
          ).text.trim()
          verdict = /^pass\b/i.test(raw) ? 'PASS' : /^fail\b/i.test(raw) ? 'FAIL' : '?'
          log.push({ i: i + 1, ref: steps[i], text: out.text, verdict })
          if (verdict !== 'PASS') {
            stoppedByGate = true
            gateReason = verdict === 'FAIL' ? raw.replace(/^fail\b:?\s*/i, '') : raw
            current = out.text
            break
          }
        } else {
          log.push({ i: i + 1, ref: steps[i], text: out.text, verdict: '-' })
        }
        current = out.text
      }

      const lines = log.map((s) => {
        const label = typeof s.ref === 'string' ? s.ref : 'tag'
        const gateNote = opts.gate ? ` [gate: ${s.verdict}]` : ''
        return `Step ${s.i} (${label})${gateNote}:\n  ${s.text.slice(0, 120)}`
      })
      const stop = stoppedByGate
        ? `stopped by gate at step ${log.length}: ${gateReason}`
        : `all ${steps.length} step(s) ran`
      return `${lines.join('\n')}\n\nFinal result (${stop}):\n${current}`
    },
  })
}

export default { name, inject, apply }
