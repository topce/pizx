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
 * Usage:
 *   await Ρ`improve error handling in src/`
 *   await Ρ({ maxIterations: 3 })`refactor the auth module`
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
}

const defaults: RalphOptions = {
  maxIterations: 5,
  useTools: true,
  maxAgentTurns: 10,
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
    startTime: number,
    endTime: number
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

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: RalphOptions
): Promise<RalphOutput> {
  const goal = build(pieces, args)
  const t0 = Date.now()
  const iterations: RalphIterationSummary[] = []

  // Resolve per-phase models: plannerModel > model > Pi default
  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Ρ: Ralph Loop — "${goal.slice(0, 80)}${goal.length > 80 ? '...' : ''}"\n`)
  }

  let currentGoal = goal
  let iteration = 1

  while (iteration <= (opts.maxIterations ?? 5)) {
    if (!opts.quiet) {
      process.stderr.write(`Ρ: Iteration ${iteration}/${opts.maxIterations}\n`)
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

    iterations.push({
      iteration,
      plan,
      result,
      review,
      shouldContinue,
    })

    if (!shouldContinue) {
      if (!opts.quiet)
        process.stderr.write(`Ρ: Quality threshold reached after ${iteration} iteration(s)\n`)
      break
    }

    // Set up next iteration with review feedback
    currentGoal = `Continue improving. Previous plan: ${plan}\nReview feedback: ${review}\nOriginal goal: ${goal}`
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
    iteration <= (opts.maxIterations ?? 5),
    iterations,
    t0,
    t1
  )
}

/** Ρ tag — Ralph Loop: iterative self-correcting loop */
export const Ρ = createPatternTag(defaults, execute)
