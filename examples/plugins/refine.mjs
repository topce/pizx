/**
 * refine — a "word": the evaluator-optimizer workflow (from Anthropic's
 * "Building effective agents"). A generator letter produces a draft; an
 * evaluator letter judges it against explicit criteria; the generator
 * revises from the evaluator's feedback — until a PASS or the pass budget
 * runs out. The flagship pattern for tasks where iterative refinement
 * provides measurable value (translation, writing, complex search).
 *
 *   await refine({ criteria: 'no jargon, under 50 words' })`explain monads`
 *   await refine({ criteria: 'capture nuance', maxPasses: 4 })`translate this`
 *
 * Slots:
 *   generate → π — produces the draft and revises it from feedback.
 *   evaluate → π — judges the draft: PASS, or FAIL + specific feedback.
 *
 * Options:
 *   criteria  — what the evaluator judges against (falls back to a generic
 *               quality check when omitted).
 *   maxPasses — pass budget (default 3).
 */

import Schema from 'schemastery'

export const name = 'refine'

export const inject = ['words', 'letters', 'llm']

export function apply(ctx) {
  ctx.words.define('refine', {
    aliases: ['optimize'],
    description:
      'Refine — generate, evaluate against criteria, revise until PASS (evaluator-optimizer)',
    slots: { generate: 'π', evaluate: 'π' },
    options: {
      criteria: Schema.string(),
      maxPasses: Schema.natural().min(1).default(3),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: async (prompt, opts, env) => {
      const { ctx } = env
      // Forward any letter options (model, server, cwd, …) to slot letters.
      const slotOpts = { quiet: true, ...ctx.words.slotOptions(opts) }
      if (!opts.quiet) process.stderr.write(`refine: up to ${opts.maxPasses} pass(es)\n`)

      const criteria = opts.criteria ?? 'general quality, correctness, and clarity'
      let draft = (await ctx.words.call(opts.generate, prompt, slotOpts)).text
      const log = []
      let passed = false

      for (let i = 1; i <= opts.maxPasses; i++) {
        const evalText = (
          await ctx.words.call(
            opts.evaluate,
            `Evaluate the draft against the criteria. Reply with exactly one line: PASS, or FAIL followed by specific feedback.\n\nCriteria: ${criteria}\n\nTask:\n${prompt}\n\nDraft:\n${draft}`,
            slotOpts
          )
        ).text.trim()
        const ok = /^pass\b/i.test(evalText)
        log.push({
          pass: i,
          verdict: ok ? 'PASS' : 'FAIL',
          feedback: ok ? '' : evalText.replace(/^fail\b:?\s*/i, ''),
        })
        if (ok) {
          passed = true
          break
        }
        draft = (
          await ctx.words.call(
            opts.generate,
            `The draft was rejected:\n${evalText}\n\nRevise the draft to satisfy the criteria.\nOriginal task:\n${prompt}`,
            slotOpts
          )
        ).text
      }

      const lines = log.map(
        (l) => `Pass ${l.pass}: ${l.verdict}${l.feedback ? ` — ${l.feedback.slice(0, 100)}` : ''}`
      )
      const how = passed ? 'evaluator said PASS' : 'pass budget exhausted'
      return `${lines.join('\n')}\n\nFinal draft (${how}):\n${draft}`
    },
  })
}

export default { name, inject, apply }
