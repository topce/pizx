#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── vote — parallelization: voting ──────────────────────────────────────────
// Pattern (from Anthropic's "Building effective agents"): run the same
// prompt N times in parallel and aggregate the responses — multiple
// perspectives for higher-confidence results. A clear majority wins
// outright; otherwise the judge letter settles the vote.
//
// Slots:  voter → π · judge → π
// Run:    node dist/cli.js examples/word-vote.mjs
//         pizx examples/word-vote.mjs
//
//   mode: 'majority' — a strict majority wins; the judge synthesizes a
//                      consensus when the voters split (default).
//   mode: 'best'     — the judge always picks the best answer.

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\nvote — 1) majority mode: 3 voters, one question\n'))

const verdict = await vote({ model: MODEL, votes: 3 })`
which git command stages all changes?
`
console.log(chalk.green(verdict.text))
console.log(chalk.dim(`\nduration: ${verdict.duration}ms\n`))

console.log(chalk.bold("\nvote — 2) best mode: 4 voters, the judge picks\n"))

const best = await vote({ model: MODEL, votes: 4, mode: 'best' })`
write a one-line release note for pizx v1.4
`
console.log(chalk.green(best.text))
console.log(chalk.dim(`\nduration: ${best.duration}ms\n`))

// Tune the tally:
//   await vote({ votes: 5, concurrency: 5 })`is this diff safe to merge?`
//   await vote({ voter: 'Π', votes: 2 })`…`            // voter slots swap too
