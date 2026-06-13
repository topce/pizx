#!/usr/bin/env pizx
/**
 * ─── debate.mjs — debate (alias for Δ Debate) ──────────────────────
 *
 * Multiple agents analyze a question from different perspectives then converge.
 * Uses the English word "debate" instead of the Greek letter Δ.
 *
 * Run:
 *   pizx english-examples/debate.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.blue('\n debate — Multi-Perspective Analysis\n'))
console.log(chalk.dim(' English alias for Δ (Delta). Optimist · Pessimist · Pragmatist\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await debate({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  perspectives: 3,
})`
What are the trade-offs between using a monorepo vs multiple repositories
for a TypeScript project with shared packages like this one?
Focus on developer experience, build times, and dependency management.
`

console.log(chalk.green(`\n ✓ debate complete — ${result.perspectives.length} perspectives\n`))

console.log(chalk.bold.cyan('Perspectives:'))
for (const p of result.perspectives) {
  console.log(chalk.yellow(`\n  [${p.role}]`))
  console.log(chalk.dim(`   ${p.argument.slice(0, 300)}${p.argument.length > 300 ? '...' : ''}`))
}

console.log(chalk.bold.magenta('\nConverged Conclusion:'))
console.log(chalk.white(result.conclusion))
console.log()
