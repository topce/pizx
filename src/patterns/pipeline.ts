/**
 * Λ (Lambda) — Pipeline: sequential agent chain
 *
 * Each stage receives the output of the previous stage as input.
 * Like Unix pipes but for AI agent processing.
 *
 * Usage:
 *   await Λ`generate a summary → translate to French → simplify for beginners`
 *   // Stages are separated by "→" or "->" or "|"
 *
 *   await Λ({ stages: ['analyze', 'generate', 'review'] })`write API docs`
 *   // Explicit stage names
 *
 *   await Λ({ stagePrompts: [
 *     'Analyze the code and identify key functions',
 *     'Generate documentation based on this analysis',
 *     'Review the documentation for accuracy'
 *   ] })`document the auth module`
 *   // Full control over each stage's prompt
 *
 *   await Λ.quiet`extract errors → suggest fixes → generate patch`
 *
 * Each stage runs sequentially, with the previous output prepended as context.
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { ask, build, createPatternTag, type PatternOptions, PatternOutput, runQualityReview, type QualityReviewResult } from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface PipelineOptions extends PatternOptions {
  /** Explicit stage names (auto-generated if not provided) */
  stages?: string[]
  /** Custom prompt for each stage (overrides auto-generated prompts) */
  stagePrompts?: string[]
  /** Separator used to parse stages from template. Default: "→" or "->" */
  separator?: string
  /** Run a quality review on the final pipeline output. Default: false */
  qualityCheck?: boolean
}

const defaults: PipelineOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class PipelineStageResult {
  constructor(
    /** Stage name/number */
    public readonly stage: string,
    /** Output after this stage */
    public readonly output: string,
    /** 0-based stage index */
    public readonly index: number
  ) {}
}

export class PipelineOutput extends PatternOutput {
  constructor(
    text: string,
    /** Final output after all stages */
    public readonly finalOutput: string,
    /** Results from each stage */
    public readonly stages: PipelineStageResult[],
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Stage parsing ───────────────────────────────────────────────────────────

function parseStages(template: string, explicitStages?: string[], separator?: string): string[] {
  if (explicitStages && explicitStages.length > 0) return explicitStages

  const sep = separator ?? '→'
  const altSep = sep === '→' ? '->' : sep

  // Try splitting by separator
  const bySep = template
    .split(sep)
    .flatMap((s) => s.split(altSep))
    .map((s) => s.trim())
    .filter(Boolean)

  if (bySep.length > 1) return bySep

  // Try splitting by pipe
  const byPipe = template
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
  if (byPipe.length > 1) return byPipe

  // Try splitting by newline
  const byLine = template
    .split('\n')
    .map((s) =>
      s
        .trim()
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^[-*]\s*/, '')
    )
    .filter(Boolean)
  if (byLine.length > 1) return byLine

  // Single stage
  return [template]
}

// ── Generate stage prompts ──────────────────────────────────────────────────

function generateStagePrompt(stage: string, previousOutput: string, isFirst: boolean): string {
  if (isFirst) {
    return `Task: ${stage}\n\nExecute the task above.`
  }
  return `Previous stage output:\n${previousOutput}\n\nCurrent stage: ${stage}\n\nProcess the previous output according to the current stage's instructions.`
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: PipelineOptions
): Promise<PipelineOutput> {
  const template = build(pieces, args)
  const stages = parseStages(template, opts.stages, opts.separator)
  const t0 = Date.now()

  // Pipeline is sequential execution — all stages use worker model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Λ: Pipeline — ${stages.length} stage(s)\n`)
    for (let i = 0; i < stages.length; i++) {
      process.stderr.write(`  [${i + 1}] ${stages[i]}\n`)
    }
  }

  const stageResults: PipelineStageResult[] = []
  let currentInput = ''

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const customPrompt = opts.stagePrompts?.[i]

    if (!opts.quiet)
      process.stderr.write(`  → Stage ${i + 1}/${stages.length}: ${stage.slice(0, 50)}...\n`)

    const prompt = customPrompt ?? generateStagePrompt(stage, currentInput, i === 0)
    const systemMessage =
      i === 0
        ? `You are a specialist executing stage ${i + 1}: ${stage}. Focus only on this stage's output.`
        : `You are a specialist executing stage ${i + 1}: ${stage}. Process the previous stage's output according to your instructions. Maintain all important information from previous stages.`

    const output = await ask(prompt, { ...opts, model: workerModel, system: systemMessage })

    stageResults.push(new PipelineStageResult(stage, output, i))
    currentInput = output
  }

  const t1 = Date.now()
  const finalOutput = currentInput

  // Quality review (optional) — use the original template as the request
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(template, finalOutput, opts)

  const summary = stageResults
    .map(
      (sr) =>
        `Stage ${sr.index + 1} (${sr.stage}):\n${sr.output.slice(0, 200)}${sr.output.length > 200 ? '...' : ''}`
    )
    .join('\n\n')

  return new PipelineOutput(summary, finalOutput, stageResults, t0, t1, qualityReview)
}

/** Λ tag — Pipeline: sequential agent chain */
export const Λ = createPatternTag(defaults, execute)
