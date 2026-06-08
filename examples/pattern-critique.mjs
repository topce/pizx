#!/usr/bin/env pizx
/**
 * ─── pattern-critique.mjs — Ψ (Psi) Critique ────────────────────────────────
 *
 * Generate → Critique → Improve cycle. Creates an initial answer, then
 * critiques and refines it. Perfect for content quality improvement.
 *
 * Run:
 *   pizx examples/pattern-critique.mjs
 *
 * Best for: writing documentation, generating commit messages, code review.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.yellow('\n Ψ Critique — Generate → Critique → Improve\n'))
console.log(chalk.dim(' A single-pass refinement cycle for content quality\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Ψ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  rounds: 1,
})`
Write a brief one-paragraph README description for a CLI tool called "pizx"
that combines shell scripting (zx) with AI capabilities (π for text,
Π for agent, and Greek letter patterns for advanced workflows).
Make it professional but welcoming.
`

console.log(chalk.green(`\n ✓ Critique complete — ${result.rounds.length} round(s)\n`))

for (const round of result.rounds) {
  console.log(chalk.yellow(`\n  Round ${round.round + 1}: Generated Content`))
  console.log(chalk.white(`   ${round.content}`))
  console.log(chalk.magenta(`\n  Round ${round.round + 1}: Critique`))
  console.log(chalk.dim(`   ${round.critique}`))
}

console.log(chalk.bold.cyan('\nFinal Improved Content:'))
console.log(chalk.white(result.finalContent))
console.log()
