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
import {
  ask,
  build,
  type PatternFn,
  type PatternOptions,
  PatternOutput,
  PatternPromise,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface MemoryOptions extends PatternOptions {
  /** Number of agents writing to the blackboard. Default: 3 */
  agents?: number
  /** Number of writing rounds (each agent can refine after seeing others). Default: 1 */
  rounds?: number
  /** Custom agent roles. Auto-generated if not provided. */
  roles?: string[]
}

const defaults: MemoryOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  agents: 3,
  rounds: 1,
}

const ROLE_SETS: Record<number, string[]> = {
  2: ['Analyst — deep analysis of core aspects', 'Reviewer — check for gaps and blind spots'],
  3: [
    'Analyst — deep analysis of core aspects',
    'Reviewer — check for gaps, edge cases, and blind spots',
    'Strategist — connect findings to actionable insights',
  ],
  4: [
    'Analyst',
    'Reviewer',
    'Strategist',
    'Innovator — propose novel angles and creative solutions',
  ],
  5: [
    'Analyst',
    'Reviewer',
    'Strategist',
    'Innovator',
    'Skeptic — challenge assumptions and stress-test conclusions',
  ],
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
    endTime: number
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
  const roles = opts.roles ?? ROLE_SETS[agentCount] ?? ROLE_SETS[3]!

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
        const text = await ask(prompt, {
          model: workerModel,
          maxTokens: opts.maxTokens,
          thinkingLevel: opts.thinkingLevel,
        })
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
      model: plannerModel,
      maxTokens: opts.maxTokens,
      thinkingLevel: 'high' as ThinkingLevel,
      system: CONSOLIDATOR_SYSTEM,
    }
  )

  const t1 = Date.now()

  const summary = entries
    .map(
      (e) =>
        `[${e.role}] Round ${e.round}: ${e.content.slice(0, 150)}${e.content.length > 150 ? '...' : ''}`
    )
    .join('\n')

  return new MemoryOutput(summary, synthesis, entries, t0, t1)
}

// ── Tag factory ─────────────────────────────────────────────────────────────

interface MemoryFn {
  (pieces: TemplateStringsArray, ...args: unknown[]): PatternPromise<MemoryOutput>
  (opts: Partial<MemoryOptions>): MemoryFn
  quiet: MemoryFn
}

function makeMemory(opts: Partial<MemoryOptions> = {}): MemoryFn {
  const merged = { ...defaults, ...opts }

  const fn = ((
    pieces: TemplateStringsArray | Partial<MemoryOptions>,
    ...args: unknown[]
  ): PatternPromise<MemoryOutput> | MemoryFn => {
    if (!Array.isArray(pieces)) {
      return makeMemory({ ...merged, ...(pieces as Partial<MemoryOptions>) })
    }
    return new PatternPromise((resolve, reject) => {
      execute(pieces as TemplateStringsArray, args, merged).then(resolve, reject)
    })
  }) as unknown as MemoryFn

  let _quiet: MemoryFn | undefined
  Object.defineProperty(fn, 'quiet', {
    get(): MemoryFn {
      if (!_quiet) _quiet = makeMemory({ ...merged, quiet: true })
      return _quiet
    },
    enumerable: true,
    configurable: true,
  })

  return fn
}

/** Μ tag — Memory: shared blackboard pattern */
export const Μ: MemoryFn = makeMemory()
