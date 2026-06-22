#!/usr/bin/env pizx
/**
 * ─── ralph-guards.mjs — ralph (alias for Ρ) with anti-spin + streak + budget
 *
 * Uses the English word "ralph" instead of the Greek letter Ρ.
 * Demonstrates all three new safety guards working together:
 *
 *   antiSpin: true   — stops if the agent produces identical reviews
 *   streakMode: 2    — requires 2 consecutive DONE reviews
 *   budgetCapUsd: 2  — stops if estimated cost exceeds $2
 *
 * Run:
 *   pizx english-examples/ralph-guards.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.magenta('\n ralph — with anti-spin + streak + budget\n'))
console.log(chalk.dim(' English alias for Ρ. Guards keep it honest.\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await ralph({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxIterations: 5,
  antiSpin: true,      // detect no-progress (>80% review overlap) and flip-flop
  streakMode: 2,       // require 2 consecutive DONE before accepting
  budgetCapUsd: 2.00,  // don't spend more than ~$2
  quiet: false,
})`
Look at the pizx src/patterns/ralph.ts file. Find ONE small thing to improve:
- A comment that could be clearer
- A variable name that could be more descriptive
- A log message that could include more context

Keep the change minimal. One file, one change.
`

console.log(chalk.green(`\n ✓ ralph complete — ${result.iterationCount} iteration(s)\n`))

console.log(chalk.cyan('Status:'))
console.log(result.completed
  ? chalk.green('  ✅ Completed')
  : chalk.yellow(`  ⚠️  Stopped: ${result.terminationReason || 'max iterations'}`))

if (result.terminationReason) {
  const icon = result.terminationReason.includes('no-progress') ? '🔁'
    : result.terminationReason.includes('flip-flop') ? '🔄'
    : result.terminationReason.includes('budget') ? '💰' : '⛔'
  console.log(chalk.yellow(`  ${icon} ${result.terminationReason}`))
}
console.log()

for (const iter of result.iterations) {
  console.log(chalk.yellow(`  ${iter.shouldContinue ? '🔄' : '✅'} Iteration ${iter.iteration}:`))
  console.log(chalk.dim(`    Plan:   ${iter.plan.slice(0, 100)}...`))
  console.log(chalk.dim(`    Review: ${iter.review.slice(0, 100)}...`))
  console.log()
}

console.log(chalk.white(`  Cost: $${result.totalCost.toFixed(4)} | Calls: ${result.callCount}`))
console.log()
