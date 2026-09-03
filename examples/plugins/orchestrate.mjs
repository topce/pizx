/**
 * orchestrate — a "word": orchestrator-workers (from Anthropic's "Building
 * effective agents"). A planner letter decomposes the task into independent
 * subtasks; a worker letter runs each one in parallel; a synthesizer letter
 * merges the worker results into one answer. Unlike fleet (a pre-split
 * fan-out), the decomposition itself is model-driven.
 *
 *   await orchestrate`audit the docs for inconsistencies`
 *   await orchestrate({ worker: 'Π' })`implement the TODOs across src/`
 *
 * Slots:
 *   planner     → π — breaks the task into subtasks (one per line).
 *   worker      → π — executes each subtask (parallel fan-out).
 *   synthesizer → π — merges the worker results into the final answer.
 *
 * Options:
 *   concurrency — workers running at a time (default 5).
 *   maxWorkers  — hard cap on planner subtasks (default 8).
 */

import Schema from 'schemastery'

export const name = 'orchestrate'

export const inject = ['words', 'letters', 'llm']

export function apply(ctx) {
  ctx.words.define('orchestrate', {
    aliases: ['director'],
    description:
      'Orchestrate — decompose, fan out to parallel workers, synthesize (orchestrator-workers)',
    slots: { planner: 'π', worker: 'π', synthesizer: 'π' },
    options: {
      concurrency: Schema.natural().min(1).default(5),
      maxWorkers: Schema.natural().min(1).default(8),
      model: Schema.string(),
      quiet: Schema.boolean().default(false),
    },
    run: async (prompt, opts, env) => {
      const { ctx } = env
      // Forward any letter options (model, server, cwd, …) to slot letters.
      const slotOpts = { quiet: true, ...ctx.words.slotOptions(opts) }
      if (!opts.quiet) process.stderr.write('orchestrate: planning…\n')

      const planText = (
        await ctx.words.call(
          opts.planner,
          `Break the task into independent subtasks (at most ${opts.maxWorkers}). Reply with one subtask per line, nothing else.\n\nTask:\n${prompt}`,
          slotOpts
        )
      ).text
      const subtasks = planText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, opts.maxWorkers)

      // Degenerate plan → run the task directly (no fan-out, no synthesis).
      if (subtasks.length === 0) {
        const direct = await ctx.words.call(opts.worker, prompt, slotOpts)
        return `(planner produced no subtasks — ran the task directly)\n\n${direct.text}`
      }

      if (!opts.quiet) {
        process.stderr.write(
          `orchestrate: ${subtasks.length} subtask(s), ${opts.concurrency} worker(s) at a time\n`
        )
      }
      const results = await ctx.words.parallel(opts.worker, subtasks, {
        concurrency: opts.concurrency,
        options: slotOpts,
      })
      const okCount = results.filter((r) => r.ok).length

      let synthesis
      if (okCount === 0) {
        synthesis = `(all ${results.length} worker(s) failed)\n\n${results
          .map((r, i) => `[${i + 1}] ✗ ${r.input}: ${r.error}`)
          .join('\n')}`
      } else if (results.length === 1) {
        synthesis = results[0].output.text
      } else {
        const workerText = results
          .map((r) =>
            r.ok
              ? `Subtask: ${r.input}\nResult:\n${r.output.text}`
              : `Subtask: ${r.input}\nResult: FAILED (${r.error})`
          )
          .join('\n\n')
        synthesis = (
          await ctx.words.call(
            opts.synthesizer,
            `Merge the worker results into one coherent answer.\n\nTask:\n${prompt}\n\n${workerText}`,
            slotOpts
          )
        ).text
      }

      const log = results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.ok ? '✓' : '✗'} ${r.input}\n  ${(r.output?.text ?? r.error ?? '').slice(0, 120)}`
        )
        .join('\n\n')
      return `orchestrate: ${okCount}/${results.length} worker(s) succeeded\n\n${log}\n\nSynthesis:\n${synthesis}`
    },
  })
}

export default { name, inject, apply }
