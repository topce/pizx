#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── ralph — the iterative agent loop ────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): the autonomous
// agent — an LLM loop over analyze → plan → execute → review, stopping when
// the review says DONE or the iteration budget runs out.
//
// Slots:  analyze → π · plan → π · execute → Π · review → π
// Run:    node dist/cli.js examples/word-ralph.mjs
//         pizx examples/word-ralph.mjs
//
// The default `execute` slot is Π (a coding agent). The run below swaps it
// for π so the whole loop stays pure text; with the default slots the same
// word drives a real agent — see the swap notes at the bottom.

import { $, chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\nralph — analyze → plan → execute → review\n'))
console.log(chalk.dim('(per-iteration progress goes to stderr)\n'))

const result = await ralph({ model: MODEL, execute: 'π', maxIterations: 3 })`
write a one-sentence definition of a pizx "word"
`

console.log(chalk.green(result.text))
console.log(chalk.dim(`\nduration: ${result.duration}ms\n`))

// Swap the slots by name or by pre-configured tag — the pattern stays, the
// letters change:
//
//   await ralph({ maxIterations: 3 })`fix the lint errors in src/`        // Π executes
//   await ralph({ execute: 'α', server: ['kiro-cli', 'acp'] })`refactor auth`
//   await ralph({ execute: Π({ tools: ['read', 'edit'] }) })`fix the docs`
//   await ralph({ review: 'vote' })`…`          // the reviewer votes instead

// ── α live — the same loop with an ACP executor in the execute slot ────────
// The `server` option is forwarded through the word to the α slot. The
// prompt is read-only, so the agent writes nothing. Needs kiro-cli on PATH
// and authenticated (`kiro-cli login` once); skips cleanly otherwise.
const SERVER = ['kiro-cli', 'acp']
if ((await $({ nothrow: true })`which ${SERVER[0]}`).exitCode === 0) {
  console.log(chalk.bold(`\nralph — execute → α (${SERVER.join(' ')}, read-only)\n`))
  const acpResult = await ralph({
    execute: 'α',
    server: SERVER,
    maxIterations: 1,
    quiet: true,
  })`
  list the plugin files in the examples/plugins directory and say what each one defines
  `
  console.log(chalk.green(acpResult.text))
  console.log(chalk.dim(`\nduration: ${acpResult.duration}ms\n`))
} else {
  console.log(chalk.dim(`\n(skipped — ${SERVER[0]} not found; point \`server\` at any ACP v1 agent)\n`))
}
