/**
 * Ξ (commit) — a useful user-defined letter plugin.
 *
 * A letter is a cordis plugin that registers a template tag on ctx.letters.
 * Anything registered here is available in scripts as a global (when run
 * through the pizx CLI or pizx/globals), appears in `pizx --letters`, and is
 * traced and cacheable like the built-ins.
 *
 * Why a letter instead of a prompt in the script? Because the *prompt* is the
 * reusable part. Ξ takes a diff and returns a commit subject, so every script
 * (or git hook, or CI job) that needs one gets the same wording, the same
 * constraints, and the same result shape — and `Ξ({ model })` can point it at
 * a different model per call.
 *
 *   const subject = await Ξ({ maxChars: 60 })`${diff}`
 */

import Schema from 'schemastery'

export const name = 'commit'

// Declare hard dependencies — cordis starts this plugin only once the
// letters and llm services exist (order in config files does not matter).
export const inject = ['letters', 'llm']

export function apply(ctx) {
  ctx.letters.define('Ξ', {
    aliases: ['commit'],
    description: 'Write a conventional-commit subject line from a diff',

    // Schemastery options: validated at the boundary, defaults applied, and
    // the inferred types become the tag's option type in your editor.
    options: Schema.object({
      maxChars: Schema.natural().default(72),
      conventional: Schema.boolean().default(true),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
      cache: Schema.boolean(),
    }),

    run: async (prompt, opts, env) => {
      // env.ctx is the cordis context: ctx.llm, ctx.trace, ctx.cache, …
      const style = opts.conventional
        ? 'one conventional-commit subject line (type(scope): summary)'
        : 'one imperative subject line'

      const result = await env.ctx.llm.ask(
        `Write ${style} of at most ${opts.maxChars} characters for the change below.

Rules:
- Describe the change, not the files: no "update files", no "various fixes".
- No trailing period, no quotes, no markdown, no body.
- If the diff mixes unrelated changes, name the dominant one.

Change:
${prompt}`,
        {
          model: opts.model,
          system: 'You write commit messages for an experienced maintainer.',
          // Reasoning models bill thinking against the same budget, so keep
          // headroom: a tight cap can be spent entirely on thinking and the
          // reply comes back empty.
          maxTokens: 2048,
        }
      )
      // Usage is recorded into the active span by ctx.llm automatically, so
      // `pizx --trace` attributes these tokens to Ξ.
      return result.text
    },
  })
}

export default { name, inject, apply }
