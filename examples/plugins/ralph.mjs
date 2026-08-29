/**
 * Ρ (ralph) — an example multi-step letter: a compact Ralph-style
 * improve loop, ported from pizx 0.9's built-in pattern as a USER plugin.
 *
 * Shows what user-defined letters can do beyond a single LLM call: loops,
 * nested model calls (each traced as its own llm-call event), and caching.
 */

import Schema from 'schemastery'

export const name = 'ralph'

export const inject = ['letters', 'llm']

export function apply(ctx) {
  ctx.letters.define('Ρ', {
    aliases: ['ralph'],
    description: 'Iteratively improve output over N rounds (example user letter)',

    options: Schema.object({
      iterations: Schema.natural().default(3),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
      cache: Schema.boolean(),
    }),

    run: async (prompt, opts, env) => {
      const { ctx } = env
      let current = prompt

      for (let round = 1; round <= opts.iterations; round++) {
        if (!opts.quiet) {
          process.stderr.write(`  Ρ round ${round}/${opts.iterations}\n`)
        }
        current = (
          await ctx.llm.ask(
            `Round ${round}. Improve the following. Be concrete and keep it short:\n\n${current}`,
            { model: opts.model }
          )
        ).text
      }

      const final = await ctx.llm.ask(
        `Polish this into a final answer (one paragraph):\n\n${current}`,
        { model: opts.model }
      )
      return final.text
    },
  })
}

export default { name, inject, apply }
