#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-adversarial-verification.mjs — Adversarial Verification
 *
 * Workflow Pattern 3 of 6 (from Claude Code dynamic workflows):
 *
 *   Worker → [Verifier 1, Verifier 2, Verifier 3]
 *
 * A worker produces output, then multiple verifiers with different "personas"
 * challenge it — looking for flaws, edge cases, and blind spots. In pizx,
 * Δ (Debate) provides built-in adversarial multi-perspective analysis.
 *
 * This example also shows composition: Σ (Subagents) generates content,
 * then Δ (Debate) adversarially verifies it.
 *
 * Run:
 *   pizx examples/pattern-workflow-adversarial-verification.mjs
 *
 * Real-world use: security audit, architecture review, test plan validation.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.red('\n ⚡ Adversarial Verification Workflow\n'))
console.log(chalk.dim(' Worker produces → Multiple Verifiers attack → Verdict\n'))

// ── Approach 1: Pure Δ Debate — built-in adversarial ──────────────────────
console.log(chalk.bold.yellow('\n─── Approach 1: Δ Debate (built-in adversarial) ───\n'))
console.log(chalk.dim(' Optimist, Pessimist, Pragmatist debate the proposal.\n'))

const PROPOSAL = `
Proposal: pizx should add a built-in rate limiter to all pattern tags
that automatically throttles LLM API calls when approaching provider limits.

Design:
- Track token usage per minute across all pattern invocations
- Auto-switch to a cheaper model when near rate limits
- Queue pending calls instead of failing
- Expose a \`rateLimit\` option on every pattern tag
`

const debateResult = await Δ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  perspectives: 3,
  rounds: 2, // rebuttals!
})`
Critically evaluate this proposal. Consider:
- Implementation complexity vs value
- Edge cases (nested patterns, concurrent scripts)
- User experience impact
- Alternative approaches

${PROPOSAL}
`

console.log(chalk.green(`✓ Debate: ${debateResult.perspectives.length} perspectives × ${debateResult.rounds} rounds\n`))

for (const p of debateResult.perspectives) {
  const label = p.role.toUpperCase()
  console.log(chalk.yellow(`  [Round ${p.round}] ${label}`))
  console.log(chalk.dim(`    ${p.argument.slice(0, 200)}...`))
  console.log()
}

console.log(chalk.bold.magenta('Converged Conclusion:'))
console.log(chalk.white(debateResult.conclusion))
console.log()

// ── Approach 2: Composition — Σ Generate + Δ Verify ───────────────────────
console.log(chalk.bold.yellow('\n─── Approach 2: Composition (Σ Generate → Δ Verify) ───\n'))
console.log(chalk.dim(' Subagents generates a plan, Debate adversarially verifies it.\n'))

// Step 1: Generate a solution using Subagents
console.log(chalk.cyan('Phase 1: Σ Subagents generating solution...\n'))

const generated = await Σ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  subdomains: ['error-handling', 'input-validation', 'state-management'],
  maxSubTasks: 3,
  quiet: true,
})`
Design an error handling strategy for a CLI tool that:
- Makes multiple async LLM calls
- Has file system operations
- Runs user-provided scripts
`

console.log(chalk.green('✓ Solution generated\n'))

// Step 2: Adversarially verify the generated solution
console.log(chalk.cyan('Phase 2: Δ Debate verifying solution...\n'))

const verification = await Δ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  perspectives: 2,
  roles: ['Security Auditor (find vulnerabilities)', 'Reliability Engineer (find failure modes)'],
})`
Verify this error handling strategy. Look for:
- Missing error cases
- Race conditions
- Resource leaks
- Silent failures
- Recovery gaps

Strategy to verify:
${generated.text}
`

console.log(chalk.bold.red('\n═══ Adversarial Verification Result ═══'))
console.log(chalk.white(verification.conclusion))
console.log()

console.log(chalk.dim('✓ Adversarial Verification — 2 approaches demonstrated\n'))
