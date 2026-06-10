/**
 * Π (capital pi) — pi-coding-agent as a zx-style template tag.
 *
 *   await Π`fix the TypeScript errors in src/`
 *   await Π({ tools: ['read', 'bash', 'edit'] })`refactor auth`
 *   await Π.quiet()`update import paths`
 */

import type { ThinkingBudgets, ThinkingLevel } from '@earendil-works/pi-ai'
import {
  type AgentSession,
  createAgentSession,
  DefaultResourceLoader,
} from '@earendil-works/pi-coding-agent'
import { build } from './patterns/types.ts'
import { getErrorMessage } from './utils.ts'

export interface AgentOptions {
  cwd?: string
  model?: string
  thinkingLevel?: ThinkingLevel
  /** Token budgets per thinking level (token-based providers only). */
  thinkingBudgets?: ThinkingBudgets
  quiet?: boolean
  maxTurns?: number
  tools?: string[]
  excludeTools?: string[]
  /** Custom system prompt (replaces Pi default). */
  system?: string
  /** Text appended after the system prompt. */
  appendSystemPrompt?: string
  /** Skill names to load and register with the agent session. */
  skills?: string[]
}

const _agentDefaults: AgentOptions = {
  quiet: false,
  maxTurns: 10,
}

// ── AgentOutput ──────────────────────────────────────────────────────────────

export class AgentOutput {
  constructor(
    public readonly text: string,
    public readonly turnCount: number = 0,
    public readonly startTime: number = Date.now(),
    public readonly endTime: number = Date.now()
  ) {}

  get duration(): number {
    return this.endTime - this.startTime
  }
  toString(): string {
    return this.text
  }
  valueOf(): string {
    return this.text
  }
  [Symbol.toPrimitive](): string {
    return this.text
  }
}

export class AgentPromise extends Promise<AgentOutput> {}

// ── Session management ───────────────────────────────────────────────────────

import { loadSkillContents, SKILL_PATHS } from './skill-loader.ts'

let _sharedSession: AgentSession | null = null

/** Build a resource loader with system prompt and skill overrides. */
function createLoader(opts: AgentOptions): DefaultResourceLoader | undefined {
  const hasSystem = opts.system !== undefined
  const hasAppend = opts.appendSystemPrompt !== undefined
  const hasSkills = opts.skills && opts.skills.length > 0
  if (!hasSystem && !hasAppend && !hasSkills) return undefined

  return new DefaultResourceLoader({
    cwd: opts.cwd ?? process.cwd(),
    agentDir: '',
    systemPrompt: opts.system,
    appendSystemPrompt: opts.appendSystemPrompt ? [opts.appendSystemPrompt] : undefined,
  })
}

async function getSession(opts: AgentOptions): Promise<AgentSession> {
  if (_sharedSession && !opts.model) return _sharedSession

  try {
    const loader = createLoader(opts)

    // Register skill directories with the resource loader
    if (opts.skills && opts.skills.length > 0 && loader) {
      const skillMap = await loadSkillContents(opts.skills)
      const skillPaths: Array<{
        path: string
        metadata: { source: string; scope: 'project' | 'user' | 'temporary'; origin: 'top-level' }
      }> = []
      for (const [name] of skillMap) {
        for (const base of SKILL_PATHS) {
          skillPaths.push({
            path: `${base}/${name}`,
            metadata: { source: 'pizx', scope: 'project', origin: 'top-level' },
          })
        }
      }
      if (skillPaths.length > 0) {
        loader.extendResources({ skillPaths })
      }
    }

    const result = await createAgentSession({
      cwd: opts.cwd,
      thinkingLevel: opts.thinkingLevel,
      tools: opts.tools,
      excludeTools: opts.excludeTools,
      resourceLoader: loader,
    })

    _sharedSession = result.session
    return _sharedSession
  } catch (err) {
    throw new Error(`pizx/Π: Failed to create agent session: ${getErrorMessage(err)}`)
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

/**
 * Extract text content from an agent message. Handles both string content
 * and content block arrays (TextContent[], ToolUseContent[], etc.).
 */
function getMessageText(msg: { role: string; content: unknown }): string {
  const content = msg.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(
        (c: { type?: string; text?: string }) => c.type === 'text' && typeof c.text === 'string'
      )
      .map((c: { text: string }) => c.text)
      .join('')
  }
  return ''
}

/**
 * Find the last assistant message in a session's message list.
 */
function getLastAssistantText(session: {
  messages: readonly { role: string; content?: unknown }[]
}): string {
  const messages = session.messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return getMessageText(messages[i] as { role: string; content: unknown })
    }
  }
  return ''
}

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: AgentOptions
): Promise<AgentOutput> {
  const prompt = build(pieces, args)
  const session = await getSession(opts)
  const t0 = Date.now()

  if (!opts.quiet) {
    process.stderr.write(`Π: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}\n`)
  }

  try {
    // Send the prompt — session handles the turn loop (tools, etc.)
    await session.sendUserMessage(prompt)

    const t1 = Date.now()
    // Extract the actual assistant response from session messages
    const text = getLastAssistantText(session)

    // Count how many assistant turns happened (tool calls + final response)
    const turnCount = session.messages.filter((m) => m.role === 'assistant').length

    return new AgentOutput(text || '(no assistant response)', turnCount, t0, t1)
  } catch (err) {
    const t1 = Date.now()
    console.error('Π error:', err)
    return new AgentOutput(`Π error: ${getErrorMessage(err)}`, 0, t0, t1)
  }
}

// ── The Π tag ───────────────────────────────────────────────────────────────

interface AgentFn {
  (pieces: TemplateStringsArray, ...args: unknown[]): AgentPromise
  (opts: Partial<AgentOptions>): AgentFn
  quiet: AgentFn
}

function makeAgent(opts: Partial<AgentOptions> = {}): AgentFn {
  const merged = { ..._agentDefaults, ...opts }

  const fn = ((
    pieces: TemplateStringsArray | Partial<AgentOptions>,
    ...args: unknown[]
  ): AgentPromise | AgentFn => {
    if (!Array.isArray(pieces)) {
      return makeAgent({ ...merged, ...(pieces as Partial<AgentOptions>) })
    }
    return new AgentPromise((resolve, reject) => {
      execute(pieces as TemplateStringsArray, args, merged).then(resolve, reject)
    })
  }) as unknown as AgentFn

  let _quiet: AgentFn | undefined
  Object.defineProperty(fn, 'quiet', {
    get(): AgentFn {
      if (!_quiet) _quiet = makeAgent({ ...merged, quiet: true })
      return _quiet
    },
    enumerable: true,
    configurable: true,
  })

  return fn
}

/** Π tag — run pi-coding-agent with tools */
export const Π: AgentFn = makeAgent()

export function configureAgent(opts: Partial<AgentOptions>): void {
  Object.assign(_agentDefaults, opts)
}

export async function closeAgent(): Promise<void> {
  if (_sharedSession) {
    _sharedSession.dispose()
    _sharedSession = null
  }
}
