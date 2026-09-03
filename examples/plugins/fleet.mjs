/**
 * fleet — a "word": an AI pattern (parallel fan-out) composed from a single
 * replaceable worker letter via the ctx.words service.
 *
 * Slot:
 *   worker → π (text) by default — swap for 'Π' (parallel agents) or 'α'.
 *
 * The template is split into tasks: one per line, or a bullet/numbered list.
 *
 *   await fleet`review these files`
 *   await fleet({ worker: 'Π', concurrency: 3 })`fix the bugs in src/`
 */

import Schema from 'schemastery'

export const name = 'fleet'

export const inject = ['words', 'letters', 'llm']

/** Split the prompt into tasks: bullets/numbered lines, then one-per-line. */
function splitTasks(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length <= 1) return [text]

  const listItems = lines.filter((l) => /^[-*]\s/.test(l) || /^\d+[.)]\s/.test(l))
  if (listItems.length > 1) {
    return listItems.map((b) => b.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, ''))
  }
  return lines
}

export function apply(ctx) {
  ctx.words.define('fleet', {
    aliases: ['parallel'],
    description: 'Fleet — parallel fan-out of a worker letter (a word)',
    slots: { worker: 'π' },
    options: {
      concurrency: Schema.natural().min(1).default(5),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: async (prompt, opts, env) => {
      const { ctx } = env
      const tasks = splitTasks(prompt)
      if (!opts.quiet) {
        process.stderr.write(`fleet: ${tasks.length} task(s), worker=${opts.worker}\n`)
      }

      // Forward any letter options (model, server, cwd, …) to the worker slot.
      const results = await ctx.words.parallel(opts.worker, tasks, {
        concurrency: opts.concurrency,
        options: { quiet: true, ...ctx.words.slotOptions(opts) },
      })

      const ok = results.filter((r) => r.ok).length
      const lines = results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.ok ? '✓' : '✗'} ${r.input}\n  ${(r.output?.text ?? r.error ?? '').slice(0, 200)}`
        )
        .join('\n\n')
      return `${ok}/${results.length} succeeded\n\n${lines}`
    },
  })
}

export default { name, inject, apply }
