/**
 * ralph — a "word": an AI pattern (iterative analyze/plan/execute/review loop)
 * composed from the base letters via the ctx.words service.
 *
 * Slots are replaceable letters:
 *   analyze  → π  (text)    — assess the current state
 *   plan     → π  (text)    — turn the analysis into a concrete plan
 *   execute  → Π  (agent)   — apply the plan (swap for 'α' to run any ACP agent)
 *   review   → π  (text)    — judge the result against the goal; reply DONE or ITERATE
 *
 *   await ralph`improve error handling in src/`
 *   await ralph({ execute: 'α', maxIterations: 3 })`refactor auth`
 */

import Schema from 'schemastery'

export const name = 'ralph'

// Words depend on the words + letters services (and llm, transitively).
export const inject = ['words', 'letters', 'llm']

const ANALYZE = 'Analyze the current state and say what must change to reach the goal. Be specific.'
const PLAN = 'Given the analysis, write a minimal, actionable implementation plan.'
const EXECUTE = 'Implement the plan now.'
const REVIEW =
  'Review the result against the goal. If the goal is not actually achieved (missing artifacts, unanswered questions, errors), reply ITERATE. End your reply with exactly one line: DONE or ITERATE.'

export function apply(ctx) {
  ctx.words.define('ralph', {
    aliases: ['loop'],
    description: 'Ralph loop — iterative analyze/plan/execute/review (a word)',
    slots: { analyze: 'π', plan: 'π', execute: 'Π', review: 'π' },
    options: {
      maxIterations: Schema.natural().min(1).default(5),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: async (goal, opts, env) => {
      const { ctx } = env
      // Forward any letter options (model, server, cwd, …) to slot letters.
      const slotOpts = { quiet: true, ...ctx.words.slotOptions(opts) }
      let current = goal

      const { results, terminatedEarly } = await ctx.words.loop(
        async (i) => {
          if (!opts.quiet) process.stderr.write(`  ralph ${i}/${opts.maxIterations}\n`)
          if (!opts.quiet) process.stderr.write('    → analyze\n')
          const analyze = (
            await ctx.words.call(opts.analyze, `Goal: ${current}\n${ANALYZE}`, slotOpts)
          ).text
          if (!opts.quiet) process.stderr.write('    → plan\n')
          const plan = (
            await ctx.words.call(
              opts.plan,
              `Goal: ${current}\nAnalysis:\n${analyze}\n${PLAN}`,
              slotOpts
            )
          ).text
          if (!opts.quiet) process.stderr.write('    → execute\n')
          const result = (
            await ctx.words.call(opts.execute, `Plan:\n${plan}\nGoal: ${current}\n${EXECUTE}`, slotOpts)
          ).text
          if (!opts.quiet) process.stderr.write('    → review\n')
          const review = (
            await ctx.words.call(
              opts.review,
              `Goal: ${goal}\nPlan:\n${plan}\nResult:\n${result}\n${REVIEW}`,
              slotOpts
            )
          ).text

          current = `Continue improving.\nPlan:\n${plan}\nReview:\n${review}\nOriginal goal: ${goal}`
          return { iteration: i, plan, result, review }
        },
        // Stop as soon as the review is no longer asking to iterate
        // (case-insensitive, like the PASS/FAIL verdicts in chain/refine).
        ({ review }) => !/iterate/i.test(review),
        opts.maxIterations
      )

      const lines = results
        .map(
          (it) =>
            `Iteration ${it.iteration}:\n  Plan: ${it.plan.slice(0, 120)}\n  Review: ${it.review.slice(0, 120)}`
        )
        .join('\n')
      const last = results[results.length - 1]
      const stop = terminatedEarly ? 'review said DONE' : 'max iterations reached'
      const finalResult = last ? `\n\nFinal result:\n${last.result}` : ''
      return `${lines}\n\n(stopped after ${results.length} iteration(s): ${stop})${finalResult}`
    },
  })
}

export default { name, inject, apply }
