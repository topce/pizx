/**
 * Μ (Mu) — Memory: shared blackboard pattern
 *
 * Multiple agents write their findings to a shared "blackboard" in parallel.
 * Each agent can see what others have already written. After all agents have
 * contributed, a consolidator merges everything into a final output.
 *
 * Usage:
 *   await Μ`analyze this codebase from multiple angles`
 *   await Μ({ agents: 4, rounds: 2 })`brainstorm features for the project`
 *   await Μ.quiet`research this topic comprehensively`
 *
 * Communication pattern: Tool-Mediated (shared memory/blackboard)
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { MEMORY_ROLE_SETS } from './role-sets.ts'
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

export interface MemoryOptions extends PatternOptions {
  /** Number of agents writing to the blackboard. Default: 3 */
  agents?: number
  /** Number of writing rounds (each agent can refine after seeing others). Default: 1 */
  rounds?: number
  /** Custom agent roles. Auto-generated if not provided. */
  roles?: string[]
  /** Run a quality review on the final synthesis. Default: false */
  qualityCheck?: boolean
}

const defaults: MemoryOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  agents: 3,
  rounds: 1,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class MemoryEntry {
  constructor(
    public readonly role: string,
    public readonly round: number,
    public readonly content: string
  ) {}
}

export class MemoryOutput extends PatternOutput {
  constructor(
    text: string,
    public readonly synthesis: string,
    public readonly entries: MemoryEntry[],
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const WRITER_PROMPT = `You are a specialist with role: {role}.

Topic: {topic}

Current findings on the shared blackboard (written by other agents):
{context}

Add your contribution to the blackboard. Be specific, add unique insights.
Don't repeat what others have already covered — fill gaps, add depth, or challenge.
Keep your contribution under 200 words.`

const CONSOLIDATOR_SYSTEM = `You are a research director. Consolidate findings from multiple specialists into a comprehensive, well-structured synthesis. Combine overlapping insights, resolve contradictions, prioritize the most impactful findings.`

function buildWriterPrompt(role: string, topic: string, context: string): string {
  return WRITER_PROMPT.replace('{role}', role)
    .replace('{topic}', topic)
    .replace('{context}', context || '(No prior entries yet. You are the first contributor.)')
}

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: MemoryOptions
): Promise<MemoryOutput> {
  const topic = build(pieces, args)
  const t0 = Date.now()
  const agentCount = opts.agents ?? 3
  const totalRounds = opts.rounds ?? 1
  const roles = opts.roles ?? MEMORY_ROLE_SETS[agentCount] ?? MEMORY_ROLE_SETS[3] ?? []

  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Μ: Shared Memory — ${agentCount} agent(s), ${totalRounds} round(s)\n`)
    process.stderr.write(`  Topic: "${topic.slice(0, 80)}${topic.length > 80 ? '...' : ''}"\n`)
  }

  const entries: MemoryEntry[] = []
  let blackboard = ''

  for (let round = 1; round <= totalRounds; round++) {
    if (!opts.quiet) process.stderr.write(`  → Round ${round}/${totalRounds}\n`)

    // All agents write in parallel for this round
    const roundResults = await Promise.allSettled(
      roles.map(async (role) => {
        const prompt = buildWriterPrompt(role, topic, blackboard)
        const text = await ask(prompt, { ...opts, model: workerModel })
        return { role, text }
      })
    )

    for (const r of roundResults) {
      if (r.status === 'fulfilled') {
        entries.push(new MemoryEntry(r.value.role, round, r.value.text))
        blackboard += `\n[${r.value.role}] Round ${round}: ${r.value.text}\n`
      }
    }
  }

  // Consolidate (planner model)
  if (!opts.quiet) process.stderr.write('  → Consolidating findings...\n')

  const synthesis = await ask(
    `Topic: ${topic}\n\nBlackboard findings:\n${blackboard}\n\nConsolidate into a comprehensive, structured synthesis.`,
    {
      ...opts,
      model: plannerModel,
      thinkingLevel: 'high' as ThinkingLevel,
      system: mergeSystem(opts.system, CONSOLIDATOR_SYSTEM),
    }
  )

  // Quality review (optional)
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(topic, synthesis, opts)

  const t1 = Date.now()

  const summary = entries
    .map(
      (e) =>
        `[${e.role}] Round ${e.round}: ${e.content.slice(0, 150)}${e.content.length > 150 ? '...' : ''}`
    )
    .join('\n')

  return new MemoryOutput(summary, synthesis, entries, t0, t1, qualityReview)
}

/** Μ tag — Memory: shared blackboard pattern */
export const Μ = createPatternTag(defaults, execute)
