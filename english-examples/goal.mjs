#!/usr/bin/env pizx
/**
 * ─── goal.mjs — goal (alias for γ Goal) ────────────────────────────────────
 *
 * Contract-first execution with a separate verifier model. Uses the English
 * word "goal" instead of the Greek letter γ.
 *
 * The verifier writes a contract first, then checks the worker's output
 * against it. Different model families = different blind spots.
 *
 * Run:
 *   pizx english-examples/goal.mjs
 */

import { chalk } from 'zx'

const VERIFIER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.blue('\n goal — Contract-First Execution\n'))
console.log(chalk.dim(' English alias for γ. Writes a contract, executes, verifies.\n'))
console.log(chalk.dim(` Verifier: ${VERIFIER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await goal({
  verifierModel: VERIFIER_MODEL,
  workerModel: WORKER_MODEL,
  maxIterations: 3,
  antiSpin: true,
  streakMode: 1,
  budgetCapUsd: 2.00,
})`
Review the pizx examples/ directory. Find one example that is missing
clear run instructions or has an unclear comment. Propose the fix.
`

console.log(chalk.green(`\n ✓ goal complete — ${result.iterationCount} iteration(s)\n`))

console.log(chalk.cyan('Verdict:'))
console.log(result.passed ? chalk.green('  ✅ Contract satisfied') : chalk.yellow('  ⚠️  Not fully satisfied'))

if (result.terminationReason) {
  console.log(chalk.yellow(`  Guard: ${result.terminationReason}`))
}
console.log()

console.log(chalk.cyan('Contract:'))
console.log(chalk.dim(result.contract.slice(0, 400)))
console.log()

for (const iter of result.iterations) {
  const icon = iter.verdict === 'ALL_PASS' ? '✅' : iter.verdict === 'HAS_PARTIALS' ? '⚠️' : '❌'
  console.log(chalk.yellow(`  ${icon} Iteration ${iter.iteration}: ${iter.verdict}`))
  console.log(chalk.dim(`    ${iter.verification.slice(0, 200)}...`))
  console.log()
}

console.log(chalk.white(`  Cost: $${result.totalCost.toFixed(4)} | Calls: ${result.callCount}`))
console.log()
