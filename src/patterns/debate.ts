/**
 * Δ (Delta) — Debate: multiple perspectives converge on an answer
 *
 * Spawns multiple agents with different perspectives/roles, lets them each
 * analyze the problem, then converges on a final answer through synthesis.
 *
 * Supports multi-round rebuttals: when rounds > 1, each perspective sees
 * all round-1 arguments and produces a counter-argument in round 2+.
 *
 * Usage:
 *   await Δ`what's the best architecture for a real-time chat app?`
 *   await Δ({ perspectives: 3 })`should we use microservices or monolith?`
 *   await Δ({ perspectives: 3, rounds: 2 })`debate this design decision with rebuttals`
 *   await Δ.quiet`evaluate the trade-offs of this design decision`
 *
 * Each perspective gets a unique role (optimist, pessimist, pragmatist, etc.)
 * and contributes their analysis before synthesis.
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { DEBATE_ROLE_SETS } from './role-sets.ts'
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

export interface DebateOptions extends PatternOptions {
  /** Number of perspectives to debate. Default: 3 */
  perspectives?: number
  /** Explicit perspective roles. Overrides auto-generation. */
  roles?: string[]
  /** Number of debate rounds (1 = initial only, 2+ = rebuttals). Default: 1 */
  rounds?: number
  /** Run a quality review on the final conclusion. Default: false */
  qualityCheck?: boolean
}

const defaults: DebateOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  perspectives: 3,
  rounds: 1,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class DebatePerspective {
  constructor(
    /** The role/perspective name */
    public readonly role: string,
    /** The perspective's analysis (round 1) or counter-argument (rounds 2+) */
    public readonly argument: string,
    /** Debate round number. Default: 1 */
    public readonly round: number = 1
  ) {}
}

export class DebateOutput extends PatternOutput {
  constructor(
    text: string,
    /** The converged/final answer */
    public readonly conclusion: string,
    /** Individual perspective arguments (all rounds) */
    public readonly perspectives: DebatePerspective[],
    /** Number of debate rounds executed */
    public readonly rounds: number,
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const PERSPECTIVE_SYSTEM = (role: string) =>
  `You are a debater with the role: ${role}. Analyze the question from your perspective. Be thorough and specific. Provide evidence and reasoning for your position.`

const REBUTTAL_SYSTEM = (role: string) =>
  `You are a debater with the role: ${role}. Review the debate so far — including arguments from all other perspectives — and refine your position. Address counter-arguments directly. Challenge weak points in opposing views. Strengthen your original position with rebuttals. Be specific and responsive.`

const SYNTHESIS_SYSTEM = `You are a neutral moderator. Synthesize the different perspectives into a balanced, reasoned conclusion. Weigh the evidence from each perspective and provide a final recommendation. Be specific and actionable.`

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: DebateOptions
): Promise<DebateOutput> {
  const question = build(pieces, args)
  const t0 = Date.now()
  const count = opts.perspectives ?? 3
  const totalRounds = opts.rounds ?? 1
  const roles = opts.roles ?? DEBATE_ROLE_SETS[count] ?? DEBATE_ROLE_SETS[3] ?? []

  // Planner model for synthesis, worker model for individual perspectives
  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(
      `Δ: Debate — "${question.slice(0, 80)}${question.length > 80 ? '...' : ''}"\n`
    )
    process.stderr.write(`  → ${roles.length} perspective(s), ${totalRounds} round(s)\n`)
  }

  const allPerspectives: DebatePerspective[] = []
  let debateHistory = `Question: ${question}\n`

  // ── Round 1: Initial perspectives (parallel) ──
  if (!opts.quiet) process.stderr.write('  → Round 1: Initial perspectives...\n')

  const round1Results = await Promise.allSettled(
    roles.map((role) =>
      ask(question, {
        ...opts,
        model: workerModel,
        system: mergeSystem(opts.system, PERSPECTIVE_SYSTEM(role)),
      }).then((text) => new DebatePerspective(role, text, 1))
    )
  )

  const round1Perspectives: DebatePerspective[] = []
  round1Results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      round1Perspectives.push(r.value)
    } else {
      round1Perspectives.push(
        new DebatePerspective(roles[i] ?? `Perspective ${i + 1}`, `(failed: ${r.reason})`, 1)
      )
    }
  })
  allPerspectives.push(...round1Perspectives)

  debateHistory += `${round1Perspectives.map((p) => `[Round 1] ${p.role}: ${p.argument}`).join('\n\n')}\n`

  // ── Rounds 2+: Rebuttals (parallel within each round) ──
  for (let round = 2; round <= totalRounds; round++) {
    if (!opts.quiet) process.stderr.write(`  → Round ${round}: Rebuttals...\n`)

    const roundResults = await Promise.allSettled(
      roles.map((role) => {
        // Show all prior arguments to this agent
        const othersText = allPerspectives
          .filter((p) => p.role !== role)
          .map((p) => `[${p.role}, Round ${p.round}]: ${p.argument}`)
          .join('\n\n')

        const ownText = allPerspectives
          .filter((p) => p.role === role)
          .map((p) => `[Your Round ${p.round}]: ${p.argument}`)
          .join('\n\n')

        const prompt = `Question: ${question}\n\nYour previous position:\n${ownText}\n\nCounter-arguments from other perspectives:\n${othersText}\n\nRefine your position. Address the counter-arguments directly. Strengthen your argument with rebuttals.`

        return ask(prompt, {
          ...opts,
          model: workerModel,
          system: mergeSystem(opts.system, REBUTTAL_SYSTEM(role)),
        }).then((text) => new DebatePerspective(role, text, round))
      })
    )

    const roundPerspectives: DebatePerspective[] = []
    roundResults.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        roundPerspectives.push(r.value)
      } else {
        roundPerspectives.push(
          new DebatePerspective(roles[i] ?? `Perspective ${i + 1}`, `(failed: ${r.reason})`, round)
        )
      }
    })
    allPerspectives.push(...roundPerspectives)

    debateHistory += `${roundPerspectives.map((p) => `[Round ${round}] ${p.role}: ${p.argument}`).join('\n\n')}\n`
  }

  // ── Synthesize with full debate history ──
  if (!opts.quiet) process.stderr.write('  → Synthesizing perspectives...\n')

  const conclusion = await ask(
    `${debateHistory}\n\nSynthesize a balanced conclusion from the full debate above. Weigh the evidence from all rounds.`,
    {
      ...opts,
      model: plannerModel,
      thinkingLevel: 'high' as ThinkingLevel,
      system: mergeSystem(opts.system, SYNTHESIS_SYSTEM),
    }
  )

  // Quality review (optional)
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(question, conclusion, opts)

  const t1 = Date.now()

  return new DebateOutput(
    conclusion,
    conclusion,
    allPerspectives,
    totalRounds,
    t0,
    t1,
    qualityReview
  )
}

/** Δ tag — Debate: multiple perspectives converge */
export const Δ = createPatternTag(defaults, execute)
