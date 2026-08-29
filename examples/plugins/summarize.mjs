/**
 * Σ (summarize) — an example user-defined letter plugin.
 *
 * A letter is a cordis plugin that registers a template tag on ctx.letters.
 * Anything registered here is available in scripts as a global (when run
 * through the pizx CLI or pizx/globals), appears in `pizx --letters`, and is
 * traced and cacheable like the built-ins.
 */

import Schema from 'schemastery'

export const name = 'summarize'

// Declare hard dependencies — cordis starts this plugin only once the
// letters and llm services exist (order in config files does not matter).
export const inject = ['letters', 'llm']

export function apply(ctx) {
  ctx.letters.define('Σ', {
    aliases: ['summarize'],
    description: 'Summarize text (example user letter)',

    // Schemastery options: validated at the boundary, defaults applied,
    // and the declared `cache: true` makes this letter cacheable per call.
    options: Schema.object({
      maxWords: Schema.natural().default(30),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
      cache: Schema.boolean(),
    }),

    run: async (prompt, opts, env) => {
      // env.ctx gives you the cordis context: ctx.llm, ctx.trace, ctx.cache.
      const { ctx, span } = env
      const result = await ctx.llm.ask(
        `Summarize the following text in at most ${opts.maxWords} words:\n\n${prompt}`,
        {
          model: opts.model,
          system: 'You are a precise summarizer.',
          // 4 tokens per word for the summary, plus headroom for reasoning
          // (maxTokens counts thinking + text on reasoning models).
          maxTokens: Math.max(opts.maxWords * 4, 256),
        }
      )
      // Usage is recorded into the active span automatically by ctx.llm.
      return result.text
    },
  })
}

export default { name, inject, apply }
