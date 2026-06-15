/**
 * Σ (Sigma) — Subagents: hierarchical task delegation
 *
 * A main orchestrator agent decomposes a complex task into sub-tasks,
 * delegates each to a sub-agent, then synthesizes the results.
 *
 * Usage:
 *   await Σ`analyze the full codebase for security vulnerabilities`
 *   // Auto-decomposes into sub-domains (auth, data, network, etc.)
 *
 *   await Σ({ subdomains: ['auth', 'database', 'frontend'] })`review each area`
 *   // Explicit sub-domains
 *
 *   await Σ.quiet`generate API documentation for all endpoints`
 *
 * Flow:
 *   1. Planner decomposes the main task into sub-tasks
 *   2. Each sub-task runs in parallel (like Fleet)
 *   3. Synthesizer combines sub-results into final answer
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import {
  ask,
  build,
  confirmPhase,
  createPatternTag,
  executeTask,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
  type PhaseEntry,
  type QualityReviewResult,
  runQualityReview,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface SubagentOptions extends PatternOptions {
  /** Explicit sub-domains or sub-tasks to delegate. When empty, auto-decomposes. */
  subdomains?: string[]
  /** Maximum number of auto-generated sub-tasks. Default: 4 */
  maxSubTasks?: number
  /** Maximum concurrency for sub-agent execution. Default: 4 */
  concurrency?: number
  /** Run a quality review on the final synthesis. Default: false */
  qualityCheck?: boolean
}

const defaults: SubagentOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  maxSubTasks: 4,
  concurrency: 4,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class SubagentResult {
  constructor(
    /** The sub-task description */
    public readonly subTask: string,
    /** The sub-agent's response */
    public readonly text: string,
    /** Whether this sub-task succeeded */
    public readonly success: boolean
  ) {}
}

export class SubagentOutput extends PatternOutput {
  constructor(
    text: string,
    /** The synthesized final answer */
    public readonly synthesis: string,
    /** Individual sub-agent results */
    public readonly subResults: SubagentResult[],
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const DECOMPOSE_SYSTEM = `You are a task decomposition specialist. Break down complex tasks into independent sub-tasks that can be worked on in parallel. Output ONLY a JSON array of strings, each being a self-contained sub-task description. No markdown, no explanation.`

const SYNTHESIS_SYSTEM = `You are a synthesis specialist. Combine the results from multiple sub-agent analyses into a coherent, comprehensive answer. Identify patterns, conflicts, and gaps.`

async function decomposeTask(task: string, opts: SubagentOptions): Promise<string[]> {
  if (opts.subdomains && opts.subdomains.length > 0) return opts.subdomains

  const result = await executeTask(
    `Decompose this task into ${opts.maxSubTasks ?? 4} independent sub-tasks that can be worked on in parallel:\n\n${task}\n\nOutput a JSON array of strings.`,
    {
      ...opts,
      model: opts.model,
      maxTokens: 1024,
      thinkingLevel: 'medium' as ThinkingLevel,
      system: mergeSystem(opts.system, DECOMPOSE_SYSTEM),
    }
  )

  try {
    // Extract JSON array from the result
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String).slice(0, opts.maxSubTasks ?? 4)
      }
    }
  } catch {
    // Fall back to line-based parsing
  }

  // Fallback: split by lines
  return result
    .split('\n')
    .map((l) =>
      l
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^[-*]\s*/, '')
        .trim()
    )
    .filter(Boolean)
    .slice(0, opts.maxSubTasks ?? 4)
}

const SUBAGENT_SYSTEM = `You are a domain specialist. Complete your assigned sub-task thoroughly. Output your findings clearly and concisely.`

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: SubagentOptions
): Promise<SubagentOutput> {
  const task = build(pieces, args)
  const t0 = Date.now()
  const phases: PhaseEntry[] = []

  // Planner model for decompose/synthesize, worker model for sub-agents
  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(
      `Σ: Subagent delegation — "${task.slice(0, 80)}${task.length > 80 ? '...' : ''}"\n`
    )
  }

  // 1. Decompose (planner model — high-level planning)
  if (!opts.quiet) process.stderr.write('  → Decomposing task into sub-tasks...\n')
  const decomposeStart = Date.now()
  const subTasks = await decomposeTask(task, { ...opts, model: plannerModel })
  phases.push({
    phase: 'decompose',
    durationMs: Date.now() - decomposeStart,
    description: `Decomposed into ${subTasks.length} sub-task(s)`,
    modelUsed: plannerModel,
  })

  if (!opts.quiet) {
    process.stderr.write(`  → ${subTasks.length} sub-task(s) identified:\n`)
    for (let i = 0; i < subTasks.length; i++) {
      const st = subTasks[i]
      process.stderr.write(`      [${i + 1}] ${st.slice(0, 60)}${st.length > 60 ? '...' : ''}\n`)
    }
  }

  // Confirm before execution (optional)
  const subTaskSummary = `Execute ${subTasks.length} sub-task(s)?\n    ${subTasks.map((st, i) => `${i + 1}. ${st.slice(0, 80)}`).join('\n    ')}`
  if (!(await confirmPhase(subTaskSummary, 'execute', true, opts))) {
    throw new Error("pizx/Σ: Execution cancelled by user at phase 'execute'")
  }

  // 2. Execute sub-tasks in parallel (with concurrency limit)
  const subResults: SubagentResult[] = []
  const concurrency = opts.concurrency ?? 4
  const execStart = Date.now()

  for (let i = 0; i < subTasks.length; i += concurrency) {
    const batch = subTasks.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((st) =>
        ask(st, { ...opts, model: workerModel, system: mergeSystem(opts.system, SUBAGENT_SYSTEM) })
          .then((text) => new SubagentResult(st, text, true))
          .catch((err) => new SubagentResult(st, String(err), false))
      )
    )
    batchResults.forEach((r) => {
      if (r.status === 'fulfilled') subResults.push(r.value)
    })
  }
  const succeeded = subResults.filter((r) => r.success).length
  phases.push({
    phase: 'execute',
    durationMs: Date.now() - execStart,
    description: `Executed ${subResults.length} sub-task(s), ${succeeded} succeeded`,
    modelUsed: workerModel,
    callCount: subResults.length,
  })

  // 3. Synthesize (planner model — high-level synthesis)
  if (!opts.quiet) process.stderr.write('  → Synthesizing results...\n')
  const subResultsText = subResults
    .map((sr, i) => `Sub-task ${i + 1}: ${sr.subTask}\nResult: ${sr.text}`)
    .join('\n\n')
  const synthStart = Date.now()
  const synthesis = await executeTask(
    `Original task:\n${task}\n\nSub-task results:\n${subResultsText}\n\nSynthesize a comprehensive answer.`,
    { ...opts, model: plannerModel, system: mergeSystem(opts.system, SYNTHESIS_SYSTEM) }
  )
  phases.push({
    phase: 'synthesize',
    durationMs: Date.now() - synthStart,
    description: 'Synthesized sub-agent results',
    modelUsed: plannerModel,
  })

  // 4. Quality review (optional)
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qStart = Date.now()
  const qualityReview = await runQualityReview(task, synthesis, opts)
  if (qualityReview) {
    phases.push({
      phase: 'quality-review',
      durationMs: Date.now() - qStart,
      description: `Score: ${qualityReview.score.toFixed(2)}`,
      modelUsed: plannerModel,
    })
  }

  const t1 = Date.now()

  const output = new SubagentOutput(synthesis, synthesis, subResults, t0, t1, qualityReview)
  output.phaseLog = phases
  return output
}

/** Σ tag — Subagents: hierarchical task delegation */
export const Σ = createPatternTag(defaults, execute)
