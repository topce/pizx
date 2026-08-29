/**
 * π (small pi) — pi-ai text generation as a letter plugin.
 *
 *   await π`what is 7! + 5?`
 *   await π({ model: 'anthropic/claude-sonnet-4-5' })`explain`
 *   await π.quiet()`generate JSON`
 *   await π.cache()`repeatable answer`
 *   for await (const c of π.stream`tell me a story`) { process.stdout.write(c) }
 */

import type { Plugin } from '@cordisjs/core'
import type { Context as PiContext, ThinkingLevel } from '@earendil-works/pi-ai'
import Schema from 'schemastery'
import type { LetterEnv } from '../core/tags.ts'
import { LetterOutput } from '../core/tags.ts'
import { confirmPhase } from '../core/utils.ts'

const options = Schema.object({
  model: Schema.string().description('Model id, e.g. anthropic/claude-sonnet-4-5'),
  thinkingLevel: Schema.union(['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const)
    .default('medium')
    .description('Thinking effort'),
  thinkingBudgets: Schema.dict(Schema.number()).description(
    'Token budgets per thinking level (token-based providers only)'
  ),
  quiet: Schema.boolean().default(false).description('Suppress streaming output'),
  system: Schema.string().description('System prompt'),
  appendSystemPrompt: Schema.string().description('Text appended after the system prompt'),
  maxTokens: Schema.natural().default(4096).description('Max tokens per call'),
  timeoutMs: Schema.natural().description('Timeout in ms for each LLM call'),
  maxRetries: Schema.natural().description('Max retries for transient failures'),
  apiKey: Schema.string().description('API key overriding environment lookup'),
  cache: Schema.boolean().description('Cache this call (also enabled app-wide)'),
  confirm: Schema.any().description('Confirmation gate: true | { semi } | { hitl } | { auto }'),
})

type PiOpts = ReturnType<typeof options>

function makeContext(prompt: string, opts: PiOpts): PiContext {
  const systemParts: string[] = []
  if (opts.system) systemParts.push(opts.system)
  if (opts.appendSystemPrompt) systemParts.push(opts.appendSystemPrompt)
  return {
    systemPrompt: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
  }
}

function modelError(): Error {
  return new Error('pizx/π: No AI models configured. Run `pi auth login` first.')
}

async function run(prompt: string, opts: PiOpts, env: LetterEnv): Promise<LetterOutput> {
  const { ctx } = env
  const model = await ctx.llm.pick(opts.model ?? ctx.llm.config.model)
  if (!model) throw modelError()

  if (
    !(await confirmPhase(
      `Send to AI:\n    ${prompt.slice(0, 200)}${prompt.length > 200 ? '...' : ''}`,
      'send',
      true,
      opts
    ))
  ) {
    throw new Error("pizx/π: Execution cancelled by user at phase 'send'")
  }

  const t0 = Date.now()
  let text = ''
  try {
    for await (const ev of ctx.llm.stream(model, makeContext(prompt, opts), {
      maxTokens: opts.maxTokens,
      reasoning: opts.thinkingLevel as ThinkingLevel,
      thinkingBudgets: opts.thinkingBudgets,
      timeoutMs: opts.timeoutMs,
      maxRetries: opts.maxRetries,
      apiKey: opts.apiKey,
    })) {
      if (ev.type === 'text_delta') {
        text += ev.delta
        if (!opts.quiet) process.stdout.write(ev.delta)
      } else if (ev.type === 'error') {
        throw new Error(ev.error.errorMessage ?? 'Unknown stream error')
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('pizx/π:')) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`pizx/π: AI generation failed: ${message}`, { cause: err })
  }
  if (!opts.quiet && text) process.stdout.write('\n')
  return new LetterOutput(text.trim(), model.id, false, t0, Date.now())
}

async function* stream(prompt: string, opts: PiOpts, env: LetterEnv): AsyncGenerator<string> {
  const { ctx } = env
  const model = await ctx.llm.pick(opts.model ?? ctx.llm.config.model)
  if (!model) throw modelError()

  for await (const ev of ctx.llm.stream(model, makeContext(prompt, opts), {
    maxTokens: opts.maxTokens,
    reasoning: opts.thinkingLevel as ThinkingLevel,
    thinkingBudgets: opts.thinkingBudgets,
    timeoutMs: opts.timeoutMs,
    maxRetries: opts.maxRetries,
    apiKey: opts.apiKey,
  })) {
    if (ev.type === 'text_delta') yield ev.delta
    else if (ev.type === 'error') {
      throw new Error(`pizx/π: ${ev.error.errorMessage ?? 'Unknown stream error'}`)
    }
  }
}

export const piPlugin: Plugin.Object = {
  name: 'pizx-pi',
  inject: ['letters', 'llm'],
  apply(ctx) {
    ctx.letters.define('π', {
      aliases: ['pi', 'ai'],
      description: 'Pi AI text generation (small pi)',
      options,
      run,
      stream,
    })
  },
}
