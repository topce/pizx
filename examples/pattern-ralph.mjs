#!/usr/bin/env pizx
/**
 * ─── pattern-ralph.mjs — Ρ (Rho) Ralph Loop ─────────────────────────────────
 *
 * An iterative self-correcting loop: Read → Analyze → Logic → Patch → Harden.
 * The loop drives toward a goal by analyzing, planning, executing, and reviewing.
 *
 * Run:
 *   pizx examples/pattern-ralph.mjs
 *
 * This example runs a quick Ralph loop to improve error handling comments.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.magenta('\n Ρ Ralph Loop — Iterative Self-Correction\n'))
console.log(chalk.dim(' The loop: analyze → plan → execute → review → repeat\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Ρ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxIterations: 3,
  quiet: false,
})`
Review the src/ directory and identify one small improvement:
1. Check if any .ts files are missing proper error handling
2. Suggest a specific, minimal improvement
3. Implement the improvement
4. Verify the change is correct
`

console.log(chalk.green(`\n ✓ Ralph Loop complete — ${result.iterationCount} iteration(s)\n`))
console.log(chalk.cyan('Result summary:'))
console.log(chalk.dim(result.text))
