#!/usr/bin/env pizx
/**
 * ─── pattern-dogfood-goal.mjs — γ Goal: Add a Feature to pizx Itself ────────
 *
 * Dogfooding: use pizx to improve pizx. The γ (goal) tag writes a formal
 * contract first, executes with a worker model, then verifies with a SEPARATE
 * model. If the verifier finds gaps, it feeds them back — capped iterations,
 * anti-spin detection, and streak mode keep it honest.
 *
 * This example asks pizx to review its OWN codebase and propose a concrete
 * improvement — demonstrating contract-first development on the project itself.
 *
 * Run:
 *   pizx examples/pattern-dogfood-goal.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.blue('\n γ Goal: pizx Builds pizx\n'))
console.log(chalk.dim(' Contract-first — write what "done" means BEFORE executing\n'))
console.log(chalk.dim(` Verifier: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ── The task: improve pizx's own documentation ───────────────────────────
const TASK = `
Review the pizx documentation in docs/ and identify the single most impactful
improvement: a missing docs page, an unclear section, or an outdated reference.
Propose the specific change with exact text.
`

console.log(chalk.cyan('📥 Task:'))
console.log(chalk.dim(TASK.trim()))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// γ Goal: contract-first execution with separate verifier
// ══════════════════════════════════════════════════════════════════════════
const result = await γ({
  verifierModel: PLANNER_MODEL,    // separate model for contract + verification
  workerModel: WORKER_MODEL,       // different model does the work
  maxIterations: 3,
  antiSpin: true,                  // stop if no progress between iterations
  streakMode: 1,                   // stop on first ALL_PASS
  budgetCapUsd: 3.00,              // don't spend more than ~$3
})`${TASK}`

// ══════════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n══════════════════════════════════════════════'))
console.log(chalk.bold.blue('═══ γ Goal — Results ═══'))
console.log(chalk.bold.blue('══════════════════════════════════════════════\n'))

console.log(chalk.cyan('Verdict:'))
console.log(result.passed
  ? chalk.green('  ✅ Contract SATISFIED — all verification criteria met')
  : chalk.yellow('  ⚠️  Contract NOT fully satisfied'))

if (result.terminationReason) {
  console.log(chalk.yellow(`  Stopped: ${result.terminationReason}`))
}
console.log()

console.log(chalk.cyan('Execution:'))
console.log(chalk.white(`  Iterations: ${result.iterationCount}`))
console.log(chalk.white(`  Cost:       $${result.totalCost.toFixed(4)}`))
console.log()

// Show the contract
console.log(chalk.cyan('Contract (what "done" means):'))
console.log(chalk.dim(result.contract.slice(0, 500)))
if (result.contract.length > 500) console.log(chalk.dim('  ...'))
console.log()

// Show iterations
for (const iter of result.iterations) {
  const icon = iter.verdict === 'ALL_PASS' ? '✅' : iter.verdict === 'HAS_PARTIALS' ? '⚠️' : '❌'
  console.log(chalk.yellow(`  ${icon} Iteration ${iter.iteration}: ${iter.verdict}`))
  console.log(chalk.dim(`    Result: ${iter.result.slice(0, 150)}...`))
  console.log(chalk.dim(`    Verification: ${iter.verification.slice(0, 150)}...`))
  console.log()
}

console.log(chalk.dim('✓ γ Goal — dogfooding complete\n'))
