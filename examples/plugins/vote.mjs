/**
 * vote — a "word": voting (parallelization for confidence, from Anthropic's
 * "Building effective agents"). The same prompt runs through one voter
 * letter N times in parallel; the responses are tallied. A clear majority
 * wins outright; otherwise a judge letter settles the vote — picking the
 * best answer (mode 'best') or synthesizing a consensus (mode 'majority').
 *
 *   await vote`is this code vulnerable?`
 *   await vote({ votes: 5, voter: 'π' })`review this diff`
 *
 * Slots:
 *   voter → π — answers the prompt (called `votes` times, in parallel).
 *   judge → π — settles split votes: consensus (majority) or best pick (best).
 *
 * Options:
 *   votes       — how many voters run (default 3).
 *   mode        — 'majority' (a clear majority wins, judge settles splits)
 *                 or 'best' (the judge always picks the best answer).
 *   concurrency — how many voters run at a time (default 3).
 */

import Schema from 'schemastery'

export const name = 'vote'

export const inject = ['words', 'letters', 'llm']

const normalize = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function apply(ctx) {
  ctx.words.define('vote', {
    aliases: ['jury'],
    description: 'Vote — run one prompt N times and aggregate the responses (voting)',
    slots: { voter: 'π', judge: 'π' },
    options: {
      votes: Schema.natural().min(1).default(3),
      mode: Schema.union(['majority', 'best']).default('majority'),
      concurrency: Schema.natural().min(1).default(3),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: async (prompt, opts, env) => {
      const { ctx } = env
      // Forward any letter options (model, server, cwd, …) to slot letters.
      const slotOpts = { quiet: true, ...ctx.words.slotOptions(opts) }
      if (!opts.quiet) {
        process.stderr.write(`vote: ${opts.votes} voter(s), mode=${opts.mode}\n`)
      }

      // Same prompt for every voter — parallel() fans out, failures are isolated.
      const results = await ctx.words.parallel(
        opts.voter,
        Array.from({ length: opts.votes }, () => prompt),
        { concurrency: opts.concurrency, options: slotOpts }
      )

      // Tally the (normalized) responses.
      const tally = new Map()
      for (const r of results) {
        if (!r.ok) continue
        const key = normalize(r.output.text)
        tally.set(key, (tally.get(key) ?? 0) + 1)
      }
      const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
      const top = ranked[0]
      if (!top) {
        const lines = results.map((r, i) => `[${i + 1}] ✗ ${r.error}`).join('\n')
        return `vote: all ${opts.votes} voter(s) failed\n\n${lines}`
      }

      const [topText, topCount] = top
      let verdict
      let how
      if (opts.mode === 'majority' && topCount > results.length / 2) {
        const winner = results.find((r) => r.ok && normalize(r.output.text) === topText)
        verdict = winner.output.text
        how = `${topCount}/${opts.votes} voters agreed`
      } else {
        const votesText = results
          .map((r, i) => (r.ok ? `Vote ${i + 1}:\n${r.output.text}` : null))
          .filter(Boolean)
          .join('\n\n')
        const ask =
          opts.mode === 'best'
            ? 'Pick the best answer from these votes and return it (verbatim or improved).'
            : 'The voters disagreed. Return the consensus answer.'
        verdict = (
          await ctx.words.call(opts.judge, `${ask}\n\nTask:\n${prompt}\n\n${votesText}`, slotOpts)
        ).text
        how = opts.mode === 'best' ? 'judge picked the best' : 'judge synthesized the consensus'
      }

      const lines = results.map((r, i) => {
        if (!r.ok) return `[${i + 1}] ✗ ${r.error}`
        const dup = results.findIndex(
          (q) => q.ok && normalize(q.output.text) === normalize(r.output.text)
        )
        const tag = dup < i ? ` (= vote ${dup + 1})` : ''
        return `[${i + 1}] ✓${tag} ${r.output.text.slice(0, 120)}`
      })
      const valid = results.length - results.filter((r) => !r.ok).length

      return `vote: ${valid}/${opts.votes} valid, mode=${opts.mode}\n\n${lines.join(
        '\n'
      )}\n\nVerdict (${how}):\n${verdict}`
    },
  })
}

export default { name, inject, apply }
