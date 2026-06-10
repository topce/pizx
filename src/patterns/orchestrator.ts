/**
 * Ω (Omega) — Orchestrator: plan → dispatch → synthesize
 *
 * A high-level orchestrator pattern where a planner agent:
 *   1. Analyzes the request and creates a detailed plan with sub-tasks
 *   2. Dispatches sub-tasks to worker agents (parallel via Fleet)
 *   3. Synthesizes the worker results into a final coherent answer
 *
 * Usage:
 *   await Ω`build a complete authentication system for the project`
 *   await Ω({ workers: 5 })`refactor the entire codebase`
 *   await Ω.quiet`design and implement a CI/CD pipeline`
 *
 * This is the most sophisticated pattern — it combines planning,
 * parallel execution, and synthesis into a single tag.
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { ask, build, createPatternTag, type PatternOptions, PatternOutput, runQualityReview, type QualityReviewResult, mergeSystem, type PhaseEntry, confirmPhase } from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface OrchestratorOptions extends PatternOptions {
  /** Number of worker agents to dispatch. Default: 3 */
  workers?: number
  /** Maximum concurrency for worker execution. Default: 3 */
  concurrency?: number
  /** Run a quality review on the final synthesis. Default: false */
  qualityCheck?: boolean
}

const defaults: OrchestratorOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  workers: 3,
  concurrency: 3,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class OrchestratorWorkerResult {
  constructor(
    /** The worker's assigned task */
    public readonly task: string,
    /** The worker's output */
    public readonly output: string,
    /** Whether the worker succeeded */
    public readonly success: boolean
  ) {}
}

export class OrchestratorOutput extends PatternOutput {
  constructor(
    text: string,
    /** The original plan */
    public readonly plan: string,
    /** The synthesized final output */
    public readonly synthesis: string,
    /** Individual worker results */
    public readonly workerResults: OrchestratorWorkerResult[],
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const PLANNER_SYSTEM = `You are a senior architect and project planner. Given a high-level request, create a detailed execution plan.

Output in this exact format:

PLAN SUMMARY:
(one paragraph summarizing the approach)

SUB-TASKS:
1. (specific, actionable sub-task)
2. (specific, actionable sub-task)
3. (specific, actionable sub-task)

Each sub-task must be self-contained and independently executable.
Generate exactly {$workerCount} sub-tasks (adjust to the requested worker count).
Focus on concrete actions, not abstractions.`

const WORKER_SYSTEM = `You are a task specialist. Complete your assigned sub-task thoroughly and concisely. Output your findings, code, or analysis directly — no meta-commentary.`

const SYNTHESIS_SYSTEM = `You are a delivery manager. Synthesize the worker results into a final, coherent deliverable that fulfills the original request. Combine, reconcile, and structure the outputs. Address any gaps or conflicts.`

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: OrchestratorOptions
): Promise<OrchestratorOutput> {
  const request = build(pieces, args)
  const t0 = Date.now()
  const workerCount = opts.workers ?? 3
  const phases: PhaseEntry[] = []

  // Planner model for plan/synthesize, worker model for worker execution
  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(
      `Ω: Orchestrator — "${request.slice(0, 80)}${request.length > 80 ? '...' : ''}"\n`
    )
  }

  // 1. Plan (planner model — high-level orchestration)
  if (!opts.quiet) process.stderr.write('  → Planning...\n')
  const planStart = Date.now()
  const planText = await ask(request, {
    ...opts,
    model: plannerModel,
    thinkingLevel: 'high' as ThinkingLevel,
    system: mergeSystem(opts.system, PLANNER_SYSTEM.replace('{$workerCount}', String(workerCount))),
  })
  phases.push({ phase: 'plan', durationMs: Date.now() - planStart, description: `Generated plan with ${workerCount} workers`, modelUsed: plannerModel })

  // Extract sub-tasks from the plan
  const subTasks: string[] = []
  const taskLines = planText.split('\n')
  let inTasks = false
  for (const line of taskLines) {
    if (line.match(/^SUB-TASKS:/i)) {
      inTasks = true
      continue
    }
    if (inTasks && line.match(/^\d+[.)]\s/)) {
      subTasks.push(line.replace(/^\d+[.)]\s+/, '').trim())
    }
  }

  // If parsing failed, fall back to asking for just the tasks
  const tasks = subTasks.length > 0 ? subTasks.slice(0, workerCount) : [request]

  if (!opts.quiet) {
    process.stderr.write(`  → ${tasks.length} sub-task(s) identified\n`)
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      process.stderr.write(`      [${i + 1}] ${t.slice(0, 60)}${t.length > 60 ? '...' : ''}\n`)
    }
  }

  // Confirm before dispatch (optional)
  const planSummary = tasks.length > 0
    ? `Execute ${tasks.length} sub-task(s) as planned?\n    ${tasks.map((t, i) => `${i + 1}. ${t.slice(0, 80)}`).join('\n    ')}`
    : `Execute the plan?`
  if (!await confirmPhase(planSummary, opts)) {
    throw new Error('pizx/Ω: Execution cancelled by user.')
  }

  // 2. Dispatch (parallel execution with concurrency limit)
  const workerResults: OrchestratorWorkerResult[] = []
  const concurrency = opts.concurrency ?? 3
  const dispatchStart = Date.now()

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((task) =>
        ask(task, { ...opts, model: workerModel, system: mergeSystem(opts.system, WORKER_SYSTEM) })
          .then((text) => new OrchestratorWorkerResult(task, text, true))
          .catch((err) => new OrchestratorWorkerResult(task, String(err), false))
      )
    )
    batchResults.forEach((r) => {
      if (r.status === 'fulfilled') workerResults.push(r.value)
    })
  }
  const succeeded = workerResults.filter((w) => w.success).length
  phases.push({ phase: 'dispatch', durationMs: Date.now() - dispatchStart, description: `Executed ${workerResults.length} worker(s), ${succeeded} succeeded`, modelUsed: workerModel, callCount: workerResults.length })

  // 3. Synthesize (planner model — high-level synthesis)
  if (!opts.quiet) process.stderr.write('  → Synthesizing results...\n')

  const workerTexts = workerResults
    .map((wr, i) => `Task ${i + 1}: ${wr.task}\nResult: ${wr.output}`)
    .join('\n\n')

  const synthStart = Date.now()
  const synthesis = await ask(
    `Original request:\n${request}\n\nPlan:\n${planText}\n\nWorker results:\n${workerTexts}\n\nSynthesize a final deliverable.`,
    {
      ...opts,
      model: plannerModel,
      thinkingLevel: 'high' as ThinkingLevel,
      system: mergeSystem(opts.system, SYNTHESIS_SYSTEM),
    }
  )
  phases.push({ phase: 'synthesize', durationMs: Date.now() - synthStart, description: 'Synthesized worker results into final deliverable', modelUsed: plannerModel })

  // 4. Quality review (optional)
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityStart = Date.now()
  const qualityReview = await runQualityReview(request, synthesis, opts)
  if (qualityReview) {
    phases.push({ phase: 'quality-review', durationMs: Date.now() - qualityStart, description: `Score: ${qualityReview.score.toFixed(2)} — ${qualityReview.assessment.slice(0, 60)}`, modelUsed: plannerModel })
  }

  const t1 = Date.now()

  const reviewSection = qualityReview
    ? `\n\nQuality Review: ${qualityReview.score.toFixed(2)} — ${qualityReview.assessment}\n  Recommendation: ${qualityReview.recommendation}`
    : ''

  const summary = `Plan:\n${planText}\n\nWorkers: ${workerResults.filter((w) => w.success).length}/${workerResults.length} succeeded\n\nSynthesis:\n${synthesis}${reviewSection}`

  const output = new OrchestratorOutput(summary, planText, synthesis, workerResults, t0, t1, qualityReview)
  output.phaseLog = phases
  return output
}

/** Ω tag — Orchestrator: plan → dispatch → synthesize */
export const Ω = createPatternTag(defaults, execute)
