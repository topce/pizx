/**
 * Θ (Theta) — Thread: direct agent-to-agent conversation
 *
 * Two or more agents engage in a multi-turn conversation. Each agent
 * responds to the full thread so far, building on previous contributions.
 * After max turns, a synthesizer merges the thread into a final answer.
 *
 * Usage:
 *   await Θ`debate the best architecture for this project`
 *   await Θ({ agents: 3, turns: 4 })`evaluate this business decision`
 *   await Θ.quiet`find the optimal solution to this problem`
 *
 * Communication pattern: Direct (agent-to-agent message passing)
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { THREAD_ROLE_SETS } from './role-sets.ts'
import {
  build,
  createPatternTag,
  executeTask,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
  type QualityReviewResult,
  runQualityReview,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface ThreadOptions extends PatternOptions {
  /** Number of agents in the conversation. Default: 3 */
  agents?: number
  /** Maximum conversation turns (each agent speaks once per turn). Default: 3 */
  turns?: number
  /** Custom agent roles. Auto-generated if not provided. */
  roles?: string[]
  /** Run a quality review on the final conclusion. Default: false */
  qualityCheck?: boolean
}

const defaults: ThreadOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium',
  agents: 3,
  turns: 3,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class ThreadMessage {
  constructor(
    public readonly role: string,
    public readonly turn: number,
    public readonly content: string
  ) {}
}

export class ThreadOutput extends PatternOutput {
  constructor(
    text: string,
    public readonly conclusion: string,
    public readonly messages: ThreadMessage[],
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const THREAD_PROMPT = `You are an agent with the role: {role}.
Engage in a multi-agent conversation about the topic.

The conversation so far:
{thread}

Respond as your role. Be specific, build on or challenge what others have said.
Keep your response under 200 words.`

const SYNTHESIS_SYSTEM = `You are a neutral facilitator. Synthesize the multi-agent conversation thread into a clear, actionable conclusion. Weigh the evidence, resolve conflicts, and present the best path forward.`

function buildThreadPrompt(role: string, thread: string): string {
  return THREAD_PROMPT.replace('{role}', role).replace(
    '{thread}',
    thread || '(This is the first message in the thread.)'
  )
}

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: ThreadOptions
): Promise<ThreadOutput> {
  const topic = build(pieces, args)
  const t0 = Date.now()
  const agentCount = opts.agents ?? 3
  const maxTurns = opts.turns ?? 3
  const roles = opts.roles ?? THREAD_ROLE_SETS[agentCount] ?? THREAD_ROLE_SETS[3] ?? []

  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Θ: Thread — ${agentCount} agent(s), ${maxTurns} turn(s)\n`)
    process.stderr.write(`  Topic: "${topic.slice(0, 80)}${topic.length > 80 ? '...' : ''}"\n`)
  }

  const messages: ThreadMessage[] = []
  let thread = `Topic: ${topic}\n`

  // Run conversation turns
  for (let turn = 1; turn <= maxTurns; turn++) {
    if (!opts.quiet) process.stderr.write(`  → Turn ${turn}/${maxTurns}\n`)

    for (let a = 0; a < roles.length; a++) {
      const role = roles[a] ?? `Agent ${a + 1}`
      const prompt = buildThreadPrompt(role, thread)

      const response = await executeTask(prompt, { ...opts, model: workerModel })

      messages.push(new ThreadMessage(role, turn, response))
      thread += `\n[${role}] (Turn ${turn}): ${response}\n`
    }
  }

  // Synthesize conclusion (planner model)
  if (!opts.quiet) process.stderr.write('  → Synthesizing conclusion...\n')

  const conclusion = await executeTask(
    `Topic: ${topic}\n\nConversation thread:\n${thread}\n\nSynthesize a clear, actionable conclusion.`,
    {
      ...opts,
      model: plannerModel,
      thinkingLevel: 'high' as ThinkingLevel,
      system: mergeSystem(opts.system, SYNTHESIS_SYSTEM),
    }
  )

  // Quality review (optional)
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(topic, conclusion, opts)

  const t1 = Date.now()

  const summary = messages
    .map(
      (m) =>
        `[${m.role}] Turn ${m.turn}: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`
    )
    .join('\n')

  return new ThreadOutput(summary, conclusion, messages, t0, t1, qualityReview)
}

/** Θ tag — Thread: direct agent-to-agent conversation */
export const Θ = createPatternTag(defaults, execute)
