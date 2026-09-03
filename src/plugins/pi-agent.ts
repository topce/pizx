/**
 * Π (capital pi) — pi-coding-agent with tools, as a letter plugin.
 *
 *   await Π`fix the TypeScript errors in src/`
 *   await Π({ tools: ['read', 'bash', 'edit'] })`refactor auth`
 *   await Π.quiet()`update import paths`
 *
 * The agent session is pooled per model/tools so repeated invocations reuse
 * the conversation — which also keeps provider prompt caches warm. The letter
 * is marked cache: false: agent runs mutate the filesystem, so its results
 * are never served from the local result cache.
 */

import type { Plugin } from '@cordisjs/core'
import type { ThinkingLevel, Usage } from '@earendil-works/pi-ai'
import Schema from 'schemastery'
import { isPizxError, PizxError } from '../core/errors.ts'
import type { LetterEnv } from '../core/tags.ts'
import { LetterOutput } from '../core/tags.ts'
import { confirmGateSchema, confirmPhase, getErrorMessage } from '../core/utils.ts'

const options = Schema.object({
  cwd: Schema.string().description('Working directory for the agent'),
  model: Schema.string().description('Model id, e.g. anthropic/claude-sonnet-4-5'),
  thinkingLevel: Schema.union([
    'off',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
  ] as const).description('Thinking effort'),
  thinkingBudgets: Schema.dict(Schema.number()).description(
    'Token budgets per thinking level (token-based providers only)'
  ),
  quiet: Schema.boolean().default(false).description('Suppress status output'),
  tools: Schema.array(Schema.string()).description('Tools to enable (default: all)'),
  excludeTools: Schema.array(Schema.string()).description('Tools to disable'),
  system: Schema.string().description('Custom system prompt (replaces Pi default)'),
  appendSystemPrompt: Schema.string().description('Text appended after the system prompt'),
  skills: Schema.array(Schema.string()).description('Skill names to load'),
  timeoutMs: Schema.natural().description('Timeout in ms for each LLM call'),
  maxRetries: Schema.natural().description('Max retries for transient failures'),
  apiKey: Schema.string().description('API key overriding environment lookup'),
  confirm: confirmGateSchema.description(
    'Confirmation gate: true | { semi } | { hitl } | { auto }'
  ),
})

export type AgentOpts = ReturnType<typeof options>

interface AgentMessage {
  role: string
  usage?: Usage
}

/**
 * Strip serialized tool-call markup from an assistant reply.
 *
 * Models trained on agentic traces sometimes emit tool calls as inline text —
 * `<tool_calls><invoke name="bash">…</invoke></tool_calls>` — instead of native
 * tool-call blocks. That machinery is the agent's internal DSL, not a result:
 * it must never leak into the letter's output text. Real tool activity is
 * already traced separately as tool-call events.
 */
function cleanAssistantText(text: string | undefined): string {
  if (!text) return ''
  return text
    .replace(/<tool_calls>[\s\S]*?(?:<\/tool_calls>|$)/g, '')
    .replace(/<invoke\b[\s\S]*?(?:<\/invoke>|$)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function run(prompt: string, opts: AgentOpts, env: LetterEnv): Promise<LetterOutput> {
  const { ctx, span } = env

  const toolsInfo = opts.tools
    ? `\n    Tools: ${opts.tools.join(', ')}`
    : opts.excludeTools
      ? `\n    Excluded tools: ${opts.excludeTools.join(', ')}`
      : ''
  if (
    !(await confirmPhase(
      `Send to coding agent:\n    ${prompt.slice(0, 200)}${prompt.length > 200 ? '...' : ''}${toolsInfo}`,
      'send',
      true,
      opts
    ))
  ) {
    throw new PizxError('CANCELLED', "pizx/Π: Execution cancelled by user at phase 'send'", {
      letter: 'Π',
    })
  }

  if (!opts.quiet) {
    process.stderr.write(`Π: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}\n`)
  }

  const t0 = Date.now()
  try {
    const { session, modelId } = await ctx.llm.agentSession({
      cwd: opts.cwd,
      model: opts.model,
      thinkingLevel: opts.thinkingLevel as ThinkingLevel | undefined,
      tools: opts.tools,
      excludeTools: opts.excludeTools,
      system: opts.system,
      appendSystemPrompt: opts.appendSystemPrompt,
      skills: opts.skills,
    })

    await session.sendUserMessage(prompt)

    // Best-effort per-turn usage recording into the trace span.
    if (span) {
      for (const message of session.messages as readonly AgentMessage[]) {
        if (message.role === 'assistant' && message.usage) {
          ctx.llm.recordUsage(modelId, message.usage, 0)
        }
      }
    }

    const t1 = Date.now()
    // The SDK's canonical extractor returns only text content blocks; clean it
    // further so any inline tool-call markup never leaks into the result.
    const text = cleanAssistantText(session.getLastAssistantText())
    const turnCount = (session.messages as readonly AgentMessage[]).filter(
      (m) => m.role === 'assistant'
    ).length
    if (!opts.quiet) {
      process.stderr.write(`  Π: done (${turnCount} assistant turn(s))\n`)
    }
    const output = new LetterOutput(text || '(no assistant response)', modelId, false, t0, t1)
    output._setTurnCount(turnCount)
    return output
  } catch (err) {
    if (isPizxError(err)) throw err
    throw new PizxError('AGENT', `pizx/Π: agent failed: ${getErrorMessage(err)}`, {
      letter: 'Π',
      cause: err,
    })
  }
}

export const piAgentPlugin: Plugin.Object = {
  name: 'pizx-pi-agent',
  inject: ['letters', 'llm'],
  apply(ctx) {
    ctx.letters.define('Π', {
      aliases: ['Pi', 'piAgent', 'codingAgent'],
      description: 'Pi coding agent with tools (capital pi)',
      cache: false,
      options,
      run,
    })
  },
}
