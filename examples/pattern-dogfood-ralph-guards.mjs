#!/usr/bin/env pizx
/**
 * ─── pattern-dogfood-ralph-guards.mjs — Ρ Ralph: anti-spin + streak + budget
 *
 * Dogfooding: use pizx's Ralph Loop with ALL new safety guards to audit
 * pizx's own codebase. Demonstrates the three new options working together:
 *
 *   antiSpin: true   — stop if the agent produces identical reviews (spinning)
 *   streakMode: 2    — require 2 consecutive DONE reviews (not just one lucky pass)
 *   budgetCapUsd: 3  — don't spend more than ~$3 on this task
 *
 * The task: find and fix one small issue in pizx's source code (typo, missing
 * comment, unused import, etc.), with the anti-spin guard ensuring the agent
 * doesn't loop on the same finding forever.
 *
 * Run:
 *   pizx examples/pattern-dogfood-ralph-guards.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.magenta('\n Ρ Ralph Loop — Anti-Spin + Streak + Budget\n'))
console.log(chalk.dim(' Self-referential: pizx audits its own source code\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ══════════════════════════════════════════════════════════════════════════
// Ρ Ralph: all three new guards active
// ══════════════════════════════════════════════════════════════════════════
const result = await Ρ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxIterations: 5,
  antiSpin: true,      // ← NEW: detect no-progress (>80% review overlap)
  streakMode: 2,       // ← NEW: require 2 consecutive DONE before stopping
  budgetCapUsd: 3.00,  // ← NEW: stop if estimated cost exceeds $3
  quiet: false,
})`
Review the pizx src/patterns/ directory and find ONE small, concrete
improvement. Examples of good targets:

1. A TypeScript file with a missing JSDoc comment on an exported function
2. A pattern file with a typo or unclear variable name
3. An unused import statement
4. An inconsistent code pattern compared to other pattern files

For each iteration:
1. Analyze: find the specific issue (file path + line)
2. Plan: describe exactly what to change
3. Execute: make the change
4. Review: verify the change is correct and doesn't break anything

Stop when the fix is clean and reviewed. Do NOT propose new features or large
refactors — keep changes minimal and verifiable.
`

// ══════════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.magenta('\n══════════════════════════════════════════════'))
console.log(chalk.bold.magenta('═══ Ρ Ralph — Results ═══'))
console.log(chalk.bold.magenta('══════════════════════════════════════════════\n'))

console.log(chalk.cyan('Status:'))
console.log(result.completed
  ? chalk.green(`  ✅ Completed — ${result.iterationCount} iteration(s)`)
  : chalk.yellow(`  ⚠️  Not completed — ${result.iterationCount} iteration(s)`))

if (result.terminationReason) {
  const icon = result.terminationReason.includes('budget')
    ? '💰' : result.terminationReason.includes('no-progress')
    ? '🔁' : result.terminationReason.includes('flip-flop')
    ? '🔄' : '⛔'

  console.log(chalk.yellow(`  ${icon} Guard fired: ${result.terminationReason}`))
} else {
  console.log(chalk.green('  🛡️  Guards: no spin detected'))
}
console.log()

console.log(chalk.cyan('Cost:'))
console.log(chalk.white(`  $${result.totalCost.toFixed(4)} (${result.callCount} LLM calls)`))
console.log()

// Per-iteration detail
for (const iter of result.iterations) {
  const icon = iter.shouldContinue ? '🔄' : '✅'
  console.log(chalk.yellow(`  ${icon} Iteration ${iter.iteration}:`))
  console.log(chalk.dim(`    Plan:   ${iter.plan.slice(0, 120)}...`))
  console.log(chalk.dim(`    Review: ${iter.review.slice(0, 120)}...`))
  console.log()
}

// Guards explanation
console.log(chalk.cyan('How the guards protected this run:'))
console.log(chalk.white(`
  antiSpin: true     — Would have stopped early if the agent produced the
                       same review text twice (no-progress) or alternated
                       between ITERATE/DONE (flip-flop). Saves tokens.

  streakMode: 2      — Required 2 consecutive "DONE" reviews before accepting
                       the work. One green run is luck; two is confidence.

  budgetCapUsd: 3.00 — Would have stopped if estimated cost exceeded $3.
                       Prevents the "$6,000 overnight" scenario from the
                       "WTF Is a Loop?" article.
`))

console.log(chalk.dim('✓ Ρ Ralph with guards — dogfooding complete\n'))
