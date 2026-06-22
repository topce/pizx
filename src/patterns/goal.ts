/**
 * goal — Goal tag: contract-first execution with separate verifier model.
 *
 * Aliased as γ (lowercase gamma) — distinct from Γ (uppercase gamma = Graph).
 * Use `goal` or `γ` interchangeably.
 *
 * Inspired by "WTF Is a Loop?" Parts 1 & 2 (Matt Van Horn, June 2026).
 *
 * Flow:
 *   1. π writes a formal contract: end state, verification criteria, boundaries, stop conditions
 *   2. Π (worker model) executes against the contract
 *   3. π (verifier model — separate from worker) checks outcome against contract
 *   4. Contract violations feed back → execute again (capped)
 *   5. Report: passed, failed, or exceeded budget
 *
 * Unlike Ralph (Ρ) which uses the same model to grade its own homework,
 * Goal uses a separate verifier model by default. The contract is written
 * BEFORE any work starts, so "done" is defined independently from execution.
 *
 * Usage:
 *   import { goal } from '@topce/pizx'
 *
 *   await goal`add error handling to the Fleet pattern`
 *   await goal({
 *     verifierModel: 'deepseek/deepseek-v4-pro',
 *     workerModel: 'deepseek/deepseek-v4-flash',
 *     maxIterations: 5,
 *     budgetCapUsd: 5.00,
 *     antiSpin: true,
 *     streakMode: 3,
 *   })`implement the feature with full test coverage`
 *   await goal.quiet`refactor the auth module`
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import {
  build,
  confirmPhase,
  createPatternTag,
  executeTask,
  getCurrentCost,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface GoalOptions extends PatternOptions {
  /** Maximum iterations before stopping. Default: 5 */
  maxIterations?: number
  /** Model used for contract writing and verification (planner role).
   *  Falls back to plannerModel → model. Different from worker model by design. */
  verifierModel?: string
  /** Stop when cumulative cost exceeds this USD amount. */
  budgetCapUsd?: number
  /** Enable anti-spin detection: no-progress and flip-flop detection. Default: true */
  antiSpin?: boolean
  /** Require N consecutive passing verifications before stopping. Default: 1 */
  streakMode?: number
}

const defaults: GoalOptions = {
  maxIterations: 5,
  antiSpin: true,
  streakMode: 1,
  thinkingLevel: 'medium',
  maxTokens: 4096,
}

// ── Output ──────────────────────────────────────────────────────────────────

export class GoalOutput extends PatternOutput {
  constructor(
    text: string,
    /** Number of iterations executed */
    public readonly iterationCount: number,
    /** Whether the contract was fully satisfied */
    public readonly passed: boolean,
    /** Per-iteration summaries */
    public readonly iterations: GoalIterationSummary[],
    /** The formal contract text */
    public readonly contract: string,
    /** Reason terminated early (anti-spin, budget, etc.), or undefined */
    public readonly terminationReason?: string,
    startTime: number = Date.now(),
    endTime: number = Date.now()
  ) {
    super(text, startTime, endTime)
  }
}

export interface GoalIterationSummary {
  iteration: number
  result: string
  verification: string
  verdict: 'ALL_PASS' | 'HAS_FAILURES' | 'HAS_PARTIALS'
}

// ── System prompts ─────────────────────────────────────────────────────────

const CONTRACT_SYSTEM = `You are a precise specification writer. Your job is to turn a vague request into a rigorous, falsifiable contract that makes it impossible to claim "done" when you're not.

Output ONLY the contract in this exact format:

## Exact End State
- [Specific, verifiable condition — NOT subjective. "No errors" is bad. "All 12 existing tests pass, the Fleet tag returns { success: false, error: '...' } for failed workers, and other concurrent workers complete normally" is good.]

## Verification Criteria
- [For each end-state bullet, HOW to prove it's satisfied. An independent reviewer should be able to run this checklist.]

## What NOT to Touch
- [Files, modules, or behaviors that are off limits. If none, say "No restrictions beyond the scope of the task."]

## Stop Conditions
- Max iterations: 3
- Budget: optional
- No-progress: if two consecutive iterations produce identical verification results, stop.
- Flip-flop: if the pattern alternates between ITERATE/DONE across 4 reviews, stop.`

const VERIFY_SYSTEM = `You are an independent VERIFIER. You are NOT the builder — you cannot approve your own work. Be adversarial: assume the output is incomplete until proven otherwise.

Contract (what "done" means):
{contract}

For EACH bullet in the "Exact End State" and "Verification Criteria" sections, state:
- ✅ PASS — the output clearly addresses this
- ❌ FAIL — the output does not or is unclear
- ⚠️ PARTIAL — partially addressed, needs more detail

Then give a VERDICT on the FINAL LINE as:
VERDICT: ALL_PASS | HAS_FAILURES | HAS_PARTIALS

If HAS_FAILURES or HAS_PARTIALS, list what failed and what the builder should change.`

// ── Anti-spin helpers ──────────────────────────────────────────────────────

function textSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  let overlap = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++
  }
  const union = tokensA.size + tokensB.size - overlap
  return union === 0 ? 0 : overlap / union
}

function checkAntiSpin(
  verification: string,
  prevVerification: string | undefined,
  lastVerdicts: string[]
): string | null {
  if (!prevVerification) return null

  const sim = textSimilarity(verification, prevVerification)
  if (sim > 0.8) {
    return `no-progress detected (verification similarity: ${(sim * 100).toFixed(0)}%)`
  }

  if (lastVerdicts.length >= 4) {
    const recent = lastVerdicts.slice(-4)
    if (recent[0] === recent[2] && recent[1] === recent[3] && recent[0] !== recent[1]) {
      return 'flip-flop detected (alternating PASS/FAIL pattern)'
    }
  }

  return null
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: GoalOptions
): Promise<GoalOutput> {
  const goal = build(pieces, args)
  const t0 = Date.now()
  const iterations: GoalIterationSummary[] = []
  let terminationReason: string | undefined

  // Resolve models
  const plannerModel = opts.plannerModel ?? opts.model
  const verifierModel = opts.verifierModel ?? plannerModel
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    const g = goal.slice(0, 80)
    process.stderr.write(`Goal — "${g}${goal.length > 80 ? '...' : ''}"\n`)
    const guards: string[] = []
    if (opts.antiSpin) guards.push('anti-spin: on')
    guards.push(`streak: ${opts.streakMode ?? 1}`)
    guards.push(`max: ${opts.maxIterations ?? 5}`)
    if (opts.budgetCapUsd) guards.push(`budget: $${opts.budgetCapUsd}`)
    process.stderr.write(`   ${guards.join(' | ')}\n`)
    if (verifierModel !== workerModel) {
      process.stderr.write(`   verifier: ${verifierModel} | worker: ${workerModel}\n`)
    }
  }

  // Phase 1: Write the contract (once, cached)
  if (!opts.quiet) process.stderr.write('  → Writing contract...\n')

  if (
    !(await confirmPhase(
      `Write a formal contract for: "${goal.slice(0, 120)}${goal.length > 120 ? '...' : ''}"`,
      'plan',
      true,
      opts
    ))
  ) {
    throw new Error("pizx/goal: Execution cancelled by user at phase 'plan'")
  }

  const contract = await executeTask(goal, {
    ...opts,
    model: verifierModel,
    thinkingLevel: 'high' as ThinkingLevel,
    system: mergeSystem(opts.system, CONTRACT_SYSTEM),
  })

  if (!opts.quiet) {
    process.stderr.write(`  ✓ Contract written (${contract.length} chars)\n`)
  }

  // Phase 2: Execute → Verify loop
  let iteration = 1
  const maxIterations = opts.maxIterations ?? 5
  let prevVerification: string | undefined
  const lastVerdicts: string[] = []
  let streakCount = 0
  const streakTarget = opts.streakMode ?? 1
  const antiSpin = opts.antiSpin ?? true
  let allPassed = false

  while (iteration <= maxIterations) {
    if (!opts.quiet) process.stderr.write(`Goal: Iteration ${iteration}/${maxIterations}\n`)

    // Budget cap check — stop if real accumulated cost exceeds cap
    if (opts.budgetCapUsd !== undefined) {
      const currentCost = getCurrentCost()
      if (currentCost >= opts.budgetCapUsd) {
        terminationReason = `budget exceeded ($${currentCost.toFixed(4)} >= $${opts.budgetCapUsd.toFixed(2)})`
        if (!opts.quiet) process.stderr.write(`  ⛔ ${terminationReason}\n`)
        break
      }
    }

    // Confirm before execution (optional)
    if (
      !(await confirmPhase(`Goal iteration ${iteration}/${maxIterations}`, 'dispatch', true, opts))
    ) {
      throw new Error("pizx/goal: Execution cancelled by user at phase 'dispatch'")
    }

    // Execute against the contract
    const context =
      iteration === 1
        ? 'This is the first execution. Execute the goal against the contract.'
        : `Previous verification found issues. Fix them:\n${prevVerification}`

    if (!opts.quiet) process.stderr.write('  → Executing...\n')
    const result = await executeTask(
      `Goal: ${goal}\n\nContract:\n${contract}\n\n${context}\n\nExecute the task and produce output that satisfies the contract.`,
      { ...opts, model: workerModel }
    )

    // Verify against the contract
    if (!opts.quiet) process.stderr.write('  → Verifying...\n')
    const verifyPrompt = VERIFY_SYSTEM.replace('{contract}', contract)
    const verification = await executeTask(
      `Execution output to verify:\n${result}\n\nVerify this against the contract above.`,
      {
        ...opts,
        model: verifierModel,
        maxTokens: 1024,
        thinkingLevel: 'high' as ThinkingLevel,
        system: verifyPrompt,
      }
    )

    // Parse verdict
    const verdictMatch = verification.match(/VERDICT:\s*(ALL_PASS|HAS_FAILURES|HAS_PARTIALS)/i)
    const verdict = verdictMatch
      ? (verdictMatch[1].toUpperCase() as GoalIterationSummary['verdict'])
      : 'HAS_FAILURES'
    lastVerdicts.push(verdict)

    iterations.push({
      iteration,
      result,
      verification,
      verdict,
    })

    if (!opts.quiet) {
      const icon = verdict === 'ALL_PASS' ? '✅' : verdict === 'HAS_PARTIALS' ? '⚠️' : '❌'
      process.stderr.write(`  ${icon} Verdict: ${verdict}\n`)
    }

    // Anti-spin check
    if (antiSpin) {
      const spinReason = checkAntiSpin(verification, prevVerification, lastVerdicts)
      if (spinReason) {
        terminationReason = spinReason
        if (!opts.quiet) process.stderr.write(`  ⛔ Anti-spin: ${spinReason}\n`)
        break
      }
    }

    // Streak mode
    if (verdict === 'ALL_PASS') {
      streakCount++
      if (streakCount >= streakTarget) {
        allPassed = true
        if (!opts.quiet && streakTarget > 1) {
          process.stderr.write(
            `✓ Streak: ${streakCount}/${streakTarget} consecutive ALL_PASS — done\n`
          )
        }
        break
      }
      if (!opts.quiet && streakTarget > 1) {
        process.stderr.write(`  ✓ Streak: ${streakCount}/${streakTarget}\n`)
      }
      // Default: stop on first ALL_PASS
      if (streakTarget <= 1) {
        allPassed = true
        break
      }
    } else {
      streakCount = 0
    }

    prevVerification = verification
    iteration++
  }

  // Final pass/fail
  if (!allPassed && !terminationReason) {
    // Check if last iteration passed
    const lastIter = iterations[iterations.length - 1]
    if (lastIter && lastIter.verdict === 'ALL_PASS') {
      allPassed = true
    }
  }

  const t1 = Date.now()
  const summary = iterations
    .map(
      (i) =>
        `Iteration ${i.iteration} (${i.verdict}):\n  Result: ${i.result.slice(0, 100)}...\n  Verification: ${i.verification.slice(0, 100)}...`
    )
    .join('\n\n')

  return new GoalOutput(
    summary,
    iterations.length,
    allPassed,
    iterations,
    contract,
    terminationReason,
    t0,
    t1
  )
}

/** goal tag — Contract-first execution with separate verifier model.
 *  Aliased as γ (lowercase gamma). */
export const goal = createPatternTag(defaults, execute)

/** γ (lowercase gamma) — alias for goal tag */
export const γ = goal
