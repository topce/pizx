#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-goal-contract.mjs — Goal Contract ─────────────────────
 *
 * Inspired by "WTF Is a Loop?" Part 2 loops #7 and #15:
 *   #7 — evgenii.arsentev's goal-meta-skill (32 likes, 600+ stars in days)
 *   #15 — 3goblack's completion-contract (@Dis_Trackted)
 *
 * The key insight: an agent that says "done" when it's not is the #1 failure
 * mode. The fix is a CONTRACT — written BEFORE any work starts — that defines:
 *   - Exact end state ("what does done look like?")
 *   - Verification criteria ("how do we prove each requirement is met?")
 *   - What NOT to touch ("these files/modules are off-limits")
 *   - Stop conditions ("max iterations, no-progress detection, budget")
 *
 * Flow:
 *   Phase 1: π writes a formal contract from a vague ask
 *   Phase 2: Σ decomposes work against the contract
 *   Phase 3: Execute (Π) each sub-task
 *   Phase 4: Ψ verifies output against the contract's OWN criteria
 *   Phase 5: Contract violations → re-execute (capped) | Pass → report
 *
 * Run:
 *   pizx examples/pattern-workflow-goal-contract.mjs
 *
 * Real-world use: any task where "done" is ambiguous — feature implementation,
 * bug fixing, refactoring, documentation writing.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.blue('\n ⚡ Goal Contract Workflow\n'))
console.log(chalk.dim(' Vague Ask → π Contract → Σ Decompose → Execute → Ψ Verify Against Contract → Report\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ── The vague ask ─────────────────────────────────────────────────────────
const VAGUE_ASK = `
Add error handling to the pizx Fleet pattern. When one worker fails,
the whole thing should handle it gracefully instead of crashing.
Also add some logging so users can see what happened.
`

console.log(chalk.cyan('📥 Vague Ask:'))
console.log(chalk.dim(VAGUE_ASK.trim()))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// PHASE 1: π writes a formal contract
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.yellow('\n─── Phase 1: π — Write Formal Contract ───\n'))

const contract = await π({
  model: PLANNER_MODEL,
})`
You are at step 1 of "Goal Contract" workflow. The user gave a vague ask. Your job:
Write a RIGOROUS contract that makes it impossible for an agent to claim "done"
when it's not.

The contract format MUST include ALL of these sections:

1. **Exact End State** — What "done" means, in bullet points. Each bullet must
   describe a VERIFIABLE condition (not a subjective one).
   BAD: "Handle errors gracefully"
   GOOD: "When a single worker throws, the Fleet tag catches the error and
   returns { success: false, error: '...' } for that worker without crashing
   other concurrent workers."

2. **Verification Criteria** — For each bullet in the end state, HOW to prove
   it's satisfied. This is a checklist an independent reviewer can run.
   Examples: "Run the Fleet integration test with 3 workers where 1 throws.
   Verify the output has 2 successes and 1 failure. Verify the other workers
   completed normally."

3. **What NOT to Touch** — Files, modules, or behaviors that are off limits.
   If empty, say "No restrictions" but prefer to list actual boundaries.

4. **Stop Conditions** — Max iterations, budget cap, no-progress detection rule.
   Example: "Stop after 3 iterations OR if no meaningful change in last pass."

5. **Anti-Spin Clauses** — What counts as spinning vs progress.
   Example: "Two consecutive iterations with the same test failures counts as
   no-progress. Changing a test to pass instead of fixing the code is a violation."

Vague ask to formalize:
"""
${VAGUE_ASK.trim()}
"""

Output ONLY the contract. No preamble, no commentary. Use markdown headings.
`

const contractText = contract.text.trim()
console.log(chalk.green('✓ Contract written\n'))
console.log(chalk.white(contractText))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// PHASE 2: Σ decomposes work against the contract
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.yellow('\n─── Phase 2: Σ — Decompose Work Against Contract ───\n'))
console.log(chalk.dim(' Subagents break the work into bounded sub-tasks, each referencing\n'))
console.log(chalk.dim(' the specific contract clauses it satisfies.\n'))

const decomposition = await Σ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxSubTasks: 3,
  quiet: true,
})`
Decompose this work into bounded, independently-checkable sub-tasks.

Contract (the definition of done):
${contractText}

For EACH sub-task:
1. Name the sub-task
2. State which contract clause(s) it fulfills (from the Exact End State section)
3. Define its verification criteria (from the Verification Criteria section)
4. Define its boundaries (from the What NOT to Touch section)

Do NOT propose more than 3 sub-tasks. Each must be independently verifiable.
`

const planText = decomposition.text.trim()
console.log(chalk.green('✓ Decomposition complete\n'))
console.log(chalk.white(planText))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// PHASE 3: Execute (we simulate with Π for each sub-task, capped)
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.yellow('\n─── Phase 3: Execute — Π Coding Agent Per Sub-Task ───\n'))

const MAX_EXECUTION_ITERATIONS = 2
let iterationCount = 0
let allPassed = false
let executionOutput = ''

while (!allPassed && iterationCount < MAX_EXECUTION_ITERATIONS) {
  iterationCount++
  console.log(chalk.cyan(`  Execution pass ${iterationCount}/${MAX_EXECUTION_ITERATIONS}...\n`))

  const execution = await Σ({
    plannerModel: PLANNER_MODEL,
    workerModel: WORKER_MODEL,
    maxSubTasks: 2,
    concurrency: 2,
    quiet: true,
  })`
    Execute against this plan, respecting the contract boundaries.

    Contract:
    ${contractText}

    Plan:
    ${planText}

    Previous attempt context (empty on first pass):
    ${executionOutput || 'No previous attempt — this is the first pass.'}

    For each sub-task, produce a concrete, implementable plan. Reference the
    specific files from the pizx project that would need changes:
    - src/patterns/fleet.ts — the Fleet pattern implementation
    - src/patterns/pipeline.ts — the Pipeline pattern (similar structure)
    - src/patterns/test/ — test files

    Focus on WHAT to change and HOW to verify it. Be specific about:
    - Error types to add/modify
    - Try/catch boundaries
    - Logging approach (which logger, what to log)
    - Test assertions to write
    `

  executionOutput = execution.text.trim()
  console.log(chalk.dim(executionOutput))
  console.log()

  // ═══════════════════════════════════════════════════════════════════════
  // PHASE 4: Ψ verifies output against the contract
  // ═══════════════════════════════════════════════════════════════════════
  console.log(chalk.bold.yellow(`  ─── Phase 4: Ψ — Verify Against Contract (Pass ${iterationCount}) ───\n`))

  const verification = await Ψ({
    plannerModel: PLANNER_MODEL,
    workerModel: WORKER_MODEL,
    rounds: 1,
    quiet: true,
  })`
    You are the independent VERIFIER. Your job is to check whether the execution
    output satisfies the contract. You are NOT the builder — you cannot approve
    your own work. Be adversarial: assume the output is incomplete until proven
    otherwise.

    Contract (what "done" means):
    ${contractText}

    Execution output (what was produced):
    ${executionOutput}

    For EACH bullet in the "Exact End State" section of the contract, state:
    - ✅ PASS — the output clearly addresses this and meets the verification criteria
    - ❌ FAIL — the output does not clearly address this or lacks specificity
    - ⚠️ PARTIAL — partially addressed but needs more detail

    Then give a VERDICT:
    - ALL_PASS → the output satisfies the contract. Done.
    - HAS_FAILURES → list what failed and why. Must iterate.
    - HAS_PARTIALS → list what's partial and what's missing. Must iterate.

    Format your verdict as one line: VERDICT: ALL_PASS | HAS_FAILURES | HAS_PARTIALS
    Then your detailed reasoning.
  `

  const verdictText = verification.text.trim()
  console.log(chalk.dim(verdictText))
  console.log()

  // Check verdict
  const verdictMatch = verdictText.match(/VERDICT:\s*(ALL_PASS|HAS_FAILURES|HAS_PARTIALS)/)
  const verdict = verdictMatch ? verdictMatch[1] : 'HAS_FAILURES'

  if (verdict === 'ALL_PASS') {
    allPassed = true
    console.log(chalk.green(`  ✅ Pass ${iterationCount}: Contract SATISFIED — all clauses verified.\n`))
  } else if (iterationCount < MAX_EXECUTION_ITERATIONS) {
    console.log(chalk.yellow(`  🔄 Pass ${iterationCount}: ${verdict} — will iterate with contract violations as context.\n`))
  } else {
    console.log(chalk.red(`  ⛔ Pass ${iterationCount}: ${verdict} — max iterations hit. Reporting what was achieved.\n`))
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n══════════════════════════════════════════════════'))
console.log(chalk.bold.blue('═══ Goal Contract — Final Report ═══'))
console.log(chalk.bold.blue('══════════════════════════════════════════════════\n'))

console.log(chalk.white(`Vague Ask: "${VAGUE_ASK.trim().slice(0, 80)}..."`))
console.log()
console.log(chalk.cyan('Contract:'))

// Highlight key contract sections
const endStateMatch = contractText.match(/Exact End State[\s\S]*?(?=\n##|$)/)
if (endStateMatch) {
  console.log(chalk.white(endStateMatch[0].trim()))
}
console.log()

console.log(chalk.cyan('Result:'))
if (allPassed) {
  console.log(chalk.green('  ✅ Contract satisfied — all verification criteria met'))
} else {
  console.log(chalk.yellow('  ⚠️  Max iterations reached — partial satisfaction'))
  console.log(chalk.dim('  (In production, raise max iterations or narrow the contract scope)'))
}
console.log()

console.log(chalk.cyan('What made this different from a raw agent call:'))
console.log(chalk.white(`
  The contract is written BEFORE execution. The verifier checks against the
  contract's OWN criteria, not the agent's opinion. The builder and verifier
  are separate agents — the builder cannot self-verify. Anti-spin clauses
  prevent the agent from editing the test instead of fixing the code.

  As Part 1 of the article put it (via @ahmetbilicanxyz):
  "A loop that can't actually tell good output from bad just automates
   being wrong, faster. Writing the loop is easy. The verifier inside it
   is the hard part."
`))

console.log(chalk.dim('✓ Goal Contract — composition complete\n'))
