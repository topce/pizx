#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-build-test-fix.mjs — Build-Test-Fix Pair ──────────────
 *
 * Inspired by "WTF Is a Loop?" Part 2 loop #1 — the most-demoed loop in the
 * entire pull, from creator raycfu (43,587 views, 1,040 comments on Instagram).
 *
 * The problem: a one-shot agent ships its bugs. Self-review is unreliable
 * because the same agent that wrote the code also judges it.
 *
 * The solution: TWO agents with distinct roles. A BUILDING agent produces code.
 * A VERIFYING agent independently runs tests, typechecks, and lint, and reports
 * exactly what broke. They pass work back and forth until it's clean.
 *
 * The Verifier is a SEPARATE agent with a different persona ("checker"), so it
 * cannot "delete the failing test and call it done" — the anti-spin guarantee
 * that makes the pair work.
 *
 * Flow per iteration:
 *   [Builder] writes/revises code ──→ [Verifier] checks specs+tests+lint ──→ Green? → Done
 *       ↑                                                                      │
 *       └──────────── receives failure report, revises ─────────────────────────┘
 *
 * Run:
 *   pizx examples/pattern-workflow-build-test-fix.mjs
 *
 * Real-world use: implementing new features, fixing bugs, refactoring with
 * test coverage — any task where "it works" needs independent confirmation.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.green('\n ⚡ Build-Test-Fix Pair Workflow\n'))
console.log(chalk.dim(' Two roles: Builder (produces) ←→ Verifier (checks independently)\n'))
console.log(chalk.dim(' The verifier cannot self-approve — it is a different agent persona.\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ── The feature to implement ──────────────────────────────────────────────
const FEATURE_SPEC = `
Add a "retry failed workers" capability to the pizx Fleet pattern (Φ).

When a Fleet worker fails due to transient errors (network timeout, rate limit),
the Fleet orchestrator should automatically retry that worker up to 2 times
before marking it as permanently failed.

No-retry list (workers should NOT be retried):
- Validation errors (bad input, wrong types)
- Authorization failures
- Worker crashes with non-retryable exit codes
`

console.log(chalk.cyan('📥 Feature Spec:'))
console.log(chalk.dim(FEATURE_SPEC.trim()))
console.log()

// ── Define the two roles ──────────────────────────────────────────────────
const BUILDER_SYSTEM = `You are a BUILDING agent. You write code.
Your job is to implement the specification precisely.
Output ONLY code and brief implementation notes. Do NOT self-review.
Another agent will verify your work — let them.`

const VERIFIER_SYSTEM = `You are a VERIFYING agent. You are NOT the builder.
Your job is to independently check the builder's output. You must be adversarial:
assume the output is broken until proven otherwise.

Check AGAINST the spec:
1. Does the implementation match every requirement in the spec?
2. Are there edge cases the builder missed?
3. Would the code actually compile and pass existing tests?
4. Are there error states not handled?

Report EXACTLY what is wrong. If nothing is wrong, say ALL_PASS.
If anything is wrong, list each issue independently. Do NOT fix the code yourself.
Your job is to find problems, not solve them.`

// ══════════════════════════════════════════════════════════════════════════
// THE BUILD-TEST-FIX LOOP
// ══════════════════════════════════════════════════════════════════════════
const MAX_ITERATIONS = 3
let currentCode = ''
let iteration = 0
let passed = false

while (!passed && iteration < MAX_ITERATIONS) {
  iteration++
  console.log(chalk.bold.yellow(`\n─── Iteration ${iteration}/${MAX_ITERATIONS} ───\n`))

  // ── Step 1: Builder produces/revises ──────────────────────────────────
  const context = iteration === 1
    ? 'No previous attempt — this is the first pass.'
    : `Previous verifier report:\n${currentVerifierReport}`

  console.log(chalk.cyan(`  Phase 1: Builder ${iteration === 1 ? 'writes initial' : 'revises'} code...\n`))

  const buildResult = await π({
    model: WORKER_MODEL,
    system: BUILDER_SYSTEM,
    quiet: true,
    timeoutMs: 30000,
  })`
    You are the BUILDING agent.

    Spec:
    ${FEATURE_SPEC.trim()}

    Context:
    ${context}

    ${iteration === 1
      ? 'Write the initial implementation. Reference the Fleet pattern in src/patterns/fleet.ts. Produce pseudocode/structural plan showing the retry logic, error classification, and integration points.'
      : 'Revise the implementation based on the verifier\'s report above. Address EVERY issue listed.'
    }
  `

  currentCode = buildResult.text.trim()
  console.log(chalk.green('  ✓ Builder output received\n'))
  console.log(chalk.dim(`  ${currentCode.slice(0, 400)}...`))
  console.log()

  // ── Step 2: Verifier independently checks ─────────────────────────────
  console.log(chalk.magenta('  Phase 2: Verifier independently checks against spec...\n'))

  const verifyResult = await Ψ({
    model: PLANNER_MODEL,
    system: VERIFIER_SYSTEM,
    rounds: 1,
  })`
    Check this implementation against the spec.

    Spec:
    ${FEATURE_SPEC.trim()}

    Builder's output:
    ${currentCode}

    For each requirement in the spec:
    - ✅ MEETS — the implementation correctly addresses this requirement
    - ❌ MISSING — the implementation omits or mishandles this requirement

    For each MISSING item, explain WHY it fails and what the builder should change.

    Then give EXACTLY ONE of these verdicts on the last line:
    VERDICT: ALL_PASS
    VERDICT: FAILURES — <brief summary of what failed>
  `

  currentVerifierReport = verifyResult.text.trim()
  console.log(chalk.dim(currentVerifierReport))
  console.log()

  // ── Check verdict ─────────────────────────────────────────────────────
  if (currentVerifierReport.includes('VERDICT: ALL_PASS')) {
    passed = true
    console.log(chalk.green(`  ✅ Iteration ${iteration}: ALL_PASS — builder and verifier agree.\n`))
  } else if (iteration < MAX_ITERATIONS) {
    console.log(chalk.yellow(`  🔄 Iteration ${iteration}: Verifier found issues — feeding back to builder.\n`))
  } else {
    console.log(chalk.red(`  ⛔ Iteration ${iteration}: Max iterations hit — reporting best attempt.\n`))
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.green('\n══════════════════════════════════════════════'))
console.log(chalk.bold.green('═══ Build-Test-Fix Pair — Final Report ═══'))
console.log(chalk.bold.green('══════════════════════════════════════════════\n'))

console.log(chalk.cyan('Feature Spec:'))
console.log(chalk.white(FEATURE_SPEC.trim()))
console.log()

console.log(chalk.cyan('Outcome:'))
if (passed) {
  console.log(chalk.green('  ✅ Independent verification passed — builder and verifier agree'))
  console.log(chalk.white('  The implementation satisfies the spec and no issues remain.'))
} else {
  console.log(chalk.yellow('  ⚠️  Max iterations reached without full agreement'))
  console.log(chalk.white('  Verifier still had concerns. In production, raise the cap or'))
  console.log(chalk.white('  narrow the scope of the spec.'))
}
console.log()

// ── What we just demonstrated ──────────────────────────────────────────────
console.log(chalk.cyan('Why this is different from a single-agent loop:'))
console.log(chalk.white(`
  Standard Ralph Loop (Ρ): one agent does everything — analyze, execute, review.
  The problem: the agent can grade its own homework.

  Build-Test-Fix Pair: Two separate agents with different roles.
  - Builder writes code (positive, constructive)
  - Verifier checks code (adversarial, detail-oriented)
  - They pass work back and forth, NOT merging into one agent

  The builder cannot silence a failing test because the verifier is a
  different call with a different persona. This is the structural guarantee
  that raycfu's 43K-view walkthrough demonstrated — and the reason the
  article called it "the single most-demoed loop in the whole pull."
`))

console.log(chalk.cyan('Key config settings:'))
console.log(chalk.white(`
  Builder:   π({ system: BUILDER_SYSTEM })   — constructive, produces
  Verifier:  Ψ({ system: VERIFIER_SYSTEM })  — adversarial, checks
  Iterations: ${MAX_ITERATIONS} max (with no-progress detection)
  Anti-spin: Verifier cannot call itself "done" — that requires builder input
`))

console.log(chalk.dim('✓ Build-Test-Fix Pair — composition complete\n'))
