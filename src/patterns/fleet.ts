/**
 * Φ (Phi) — Fleet: parallel agent execution
 *
 * Runs multiple tasks in parallel using Promise.allSettled.
 * Each task gets its own LLM call and results are collected.
 *
 * Usage:
 *   await Φ`review all .ts files in src/`
 *   // Auto-splits by lines or bullet points
 *
 *   await Φ({ tasks: ['lint src/', 'check types', 'run tests'] })`execute`
 *   // Explicit task list
 *
 *   await Φ.quiet`analyze all examples for best practices`
 *   // Silent mode
 *
 * The template can contain:
 *   - One task per line (each line is a separate agent call)
 *   - Bullet points (- or * each become a task)
 *   - A single paragraph (auto-split via AI)
 *
 * Each fleet member runs as a simple π-style text generation call.
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { ask, build, createPatternTag, type PatternOptions, PatternOutput, runQualityReview, type QualityReviewResult } from './types.ts'
import { getErrorMessage } from '../utils.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface FleetOptions extends PatternOptions {
  /** Explicit array of task descriptions. When provided, template is ignored. */
  tasks?: string[]
  /** Maximum concurrency. Default: 5 */
  concurrency?: number
  /** Run a quality review on the fleet results. Default: false */
  qualityCheck?: boolean
}

const defaults: FleetOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  concurrency: 5,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class FleetMemberOutput {
  constructor(
    /** The task description */
    public readonly task: string,
    /** The agent's response text */
    public readonly text: string,
    /** Whether this task completed successfully */
    public readonly success: boolean,
    /** Error message if failed */
    public readonly error?: string
  ) {}
}

export class FleetOutput extends PatternOutput {
  constructor(
    text: string,
    /** Results for each fleet member */
    public readonly members: FleetMemberOutput[],
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }

  /** Number of successful members */
  get successCount(): number {
    return this.members.filter((m) => m.success).length
  }

  /** Number of failed members */
  get failureCount(): number {
    return this.members.filter((m) => !m.success).length
  }
}

// ── Task parsing ────────────────────────────────────────────────────────────

function parseTasks(template: string, explicitTasks?: string[]): string[] {
  if (explicitTasks && explicitTasks.length > 0) return explicitTasks

  const lines = template
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Bullet points: each - or * line is a task
  const bullets = lines.filter((l) => /^[-*]\s/.test(l))
  if (bullets.length > 1) return bullets.map((b) => b.replace(/^[-*]\s+/, ''))

  // Numbered: each "N." or "N)" line is a task
  const numbered = lines.filter((l) => /^\d+[.)]\s/.test(l))
  if (numbered.length > 1) return numbered.map((n) => n.replace(/^\d+[.)]\s+/, ''))

  // Multiple lines: each non-empty line is a task
  if (lines.length > 1) return lines

  // Single line: return as-is (one task)
  return [template]
}

// ── Execute ─────────────────────────────────────────────────────────────────

const FLEET_SYSTEM = `You are a focused task specialist. Complete the assigned task concisely and accurately. Output only the result — no commentary about being an AI.`

async function executeTask(
  task: string,
  opts: FleetOptions,
  workerModel?: string
): Promise<FleetMemberOutput> {
  const model = workerModel ?? opts.model
  try {
    const text = await ask(task, {
      ...opts,
      model,
      system: opts.system ?? FLEET_SYSTEM,
    })
    return new FleetMemberOutput(task, text, true)
  } catch (err) {
    return new FleetMemberOutput(task, '', false, getErrorMessage(err))
  }
}

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: FleetOptions
): Promise<FleetOutput> {
  const template = build(pieces, args)
  const tasks = parseTasks(template, opts.tasks)
  const t0 = Date.now()

  // Fleet is pure execution — all tasks use worker model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Φ: Fleet executing ${tasks.length} task(s) in parallel\n`)
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      process.stderr.write(`  [${i + 1}] ${t.slice(0, 60)}${t.length > 60 ? '...' : ''}\n`)
    }
  }

  // Run tasks with concurrency limit
  const results: FleetMemberOutput[] = []
  const concurrency = opts.concurrency ?? 5

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((task) => executeTask(task, opts, workerModel))
    )
    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        results.push(new FleetMemberOutput(batch[idx], '', false, r.reason?.toString()))
      }
    })
  }

  const t1 = Date.now()

  // Build summary text
  const summary = results
    .map(
      (m, i) =>
        `[${i + 1}] ${m.task}\n  ${m.success ? '✓' : '✗'} ${m.text.slice(0, 200)}${m.text.length > 200 ? '...' : ''}`
    )
    .join('\n\n')

  const header = `Fleet Results: ${results.filter((r) => r.success).length}/${results.length} succeeded\n\n`

  // Quality review (optional) — review the fleet results as a whole
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(template, header + summary, opts)

  return new FleetOutput(header + summary, results, t0, t1, qualityReview)
}

/** Φ tag — Fleet: parallel agent execution */
export const Φ = createPatternTag(defaults, execute)
