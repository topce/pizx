/**
 * Β (Beta) — Broadcast: one-to-many messaging pattern
 *
 * One lead agent formulates the problem and broadcasts it to all worker agents.
 * Workers respond independently (in parallel), then the lead synthesizes all
 * responses into a final answer.
 *
 * Usage:
 *   await Β`gather feedback on this architecture proposal`
 *   await Β({ workers: 5 })`collect diverse perspectives on this design`
 *   await Β.quiet`poll all specialists about this decision`
 *
 * Communication pattern: Broadcast (one-to-many) + Manager-based synthesis
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import { ask, build, type PatternOptions, PatternOutput, PatternPromise } from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface BroadcastOptions extends PatternOptions {
  /** Number of worker agents to broadcast to. Default: 4 */
  workers?: number
  /** Custom worker roles. Auto-generated if not provided. */
  roles?: string[]
}

const defaults: BroadcastOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  workers: 4,
}

const ROLE_SETS: Record<number, string[]> = {
  2: [
    'Technical Expert — evaluate technical feasibility',
    'Business Expert — evaluate business viability',
  ],
  3: [
    'Technical Expert — evaluate technical feasibility',
    'Business Expert — evaluate business viability',
    'User Expert — evaluate user experience and adoption',
  ],
  4: [
    'Technical Expert',
    'Business Expert',
    'User Expert',
    'Risk Expert — identify risks, compliance, and security concerns',
  ],
  5: [
    'Technical Expert',
    'Business Expert',
    'User Expert',
    'Risk Expert',
    'Innovation Expert — suggest novel approaches and alternatives',
  ],
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class BroadcastResponse {
  constructor(
    public readonly role: string,
    public readonly response: string,
    public readonly success: boolean,
    public readonly error?: string
  ) {}
}

export class BroadcastOutput extends PatternOutput {
  constructor(
    text: string,
    public readonly synthesis: string,
    public readonly responses: BroadcastResponse[],
    startTime: number,
    endTime: number
  ) {
    super(text, startTime, endTime)
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const WORKER_PROMPT = `You are a {role}.

A question has been broadcast to you and your fellow specialists:

{question}

Provide your expert analysis and recommendation from your specific perspective.
Be thorough but concise — under 200 words.`

const SYNTHESIS_SYSTEM = `You are a lead strategist. You broadcast a question to your specialist team. Now synthesize their collective responses into a coherent, actionable recommendation. Weigh conflicting opinions, identify consensus, and present the best path forward.`

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: BroadcastOptions
): Promise<BroadcastOutput> {
  const question = build(pieces, args)
  const t0 = Date.now()
  const workerCount = opts.workers ?? 4
  const roles = opts.roles ?? ROLE_SETS[workerCount] ?? ROLE_SETS[4] ?? []

  const plannerModel = opts.plannerModel ?? opts.model
  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Β: Broadcast — ${workerCount} worker(s)\n`)
    process.stderr.write(
      `  Question: "${question.slice(0, 80)}${question.length > 80 ? '...' : ''}"\n`
    )
  }

  // Broadcast to all workers in parallel
  if (!opts.quiet) process.stderr.write('  → Broadcasting to workers...\n')

  const broadcastResults = await Promise.allSettled(
    roles.map(async (role) => {
      const prompt = WORKER_PROMPT.replace('{role}', role).replace('{question}', question)
      const text = await ask(prompt, {
        model: workerModel,
        maxTokens: opts.maxTokens,
        thinkingLevel: opts.thinkingLevel,
      })
      return new BroadcastResponse(role, text, true)
    })
  )

  const responses: BroadcastResponse[] = []
  for (const r of broadcastResults) {
    if (r.status === 'fulfilled') {
      responses.push(r.value)
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
      responses.push(new BroadcastResponse('(failed)', '', false, msg))
    }
  }

  // Synthesize (planner model)
  if (!opts.quiet) process.stderr.write('  → Synthesizing responses...\n')

  const responsesText = responses.map((wr) => `--- ${wr.role} ---\n${wr.response}`).join('\n\n')

  const synthesis = await ask(
    `Original question:\n${question}\n\nWorker responses:\n${responsesText}\n\nSynthesize a cohesive, actionable recommendation.`,
    {
      model: plannerModel,
      maxTokens: opts.maxTokens,
      thinkingLevel: 'high' as ThinkingLevel,
      system: SYNTHESIS_SYSTEM,
    }
  )

  const t1 = Date.now()

  const summary = responses
    .map(
      (wr) => `[${wr.role}]: ${wr.response.slice(0, 150)}${wr.response.length > 150 ? '...' : ''}`
    )
    .join('\n')

  return new BroadcastOutput(summary, synthesis, responses, t0, t1)
}

// ── Tag factory ─────────────────────────────────────────────────────────────

interface BroadcastFn {
  (pieces: TemplateStringsArray, ...args: unknown[]): PatternPromise<BroadcastOutput>
  (opts: Partial<BroadcastOptions>): BroadcastFn
  quiet: BroadcastFn
}

function makeBroadcast(opts: Partial<BroadcastOptions> = {}): BroadcastFn {
  const merged = { ...defaults, ...opts }

  const fn = ((
    pieces: TemplateStringsArray | Partial<BroadcastOptions>,
    ...args: unknown[]
  ): PatternPromise<BroadcastOutput> | BroadcastFn => {
    if (!Array.isArray(pieces)) {
      return makeBroadcast({ ...merged, ...(pieces as Partial<BroadcastOptions>) })
    }
    return new PatternPromise((resolve, reject) => {
      execute(pieces as TemplateStringsArray, args, merged).then(resolve, reject)
    })
  }) as unknown as BroadcastFn

  let _quiet: BroadcastFn | undefined
  Object.defineProperty(fn, 'quiet', {
    get(): BroadcastFn {
      if (!_quiet) _quiet = makeBroadcast({ ...merged, quiet: true })
      return _quiet
    },
    enumerable: true,
    configurable: true,
  })

  return fn
}

/** Β tag — Broadcast: one-to-many messaging */
export const Β: BroadcastFn = makeBroadcast()
