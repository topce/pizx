/**
 * Ψ (Psi) — Critique: generate → critique → improve cycle
 *
 * A focused two-phase pattern:
 *   1. Generate: an initial answer or solution
 *   2. Critique: another pass identifies issues and improvements
 *   3. Improve: the final answer incorporating the critique
 *
 * Unlike the Ralph loop (Ρ), Critique is a single-pass refinement
 * designed for content quality rather than iterative tool use.
 *
 * Usage:
 *   await Ψ`write a README for this project`
 *   await Ψ({ rounds: 2 })`explain dependency injection`
 *   await Ψ.quiet`generate a commit message for these changes`
 *
 * Options:
 *   rounds: number of critique-improve cycles (default: 1, max: 3)
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { ask, build, createPatternTag, type PatternOptions, PatternOutput, mergeSystem } from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface CritiqueOptions extends PatternOptions {
  /** Number of critique-improve cycles. Default: 1, Max: 3 */
  rounds?: number
}

const defaults: CritiqueOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  rounds: 1,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class CritiqueRound {
  constructor(
    /** The generated/improved content */
    public readonly content: string,
    /** The critique of this round's content */
    public readonly critique: string,
    /** Round number (0-based) */
    public readonly round: number
  ) {}
}

export class CritiqueOutput extends PatternOutput {
  constructor(
    text: string,
    /** Final improved content */
    public readonly finalContent: string,
    /** All critique rounds */
    public readonly rounds: CritiqueRound[],
    startTime: number,
    endTime: number
  ) {
    super(text, startTime, endTime)
  }
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const CRITIQUE_SYSTEM = `You are a thorough, constructive critic. Review the following content and identify:
1. Strengths (what works well)
2. Weaknesses (what could be improved)
3. Specific suggestions for improvement

Be specific, actionable, and constructive. Focus on substance, not style.`

const IMPROVE_SYSTEM = `You are a skilled editor. Revise the original content based on the critique provided.
Incorporate the feedback while maintaining the original intent and voice.
Output ONLY the improved content — no commentary or explanation.`

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: CritiqueOptions
): Promise<CritiqueOutput> {
  const prompt = build(pieces, args)
  const t0 = Date.now()
  const rounds = Math.min(opts.rounds ?? 1, 3)

  // Planner model for critique, worker model for generate/improve
  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(
      `Ψ: Critique — "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"\n`
    )
    process.stderr.write(`  → ${rounds} critique round(s)\n`)
  }

  const critiqueRounds: CritiqueRound[] = []
  let currentContent = ''

  for (let r = 0; r < rounds; r++) {
    // Generate (first round) or improve (subsequent rounds)
    if (r === 0) {
      if (!opts.quiet) process.stderr.write('  → Generating initial content...\n')
      currentContent = await ask(prompt, { ...opts, model: workerModel, system: opts.system })
    } else {
      if (!opts.quiet) process.stderr.write(`  → Improving (round ${r + 1})...\n`)
      // Use the previous round's critique from the stored result
      const prevCritique = critiqueRounds[r - 1]?.critique ?? ''
      currentContent = await ask(
        `Original request: ${prompt}\n\nCritique:\n${prevCritique}\n\nContent to improve:\n${currentContent}\n\nRevise the content based on the critique.`,
        { ...opts, model: workerModel, system: mergeSystem(opts.system, IMPROVE_SYSTEM) }
      )
    }

    // Critique
    if (!opts.quiet) process.stderr.write(`  → Critiquing (round ${r + 1})...\n`)
    const critique = await ask(currentContent, {
      ...opts,
      model: plannerModel,
      system: mergeSystem(opts.system, CRITIQUE_SYSTEM),
    })

    critiqueRounds.push(new CritiqueRound(currentContent, critique, r))
  }

  const t1 = Date.now()
  const finalContent = currentContent

  const summary = critiqueRounds
    .map(
      (cr) =>
        `Round ${cr.round + 1}:\n${cr.content.slice(0, 200)}${cr.content.length > 200 ? '...' : ''}\nCritique: ${cr.critique.slice(0, 200)}${cr.critique.length > 200 ? '...' : ''}`
    )
    .join('\n\n')

  return new CritiqueOutput(summary, finalContent, critiqueRounds, t0, t1)
}

/** Ψ tag — Critique: generate → critique → improve */
export const Ψ = createPatternTag(defaults, execute)
