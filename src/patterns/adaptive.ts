/**
 * Α (Alpha) — Adaptive: self-adjusting orchestration
 *
 * Starts with an initial plan, executes step by step, evaluates quality
 * after each step, and adapts the workflow — adding, skipping, or reassigning
 * steps based on intermediate results.
 *
 * Usage:
 *   await Α`build a comprehensive solution for this problem`
 *   await Α({ maxSteps: 6, qualityThreshold: 0.8 })`design the system architecture`
 *   await Α.quiet`iterate on this algorithm until it meets quality standards`
 *
 * Orchestration pattern: Adaptive Workflow (changes based on progress)
 * Topology: Dynamic — shifts between sequential, parallel, and checkpoint
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import {
  ask,
  build,
  createPatternTag,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface AdaptiveOptions extends PatternOptions {
  /** Maximum steps before stopping. Default: 5 */
  maxSteps?: number
  /** Quality threshold (0.0–1.0) to stop early. Default: 0.8 */
  qualityThreshold?: number
}

const defaults: AdaptiveOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  maxSteps: 5,
  qualityThreshold: 0.8,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class AdaptiveStep {
  constructor(
    public readonly step: number,
    public readonly action: string,
    public readonly result: string,
    public readonly quality: number,
    public readonly adaptation: string
  ) {}
}

export class AdaptiveOutput extends PatternOutput {
  constructor(
    text: string,
    public readonly finalResult: string,
    public readonly steps: AdaptiveStep[],
    public readonly totalSteps: number,
    startTime: number,
    endTime: number
  ) {
    super(text, startTime, endTime)
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const PLAN_SYSTEM = `You are an adaptive workflow planner. Given a goal, produce a step-by-step execution plan.

Output format:
PLAN:
1. Step description
2. Step description
...

Each step must be concrete and self-contained. Generate at most 5 steps.`

const EXECUTE_SYSTEM = `You are a task executor. Execute the assigned step. Output your result directly — no meta-commentary. Be specific and actionable.`

const EVALUATE_SYSTEM = `You are a quality evaluator. Review the execution result and provide:
1. Quality score: a number from 0.0 (poor) to 1.0 (perfect)
2. Brief assessment (1 sentence)
3. Adaptation recommendation: "CONTINUE" to proceed as planned, "REFINE" to redo this step, "SKIP_NEXT" to skip the next planned step, or "ADD [description]" to insert a new step before continuing

Output format:
SCORE: 0.XX
ASSESSMENT: (one sentence)
ADAPTATION: CONTINUE | REFINE | SKIP_NEXT | ADD (description)`

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: AdaptiveOptions
): Promise<AdaptiveOutput> {
  const goal = build(pieces, args)
  const t0 = Date.now()

  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Α: Adaptive — "${goal.slice(0, 80)}${goal.length > 80 ? '...' : ''}"\n`)
  }

  // 1. Generate initial plan (planner model)
  if (!opts.quiet) process.stderr.write('  → Planning...\n')
  const planText = await ask(goal, {
    ...opts,
    model: plannerModel,
    thinkingLevel: 'high' as ThinkingLevel,
    system: mergeSystem(opts.system, PLAN_SYSTEM),
  })

  // Parse plan into steps
  const planLines = planText.split('\n')
  const plannedSteps: string[] = []
  for (const line of planLines) {
    const match = line.match(/^\d+[.)]\s*(.+)/)
    if (match) plannedSteps.push(match[1].trim())
  }
  const steps = plannedSteps.length > 0 ? plannedSteps : [goal]

  if (!opts.quiet) {
    process.stderr.write(`  → ${steps.length} step(s) planned\n`)
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      process.stderr.write(`      [${i + 1}] ${s.slice(0, 60)}${s.length > 60 ? '...' : ''}\n`)
    }
  }

  // 2. Execute adaptively
  const adaptiveSteps: AdaptiveStep[] = []
  const maxSteps = opts.maxSteps ?? 5
  const threshold = opts.qualityThreshold ?? 0.8
  let stepIndex = 0
  let executionStep = 0

  while (stepIndex < steps.length && executionStep < maxSteps) {
    executionStep++
    const currentStep = steps[stepIndex]

    if (!opts.quiet)
      process.stderr.write(`  → Step ${executionStep}: ${currentStep.slice(0, 60)}...\n`)

    // Execute current step (worker model)
    const result = await ask(currentStep, {
      ...opts,
      model: workerModel,
      system: mergeSystem(opts.system, EXECUTE_SYSTEM),
    })

    // Evaluate (planner model)
    const evaluation = await ask(
      `Goal: ${goal}\nStep executed: ${currentStep}\nResult: ${result}\n\nEvaluate the result.`,
      {
        ...opts,
        model: plannerModel,
        maxTokens: 512,
        thinkingLevel: 'high' as ThinkingLevel,
        system: mergeSystem(opts.system, EVALUATE_SYSTEM),
      }
    )

    // Parse evaluation
    const scoreMatch = evaluation.match(/SCORE:\s*([\d.]+)/i)
    const assessMatch = evaluation.match(/ASSESSMENT:\s*(.+)/i)
    const adaptMatch = evaluation.match(/ADAPTATION:\s*(.+)/i)

    const quality = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5
    const assessment = assessMatch?.[1] ?? '(no assessment)'
    const adaptation = adaptMatch?.[1] ?? 'CONTINUE'

    adaptiveSteps.push(new AdaptiveStep(executionStep, currentStep, result, quality, adaptation))

    if (!opts.quiet) {
      process.stderr.write(`      Quality: ${quality.toFixed(2)} | ${assessment.slice(0, 60)}...\n`)
      process.stderr.write(`      Adaptation: ${adaptation}\n`)
    }

    // Check if quality threshold met — done early
    if (quality >= threshold) {
      if (!opts.quiet)
        process.stderr.write(`  ✓ Quality threshold (${threshold}) met — stopping early\n`)
      break
    }

    // Apply adaptation
    const adaptUpper = adaptation.toUpperCase()
    if (adaptUpper.startsWith('SKIP_NEXT')) {
      stepIndex += 2 // Skip current + next
    } else if (adaptUpper.startsWith('ADD')) {
      const newStep = adaptation.replace(/^ADD\s*/i, '')
      steps.splice(stepIndex + 1, 0, newStep)
      stepIndex++
    } else {
      // CONTINUE or unknown — advance normally
      stepIndex++
    }
  }

  const t1 = Date.now()

  const finalResult = adaptiveSteps.length > 0 ? adaptiveSteps[adaptiveSteps.length - 1].result : ''

  const summary = adaptiveSteps
    .map(
      (s) =>
        `Step ${s.step}: ${s.action.slice(0, 80)}...\n  Quality: ${s.quality.toFixed(2)}\n  Adaptation: ${s.adaptation}`
    )
    .join('\n\n')

  return new AdaptiveOutput(summary, finalResult, adaptiveSteps, executionStep, t0, t1)
}

/** Α tag — Adaptive: self-adjusting orchestration */
export const Α = createPatternTag(defaults, execute)
