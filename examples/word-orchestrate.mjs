#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── orchestrate — orchestrator-workers ──────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): a central planner
// dynamically breaks the task into subtasks (you cannot predict them up
// front), workers run each one in parallel, and a synthesizer merges the
// results into one answer. Unlike fleet — where *you* split the work — the
// decomposition itself is model-driven.
//
// Slots:  planner → π · worker → π · synthesizer → π
// Run:    pizx examples/word-orchestrate.mjs
//
// Keep worker answers short. Both this word and `fleet` show each worker's
// result truncated to 200 characters, so they are built for many *small*
// results — subjects, verdicts, labels — not for N essays. The synthesizer
// turns those into the one long answer.
//
// level 5/5 ●●●●● · previous: examples/word-ralph.mjs (word 6/7 — the agent loop) · next: examples/words.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

async function withBudget(retries, fn) {
  let last
  for (const maxTokens of retries) {
    last = await fn(maxTokens)
    if (last.text.trim()) return last
    process.stderr.write(`  (empty reply at maxTokens=${maxTokens} — retrying with headroom)\n`)
  }
  return last
}

// ── Real work: a release-notes pass over the recent history ────────────────
// Every commit already carries a subject, so the answers stay short and the
// planner's split is genuinely useful: one worker per change area.
const commits = (await $`git log -14 --no-merges --oneline`).stdout.trim()
const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))

echo(chalk.bold(`\norchestrate — turn ${commits.split('\n').length} commits into release notes\n`))
echo(chalk.dim(`  target: ${pkg.name} ${pkg.version}\n`))

const notes = await withBudget([8192, 16384], (maxTokens) =>
  orchestrate({
    model: MODEL,
    maxTokens,
    maxWorkers: 3,
    concurrency: 3,
  })`
Turn the commit history below into release notes for ${pkg.name} ${pkg.version}.

Split the commits into up to 3 groups by area (for example CLI, docs, internals).
For each group, have a worker reply with ONE bullet of at most 12 words, in the
form "- area: user-visible change". Then synthesize all bullets into a single
release-notes section with the heading "## ${pkg.version}".

Commits:
${commits}
`
)

echo(chalk.green(notes.text.trim()))
echo(chalk.dim(`\nduration: ${notes.duration}ms\n`))

// ── Swap any slot ──────────────────────────────────────────────────────────
//   await orchestrate({ worker: 'Π' })`add tests for src/core/words.ts`   // agent workers
//   await orchestrate({ worker: 'α', server: ['kiro-cli', 'acp'] })`…`   // ACP agent workers
//   await orchestrate({ worker: 'refine' })`polish every docs section`   // nested word
//   await orchestrate({ planner: 'π', worker: 'fleet' })`…`              // nested fan-out
//   await orchestrate({ maxWorkers: 1 })`…`                              // plan, then just do it
//
// Workers do not see the template, only their subtask line — so a good prompt
// says what each subtask looks like, not just what the final answer is.
// Fleet vs orchestrate: use fleet when you can list the subtasks yourself
// (deterministic, cheap, one shared standard); use orchestrate when the
// decomposition depends on what the planner finds.
