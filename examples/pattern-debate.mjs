#!/usr/bin/env pizx
/**
 * ─── pattern-debate.mjs — Δ (Delta) Debate ──────────────────────────────────
 *
 * Multiple agents analyze a question from different perspectives (optimist,
 * pessimist, pragmatist, etc.) then converge on a balanced conclusion.
 *
 * Run:
 *   pizx examples/pattern-debate.mjs
 *
 * Best for: architectural decisions, design trade-offs, strategic planning.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.blue('\n Δ Debate — Multi-Perspective Analysis\n'))
console.log(chalk.dim(' Optimist · Pessimist · Pragmatist → Converged Conclusion\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Δ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  perspectives: 3,
})`
What are the trade-offs between using a monorepo vs multiple repositories
for a TypeScript project with shared packages like this one?
Focus on developer experience, build times, and dependency management.
`

console.log(chalk.green(`\n ✓ Debate complete — ${result.perspectives.length} perspectives\n`))

console.log(chalk.bold.cyan('Perspectives:'))
for (const p of result.perspectives) {
  console.log(chalk.yellow(`\n  [${p.role}]`))
  console.log(chalk.dim(`   ${p.argument.slice(0, 300)}${p.argument.length > 300 ? '...' : ''}`))
}

console.log(chalk.bold.magenta('\nConclusion:'))
console.log(chalk.white(result.conclusion))
console.log()
