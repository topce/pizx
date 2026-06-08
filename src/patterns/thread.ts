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
import {
  ask,
  build,
  type PatternFn,
  type PatternOptions,
  PatternOutput,
  PatternPromise,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface ThreadOptions extends PatternOptions {
  /** Number of agents in the conversation. Default: 3 */
  agents?: number
  /** Maximum conversation turns (each agent speaks once per turn). Default: 3 */
  turns?: number
  /** Custom agent roles. Auto-generated if not provided. */
  roles?: string[]
}

const defaults: ThreadOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  agents: 3,
  turns: 3,
}

const ROLE_SETS: Record<number, string[]> = {
  2: ['Proposer — advocate the best approach', 'Critic — identify weaknesses and gaps'],
  3: [
    'Proposer — suggest the best approach',
    'Critic — identify weaknesses, risks, and missing pieces',
    'Synthesizer — combine the best ideas into a practical plan',
  ],
  4: [
    'Proposer — advocate a bold solution',
    'Critic — identify risks and weaknesses',
    'Pragmatist — focus on practical implementation',
    'Innovator — propose creative alternatives',
  ],
  5: [
    'Proposer',
    'Critic',
    'Pragmatist',
    'Innovator',
    "Devil's Advocate — challenge every assumption",
  ],
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
    endTime: number
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
  const roles = opts.roles ?? ROLE_SETS[agentCount] ?? ROLE_SETS[3]!

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

      const response = await ask(prompt, {
        model: workerModel,
        maxTokens: opts.maxTokens,
        thinkingLevel: opts.thinkingLevel,
      })

      messages.push(new ThreadMessage(role, turn, response))
      thread += `\n[${role}] (Turn ${turn}): ${response}\n`
    }
  }

  // Synthesize conclusion (planner model)
  if (!opts.quiet) process.stderr.write('  → Synthesizing conclusion...\n')

  const conclusion = await ask(
    `Topic: ${topic}\n\nConversation thread:\n${thread}\n\nSynthesize a clear, actionable conclusion.`,
    {
      model: plannerModel,
      maxTokens: opts.maxTokens,
      thinkingLevel: 'high' as ThinkingLevel,
      system: SYNTHESIS_SYSTEM,
    }
  )

  const t1 = Date.now()

  const summary = messages
    .map(
      (m) =>
        `[${m.role}] Turn ${m.turn}: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`
    )
    .join('\n')

  return new ThreadOutput(summary, conclusion, messages, t0, t1)
}

// ── Tag factory ─────────────────────────────────────────────────────────────

interface ThreadFn {
  (pieces: TemplateStringsArray, ...args: unknown[]): PatternPromise<ThreadOutput>
  (opts: Partial<ThreadOptions>): ThreadFn
  quiet: ThreadFn
}

function makeThread(opts: Partial<ThreadOptions> = {}): ThreadFn {
  const merged = { ...defaults, ...opts }

  const fn = ((
    pieces: TemplateStringsArray | Partial<ThreadOptions>,
    ...args: unknown[]
  ): PatternPromise<ThreadOutput> | ThreadFn => {
    if (!Array.isArray(pieces)) {
      return makeThread({ ...merged, ...(pieces as Partial<ThreadOptions>) })
    }
    return new PatternPromise((resolve, reject) => {
      execute(pieces as TemplateStringsArray, args, merged).then(resolve, reject)
    })
  }) as unknown as ThreadFn

  let _quiet: ThreadFn | undefined
  Object.defineProperty(fn, 'quiet', {
    get(): ThreadFn {
      if (!_quiet) _quiet = makeThread({ ...merged, quiet: true })
      return _quiet
    },
    enumerable: true,
    configurable: true,
  })

  return fn
}

/** Θ tag — Thread: direct agent-to-agent conversation */
export const Θ: ThreadFn = makeThread()
