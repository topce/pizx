#!/usr/bin/env pizx
/**
 * ─── pattern-dogfood-cross-model.mjs — γ Goal: Cross-Model Verification ────
 *
 * Dogfooding: use two different model families to audit pizx's own architecture.
 * This is the Clodex pattern from "WTF Is a Loop?" Part 2, loop #14:
 *
 *   "Two different model families have to agree before code lands."
 *   — Lukas Kucinski, Clodex
 *
 * The verifier model (Anthropic Claude) writes the contract and checks work.
 * The worker model (DeepSeek) executes against it. Since they're different
 * model families, the worker can't exploit the verifier's blind spots.
 *
 * The task: review pizx's pattern composition architecture and identify
 * whether pattern nesting (Fleet→Subagent, Pipeline→Critique, etc.) has
 * any edge cases that the type system doesn't catch.
 *
 * Run:
 *   pizx examples/pattern-dogfood-cross-model.mjs
 */

import { chalk } from 'zx'

// ── Two different model families — the entire point ──────────────────────
const VERIFIER_MODEL = 'anthropic/claude-sonnet-4-5'   // writes contract + verifies
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'       // does the work

console.log(chalk.bold.magenta('\n ⚡ Cross-Model Verification: pizx Audits pizx\n'))
console.log(chalk.dim(' Two model families must agree. Different blind spots.\n'))
console.log(chalk.dim(` Verifier (contract + check): ${VERIFIER_MODEL}`))
console.log(chalk.dim(` Worker  (execution):         ${WORKER_MODEL}`))
console.log(chalk.dim(`   ↓ Different model families below ↓\n`))

// ── The task: audit pattern composition ──────────────────────────────────
const TASK = `
Review the pizx pattern composition architecture in src/patterns/types.ts
(the TaskDescriptor type and related functions). Pattern composition allows
nesting patterns inside Fleet and Pipeline stages via callback functions.

Analyze edge cases. For each, state whether the current code handles it:
1. A Fleet task that is a Pipeline with 3 stages — does the type system
   enforce that the callback returns a Promise<string>?
2. A sub-pattern that throws an error — does the parent pattern surface it
   correctly with the calling pattern's phaseLog?
3. Deeply nested composition (Fleet → Pipeline → Critique → Subagents) —
   does tracing (CallTrace) attribute costs to the correct pattern?
4. A sub-pattern with mode:'agent' that edits files — do the parent's
   confirm gates still fire?

For each edge case: ✅ SAFE (handled), ⚠️ RISK (works but fragile),
or ❌ GAP (not handled).
`

console.log(chalk.cyan('📥 Task:'))
console.log(chalk.dim(TASK.trim()))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// γ Goal: cross-model verification with streak mode
// ══════════════════════════════════════════════════════════════════════════
const result = await γ({
  verifierModel: VERIFIER_MODEL,  // Anthropic writes contract + verifies
  workerModel: WORKER_MODEL,      // DeepSeek does the analysis
  maxIterations: 4,
  antiSpin: true,                 // detect no-progress between iterations
  streakMode: 2,                  // require 2 consecutive ALL_PASS
  budgetCapUsd: 4.00,
})`${TASK}`

// ══════════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.magenta('\n══════════════════════════════════════════════'))
console.log(chalk.bold.magenta('═══ Cross-Model Verification — Results ═══'))
console.log(chalk.bold.magenta('══════════════════════════════════════════════\n'))

console.log(chalk.cyan('Models used:'))
console.log(chalk.white(`  Verifier: ${VERIFIER_MODEL}`))
console.log(chalk.white(`  Worker:   ${WORKER_MODEL}`))
console.log()

console.log(chalk.cyan('Verdict:'))
if (result.passed) {
  console.log(chalk.green('  ✅ Both models agree — cross-model validation passed'))
  console.log(chalk.green(`     ${result.iterationCount} iteration(s) to reach agreement`))
} else {
  console.log(chalk.yellow('  ⚠️  Models did not fully agree'))
  console.log(chalk.yellow(`     ${result.iterationCount} iteration(s) — stopped at cap`))
}

if (result.terminationReason) {
  console.log(chalk.yellow(`  Stopped: ${result.terminationReason}`))
}
console.log()

console.log(chalk.cyan('Cost:'))
console.log(chalk.white(`  $${result.totalCost.toFixed(4)} (${result.callCount} LLM calls)`))
console.log()

// Per-iteration audit trail
for (const iter of result.iterations) {
  const icon = iter.verdict === 'ALL_PASS' ? '✅' : iter.verdict === 'HAS_PARTIALS' ? '⚠️' : '❌'
  console.log(chalk.yellow(`  ${icon} Iteration ${iter.iteration}: ${iter.verdict}`))
  console.log(chalk.dim(`    Result: ${iter.result.slice(0, 200)}...`))
  console.log(chalk.dim(`    Verification: ${iter.verification.slice(0, 200)}...`))
  console.log()
}

// Cross-model insight
console.log(chalk.cyan('Why cross-model matters:'))
console.log(chalk.white(`
  A single model family grading its own work shares blind spots.
  Claude misses what Claude always misses. DeepSeek catches different things.

  By using Claude as the verifier and DeepSeek as the worker:
  - The worker can't exploit the verifier's known weaknesses
  - The verifier catches biases the worker's training might have
  - "ALL_PASS" now means TWO independent model families confirmed it

  As the article put it:
  "two different model families have to agree before code lands"
  — Lukas Kucinski, Clodex (WTF Is a Loop? Part 2, #14)
`))

console.log(chalk.dim('✓ Cross-model verification — dogfooding complete\n'))
