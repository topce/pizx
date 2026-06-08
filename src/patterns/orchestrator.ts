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
import {
  ask,
  build,
  type PatternFn,
  type PatternOptions,
  PatternOutput,
  PatternPromise,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface OrchestratorOptions extends PatternOptions {
  /** Number of worker agents to dispatch. Default: 3 */
  workers?: number
  /** Maximum concurrency for worker execution. Default: 3 */
  concurrency?: number
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
    endTime: number
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
  const planText = await ask(request, {
    model: plannerModel,
    maxTokens: opts.maxTokens,
    thinkingLevel: 'high' as ThinkingLevel,
    system: PLANNER_SYSTEM.replace('{$workerCount}', String(workerCount)),
  })

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
    tasks.forEach((t, i) =>
      process.stderr.write(`      [${i + 1}] ${t.slice(0, 60)}${t.length > 60 ? '...' : ''}\n`)
    )
  }

  // 2. Dispatch (parallel execution with concurrency limit)
  const workerResults: OrchestratorWorkerResult[] = []
  const concurrency = opts.concurrency ?? 3

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((task) =>
        ask(task, {
          model: workerModel,
          maxTokens: opts.maxTokens,
          thinkingLevel: opts.thinkingLevel,
          system: WORKER_SYSTEM,
        })
          .then((text) => new OrchestratorWorkerResult(task, text, true))
          .catch((err) => new OrchestratorWorkerResult(task, String(err), false))
      )
    )
    batchResults.forEach((r) => {
      if (r.status === 'fulfilled') workerResults.push(r.value)
    })
  }

  // 3. Synthesize (planner model — high-level synthesis)
  if (!opts.quiet) process.stderr.write('  → Synthesizing results...\n')

  const workerTexts = workerResults
    .map((wr, i) => `Task ${i + 1}: ${wr.task}\nResult: ${wr.output}`)
    .join('\n\n')

  const synthesis = await ask(
    `Original request:\n${request}\n\nPlan:\n${planText}\n\nWorker results:\n${workerTexts}\n\nSynthesize a final deliverable.`,
    {
      model: plannerModel,
      maxTokens: opts.maxTokens,
      thinkingLevel: 'high' as ThinkingLevel,
      system: SYNTHESIS_SYSTEM,
    }
  )

  const t1 = Date.now()

  const summary = `Plan:\n${planText}\n\nWorkers: ${workerResults.filter((w) => w.success).length}/${workerResults.length} succeeded\n\nSynthesis:\n${synthesis}`

  return new OrchestratorOutput(summary, planText, synthesis, workerResults, t0, t1)
}

// ── Tag factory ─────────────────────────────────────────────────────────────

interface OrchestratorFn {
  (pieces: TemplateStringsArray, ...args: unknown[]): PatternPromise<OrchestratorOutput>
  (opts: Partial<OrchestratorOptions>): OrchestratorFn
  quiet: OrchestratorFn
}

function makeOrchestrator(opts: Partial<OrchestratorOptions> = {}): OrchestratorFn {
  const merged = { ...defaults, ...opts }

  const fn = ((
    pieces: TemplateStringsArray | Partial<OrchestratorOptions>,
    ...args: unknown[]
  ): PatternPromise<OrchestratorOutput> | OrchestratorFn => {
    if (!Array.isArray(pieces)) {
      return makeOrchestrator({ ...merged, ...(pieces as Partial<OrchestratorOptions>) })
    }
    return new PatternPromise((resolve, reject) => {
      execute(pieces as TemplateStringsArray, args, merged).then(resolve, reject)
    })
  }) as unknown as OrchestratorFn

  let _quiet: OrchestratorFn | undefined
  Object.defineProperty(fn, 'quiet', {
    get(): OrchestratorFn {
      if (!_quiet) _quiet = makeOrchestrator({ ...merged, quiet: true })
      return _quiet
    },
    enumerable: true,
    configurable: true,
  })

  return fn
}

/** Ω tag — Orchestrator: plan → dispatch → synthesize */
export const Ω: OrchestratorFn = makeOrchestrator()
