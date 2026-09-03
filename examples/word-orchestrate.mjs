#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── orchestrate — orchestrator-workers ──────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): a central planner
// dynamically breaks the task into subtasks (you can't predict them up
// front), workers run each one in parallel, and a synthesizer merges the
// results into one answer. Unlike fleet (a pre-split fan-out), the
// decomposition itself is model-driven.
//
// Slots:  planner → π · worker → π · synthesizer → π
// Run:    node dist/cli.js examples/word-orchestrate.mjs
//         pizx examples/word-orchestrate.mjs

import { $, chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\norchestrate — plan → fan out → synthesize\n'))

const result = await orchestrate({ model: MODEL, maxWorkers: 3, concurrency: 3 })`
compare three retry strategies for LLM calls — fixed backoff, exponential
backoff, and jittered backoff — and recommend one
`
console.log(chalk.green(result.text))
console.log(chalk.dim(`\nduration: ${result.duration}ms\n`))

// Swap the worker for agents, or any slot for another word:
//   await orchestrate({ worker: 'Π' })`implement the TODOs across src/`
//   await orchestrate({ worker: 'refine' })`polish every docs section`
//   await orchestrate({ planner: 'π', worker: 'fleet' })`…`   // nested fan-out

// ── α live — decompose, parallel ACP agents, synthesize ─────────────────────
// `server` is forwarded through the word to each α worker. Read-only prompt,
// so the agents write nothing. Needs kiro-cli on PATH and authenticated
// (`kiro-cli login` once); skips cleanly otherwise.
const SERVER = ['kiro-cli', 'acp']
if ((await $({ nothrow: true })`which ${SERVER[0]}`).exitCode === 0) {
  console.log(chalk.bold(`\norchestrate — worker → α (${SERVER.join(' ')}, read-only)\n`))
  const acpPlan = await orchestrate({
    worker: 'α',
    server: SERVER,
    model: MODEL,
    maxWorkers: 2,
    concurrency: 2,
  })`
  inspect the examples/ directory and report two improvements for the example scripts
  `
  console.log(chalk.green(acpPlan.text))
  console.log(chalk.dim(`\nduration: ${acpPlan.duration}ms\n`))
} else {
  console.log(chalk.dim(`\n(skipped — ${SERVER[0]} not found; point \`server\` at any ACP v1 agent)\n`))
}
