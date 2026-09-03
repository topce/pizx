#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── fleet — parallelization: sectioning ─────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): split a task into
// independent subtasks and run them in parallel for speed, then aggregate
// the results. Each subtask gets a focused letter call instead of one
// overloaded prompt.
//
// Slot:   worker → π  (runs each task)
// Run:    node dist/cli.js examples/word-fleet.mjs
//         pizx examples/word-fleet.mjs
//
// The template splits into one task per line (bullet/numbered lists work
// too); the worker letter runs them `concurrency` at a time. A failed task
// is reported as ✗ and never sinks the fleet.

import { $, chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\nfleet — parallel fan-out (3 tasks, concurrency 3)\n'))

const result = await fleet({ model: MODEL, concurrency: 3 })`
summarize git merge in one sentence
summarize git rebase in one sentence
summarize git cherry-pick in one sentence
`

console.log(chalk.green(result.text))
console.log(chalk.dim(`\nduration: ${result.duration}ms\n`))

// Swap the worker slot by name or tag — the fan-out stays, the letter
// changes:
//
//   await fleet({ worker: 'Π' })`fix the bugs in src/`      // parallel agents
//   await fleet({ worker: 'Σ' })`
//     - summarize docs/pi.md
//     - summarize docs/words.md`                            // parallel Σ letters
//   await fleet({ worker: π({ model: '…' }), concurrency: 8 })`…`

// ── α live — the same fan-out with parallel ACP agents ──────────────────────
// `server` is forwarded through the word to each α worker. Read-only prompts,
// so the agents write nothing. Needs kiro-cli on PATH and authenticated
// (`kiro-cli login` once); skips cleanly otherwise.
const SERVER = ['kiro-cli', 'acp']
if ((await $({ nothrow: true })`which ${SERVER[0]}`).exitCode === 0) {
  console.log(chalk.bold(`\nfleet — worker → α (${SERVER.join(' ')}, read-only)\n`))
  const acpFleet = await fleet({ worker: 'α', server: SERVER, concurrency: 2 })`
  list the files in examples/plugins and describe what ralph.mjs does in one line
  list the files in examples/plugins and describe what chain.mjs does in one line
  `
  console.log(chalk.green(acpFleet.text))
  console.log(chalk.dim(`\nduration: ${acpFleet.duration}ms\n`))
} else {
  console.log(chalk.dim(`\n(skipped — ${SERVER[0]} not found; point \`server\` at any ACP v1 agent)\n`))
}
