/**
 * Χ (Chi) — Cross-Agent Learning: extract patterns from execution traces
 *
 * A meta-pattern that analyzes the output of any other pizx pattern (or a
 * described execution) and extracts learnings: what worked, bottlenecks,
 * quality gaps, and actionable improvement recommendations.
 *
 * Usage:
 *   await Χ`extract learnings from a debate about microservices vs monolith`
 *   await Χ({ source: debateResult })`analyze what went well and what to improve`
 *   await Χ({ trace: '...' })`identify optimization opportunities`
 *   await Χ.quiet`review the fleet execution for efficiency patterns`
 *
 * Output: 4-category structured insights with confidence scores.
 *
 * Pattern: Cross-Agent Learning (Advanced Technique)
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import {
  ask,
  build,
  createPatternTag,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
  type QualityReviewResult,
  runQualityReview,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface ChiOptions extends PatternOptions {
  /** A previous pattern output to learn from */
  source?: PatternOutput
  /** Explicit execution trace text to analyze */
  trace?: string
  /** Run a quality review on the extracted insights. Default: false */
  qualityCheck?: boolean
}

const defaults: ChiOptions = {
  maxTokens: 4096,
  thinkingLevel: 'high' as ThinkingLevel,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class LearningInsight {
  constructor(
    /** Category: 'communication' | 'workflow' | 'quality' | 'efficiency' */
    public readonly category: string,
    /** The observed pattern */
    public readonly pattern: string,
    /** Actionable improvement recommendation */
    public readonly recommendation: string,
    /** Confidence score 0.0–1.0 */
    public readonly confidence: number
  ) {}
}

export class ChiOutput extends PatternOutput {
  constructor(
    text: string,
    /** Extracted learning insights across 4 categories */
    public readonly insights: LearningInsight[],
    /** Executive summary of learnings */
    public readonly summary: string,
    /** Concrete suggested changes to roles, prompts, or workflow */
    public readonly suggestedChanges: string,
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are an agent team performance analyst. Review a multi-agent execution and extract structured learnings.

Analyze across these 4 categories:

1. COMMUNICATION: How well did agents share information? Bottlenecks? Gaps?
2. WORKFLOW: Was execution order optimal? Unnecessary or missing steps?
3. QUALITY: Were there gaps, inconsistencies, or errors in outputs?
4. EFFICIENCY: Where could parallelism, caching, or batching improve speed?

For EACH category, output exactly:

CATEGORY: (communication | workflow | quality | efficiency)
PATTERN: (one specific, observed pattern — be concrete)
RECOMMENDATION: (one actionable, specific improvement)
CONFIDENCE: 0.XX

After all categories, output:

SUMMARY: (2-3 sentence executive summary of key findings)

CHANGES: (concrete, specific changes to agent roles, prompts, or workflow structure — cite specific phases or prompts that should change)`

// ── Input resolution ────────────────────────────────────────────────────────

function resolveInput(opts: ChiOptions, template: string): string {
  if (opts.trace) return opts.trace

  if (opts.source) {
    const sourceType = opts.source.constructor.name
    return `Execution trace from ${sourceType} pattern:\n\n${opts.source.text}`
  }

  return `Description of an agent execution:\n\n${template}\n\n(Analyze this described execution and extract learnings.)`
}

// ── Parse insights ──────────────────────────────────────────────────────────

function parseInsights(response: string): {
  insights: LearningInsight[]
  summary: string
  suggestedChanges: string
} {
  const insights: LearningInsight[] = []

  // Parse each category block
  const categoryRegex =
    /CATEGORY\s*:\s*(\w+)[\s\S]*?PATTERN\s*:\s*(.+?)\nRECOMMENDATION\s*:\s*(.+?)\nCONFIDENCE\s*:\s*([\d.]+)/gi
  let match: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
  while ((match = categoryRegex.exec(response)) !== null) {
    const category = match[1].trim().toLowerCase()
    const pattern = match[2].trim()
    const recommendation = match[3].trim()
    const confidence = parseFloat(match[4]) || 0.5

    if (['communication', 'workflow', 'quality', 'efficiency'].includes(category)) {
      insights.push(
        new LearningInsight(category, pattern, recommendation, Math.min(1, Math.max(0, confidence)))
      )
    }
  }

  // Parse summary
  const summaryMatch = response.match(/SUMMARY\s*:\s*(.+?)(?:\n\n|$)/is)
  const summary = summaryMatch?.[1]?.trim() ?? 'No summary extracted.'

  // Parse changes
  const changesMatch = response.match(/CHANGES\s*:\s*(.+?)$/is)
  const suggestedChanges = changesMatch?.[1]?.trim() ?? 'No specific changes recommended.'

  return { insights, summary, suggestedChanges }
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: ChiOptions
): Promise<ChiOutput> {
  const template = build(pieces, args)
  const input = resolveInput(opts, template)
  const t0 = Date.now()

  const plannerModel = opts.plannerModel ?? opts.model

  if (!opts.quiet) {
    const label = opts.source ? opts.source.constructor.name : opts.trace ? 'trace' : 'analysis'
    process.stderr.write(`Χ: Cross-Agent Learning — analyzing ${label}\n`)
  }

  const response = await ask(input, {
    ...opts,
    model: plannerModel,
    system: mergeSystem(opts.system, ANALYSIS_SYSTEM),
  })

  const { insights, summary, suggestedChanges } = parseInsights(response)

  // Quality review (optional) — validate the extracted insights
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(input, response, opts)

  const t1 = Date.now()

  const text = [
    `Insights: ${insights.length} extracted`,
    insights
      .map(
        (i) =>
          `  [${i.category}] ${i.pattern.slice(0, 80)}... (confidence: ${i.confidence.toFixed(2)})`
      )
      .join('\n'),
    `\nSummary: ${summary}`,
    `\nChanges: ${suggestedChanges}`,
  ].join('\n')

  return new ChiOutput(text, insights, summary, suggestedChanges, t0, t1, qualityReview)
}

/** Χ tag — Cross-Agent Learning: extract patterns and recommendations from traces */
export const Χ = createPatternTag(defaults, execute)
