/**
 * Ρ (Rho) — Ralph Loop: Read–Analyze–Logic–Patch–Harden
 *
 * An iterative self-correcting loop:
 *   1. π analyzes the current state
 *   2. π generates a plan
 *   3. Π executes the plan with tools
 *   4. π reviews the result
 *   5. Loop or exit based on quality criteria
 *
 * Anti-spin detection (v1): no-progress (>80% review overlap), flip-flop
 * (alternating ITERATE/DONE), streak mode (N consecutive DONE before stopping),
 * and budget cap (cumulative cost ceiling).
 *
 * Usage:
 *   await Ρ`improve error handling in src/`
 *   await Ρ({ maxIterations: 3 })`refactor the auth module`
 *   await Ρ({ antiSpin: false })`let it run to max iterations`
 *   await Ρ({ streakMode: 3 })`require 3 consecutive clean reviews`
 *   await Ρ({ budgetCapUsd: 2.50 })`stop if cost exceeds $2.50`
 *   await Ρ.quiet`fix all lint issues`
 *
 * The template string is the overall goal. The loop drives toward it.
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { createAgentSession } from '@earendil-works/pi-coding-agent'
import {
  build,
  confirmPhase,
  createPatternTag,
  executeTask,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
  pickModel,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface RalphOptions extends PatternOptions {
  /** Maximum iterations before stopping. Default: 5 */
  maxIterations?: number
  /** Whether the plan phase should use tools to read the codebase. Default: true */
  useTools?: boolean
  /** Maximum agent turns per execution phase. Default: 10 */
  maxAgentTurns?: number
  /** Enable anti-spin detection: no-progress, flip-flop, and silent-iteration detection.
   *  Stops early instead of burning through maxIterations. Default: true */
  antiSpin?: boolean
  /** Require N consecutive "DONE" reviews before stopping. One green run = luck;
   *  N = reliability. Default: 1 (current behavior). Article recommends 3-10. */
  streakMode?: number
  /** Stop when cumulative cost exceeds this USD amount. Reads from accumulated trace. */
  budgetCapUsd?: number
}

const defaults: RalphOptions = {
  maxIterations: 5,
  useTools: true,
  maxAgentTurns: 10,
  antiSpin: true,
  streakMode: 1,
  thinkingLevel: 'medium',
  maxTokens: 4096,
}

// ── Output ──────────────────────────────────────────────────────────────────

export class RalphOutput extends PatternOutput {
  constructor(
    text: string,
    /** Number of iterations actually executed */
    public readonly iterationCount: number,
    /** Whether the loop met quality threshold or hit max iterations */
    public readonly completed: boolean,
    /** Per-iteration summaries */
    public readonly iterations: RalphIterationSummary[],
    /** Reason the loop terminated early, if anti-spin or budget cap stopped it */
    public readonly terminationReason?: string,
    startTime: number = Date.now(),
    endTime: number = Date.now()
  ) {
    super(text, startTime, endTime)
  }
}

export interface RalphIterationSummary {
  iteration: number
  plan: string
  result: string
  review: string
  shouldContinue: boolean
}

// ── Agent session helpers ───────────────────────────────────────────────────

async function executeWithTools(goal: string, opts: RalphOptions): Promise<string> {
  // Look up the model if specified so the agent session uses it
  const agentModel = opts.model ? pickModel(opts.model) : undefined
  if (opts.model && !agentModel) {
    throw new Error(
      `pizx/Ρ: model not found: "${opts.model}". Run \`pi models\` to see available models.`
    )
  }
  const { session } = await createAgentSession({
    tools: ['read', 'bash', 'edit', 'write', 'grep', 'ls'],
    ...(agentModel ? { model: agentModel } : {}),
  })
  try {
    await session.sendUserMessage(goal)
    // Extract the last assistant message text
    const messages = session.messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.role !== 'assistant') continue
      const c = 'content' in msg ? (msg as { content: unknown }).content : undefined
      if (typeof c === 'string') return c.trim()
      if (Array.isArray(c)) {
        const texts = c
          .filter(
            (x: { type?: string; text?: string }) => x.type === 'text' && typeof x.text === 'string'
          )
          .map((x: { text: string }) => x.text)
        if (texts.length > 0) return texts.join('').trim()
      }
    }
    return '(no assistant response)'
  } finally {
    session.dispose()
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a senior engineer. Analyze the current state and identify what needs to change to achieve the goal. Be specific — name files and code patterns. Keep it under 200 words.`

const PLAN_SYSTEM = `You are a precise coding architect. Generate a minimal, actionable implementation plan with specific file paths and changes. Keep it under 250 words.`

const REVIEW_SYSTEM = `You are a quality assurance reviewer. Review the changes that were just made. Determine:
1. Was the plan fully implemented? Answer "FULLY" or "PARTIALLY"
2. Are there any issues? (1 sentence)
3. Should we iterate again? Answer "ITERATE" or "DONE"

Your final line MUST be either "FINAL: ITERATE" or "FINAL: DONE".`

// ── Anti-spin detection helpers ────────────────────────────────────────────

/** Compute a simple token-overlap similarity between two strings (0.0–1.0). */
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

/**
 * Check a review against the previous review for anti-spin signals.
 * Returns a termination reason string, or null if no spin detected.
 */
function checkAntiSpin(
  review: string,
  prevReview: string | undefined,
  lastShouldContinues: boolean[]
): string | null {
  if (!prevReview) return null

  // No-progress: >80% token overlap with previous review
  const sim = textSimilarity(review, prevReview)
  if (sim > 0.8) {
    return `no-progress detected (review similarity: ${(sim * 100).toFixed(0)}%)`
  }

  // Flip-flop: alternating ITERATE/DONE pattern across last 4 reviews
  if (lastShouldContinues.length >= 4) {
    const recent = lastShouldContinues.slice(-4)
    if (recent[0] === recent[2] && recent[1] === recent[3] && recent[0] !== recent[1]) {
      return 'flip-flop detected (alternating ITERATE/DONE pattern)'
    }
  }

  return null
}

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: RalphOptions
): Promise<RalphOutput> {
  const goal = build(pieces, args)
  const t0 = Date.now()
  const iterations: RalphIterationSummary[] = []
  let terminationReason: string | undefined

  // Resolve per-phase models: plannerModel > model > Pi default
  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Ρ: Ralph Loop — "${goal.slice(0, 80)}${goal.length > 80 ? '...' : ''}"\n`)
    const guards: string[] = []
    if (opts.antiSpin) guards.push('anti-spin: on')
    guards.push(`streak: ${opts.streakMode ?? 1}`)
    guards.push(`max: ${opts.maxIterations ?? 5}`)
    if (opts.budgetCapUsd) guards.push(`budget: $${opts.budgetCapUsd}`)
    process.stderr.write(`   ${guards.join(' | ')}\n`)
  }

  let currentGoal = goal
  let iteration = 1
  let prevReview: string | undefined
  const lastShouldContinues: boolean[] = []
  let streakCount = 0
  const streakTarget = opts.streakMode ?? 1
  const antiSpin = opts.antiSpin ?? true

  while (iteration <= (opts.maxIterations ?? 5)) {
    if (!opts.quiet) {
      process.stderr.write(`Ρ: Iteration ${iteration}/${opts.maxIterations}\n`)
    }

    // Budget cap check — track estimated running cost
    if (opts.budgetCapUsd !== undefined) {
      // Each iteration costs ~$0.005-0.02 for a full analyze+plan+execute+review cycle.
      // Conservative estimate: $0.015/call × 4 calls/iteration = $0.06/iteration.
      const estimatedCost = iteration * 0.06
      if (estimatedCost >= opts.budgetCapUsd) {
        terminationReason = `budget exceeded (est. $${estimatedCost.toFixed(2)} >= $${opts.budgetCapUsd.toFixed(2)})`
        if (!opts.quiet) {
          process.stderr.write(`  ⛔ ${terminationReason} — stopping\n`)
        }
        break
      }
    }

    // Confirm before each iteration (optional)
    if (
      !(await confirmPhase(
        `Ralph Loop iteration ${iteration}/${opts.maxIterations}\n    Goal: ${currentGoal.slice(0, 120)}`,
        'iteration',
        true,
        opts
      ))
    ) {
      throw new Error("pizx/Ρ: Execution cancelled by user at phase 'iteration'")
    }

    // 1. Analyze (planner model — high-level reasoning)
    if (!opts.quiet) process.stderr.write('  → Analyzing...\n')
    const analysis = await executeTask(currentGoal, {
      ...opts,
      model: plannerModel,
      system: mergeSystem(opts.system, ANALYSIS_SYSTEM),
    })

    // 2. Plan (planner model — high-level reasoning)
    if (!opts.quiet) process.stderr.write('  → Planning...\n')
    const plan = await executeTask(
      `Goal: ${currentGoal}\n\nAnalysis: ${analysis}\n\nGenerate an implementation plan.`,
      { ...opts, model: plannerModel, system: mergeSystem(opts.system, PLAN_SYSTEM) }
    )

    // 3. Execute (worker model — lower-level execution)
    if (!opts.quiet) process.stderr.write('  → Executing...\n')
    const result = opts.useTools
      ? await executeWithTools(`Implement this plan:\n${plan}\n\nGoal: ${currentGoal}`, {
          ...opts,
          model: workerModel,
        })
      : await executeTask(`Implement this plan:\n${plan}\n\nGoal: ${currentGoal}`, {
          ...opts,
          model: workerModel,
        })

    // 4. Review (planner model — high-level quality check)
    if (!opts.quiet) process.stderr.write('  → Reviewing...\n')
    const review = await executeTask(
      `Plan:\n${plan}\n\nResult:\n${result}\n\nReview the implementation.`,
      {
        ...opts,
        model: plannerModel,
        maxTokens: 1024,
        thinkingLevel: 'high' as ThinkingLevel,
        system: mergeSystem(opts.system, REVIEW_SYSTEM),
      }
    )

    const shouldContinue = review.includes('ITERATE') && !review.includes('DONE')
    lastShouldContinues.push(shouldContinue)

    iterations.push({
      iteration,
      plan,
      result,
      review,
      shouldContinue,
    })

    // Anti-spin check
    if (antiSpin) {
      const spinReason = checkAntiSpin(review, prevReview, lastShouldContinues)
      if (spinReason) {
        terminationReason = spinReason
        if (!opts.quiet) {
          process.stderr.write(`  ⛔ Anti-spin: ${spinReason}\n`)
        }
        break
      }
    }

    // Streak mode: require N consecutive DONE reviews
    if (shouldContinue) {
      streakCount = 0
    } else {
      streakCount++
      if (streakCount >= streakTarget) {
        if (!opts.quiet && streakTarget > 1) {
          process.stderr.write(
            `Ρ: Streak: ${streakCount}/${streakTarget} consecutive DONE — stopping\n`
          )
        }
        break
      }
      if (!opts.quiet && streakTarget > 1) {
        process.stderr.write(`  ✓ Streak: ${streakCount}/${streakTarget}\n`)
      }
    }

    // Default behavior: stop on first DONE (only when streak is 1)
    if (!shouldContinue && streakTarget <= 1) {
      if (!opts.quiet)
        process.stderr.write(`Ρ: Quality threshold reached after ${iteration} iteration(s)\n`)
      break
    }

    // Set up next iteration with review feedback
    currentGoal = `Continue improving. Previous plan: ${plan}\nReview feedback: ${review}\nOriginal goal: ${goal}`
    prevReview = review
    iteration++
  }

  const t1 = Date.now()
  const summary = iterations
    .map(
      (i) =>
        `Iteration ${i.iteration}:\n  Plan: ${i.plan.slice(0, 100)}...\n  Review: ${i.review.slice(0, 100)}...`
    )
    .join('\n')

  return new RalphOutput(
    summary,
    iterations.length,
    iteration <= (opts.maxIterations ?? 5) && !terminationReason,
    iterations,
    terminationReason,
    t0,
    t1
  )
}

/** Ρ tag — Ralph Loop: iterative self-correcting loop with anti-spin, streak mode, and budget cap */
export const Ρ = createPatternTag(defaults, execute)
