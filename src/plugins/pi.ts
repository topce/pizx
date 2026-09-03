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
import { isPizxError, PizxError } from '../core/errors.ts'
import type { LetterEnv } from '../core/tags.ts'
import { LetterOutput } from '../core/tags.ts'
import { confirmGateSchema, confirmPhase, getErrorMessage } from '../core/utils.ts'

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
  confirm: confirmGateSchema.description(
    'Confirmation gate: true | { semi } | { hitl } | { auto }'
  ),
})

export type PiOpts = ReturnType<typeof options>

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
  return new PizxError('AUTH', 'pizx/π: No AI models configured. Run `pi auth login` first.', {
    letter: 'π',
  })
}

/**
 * Join the text content blocks of a stream's `done` message. Some providers
 * (e.g. prompt-cache hits) deliver the full text in the done message with no
 * `text_delta` events at all, so both run() and stream() recover it from here.
 */
function textFromDoneMessage(message: {
  content: readonly { type: string; text?: string }[]
}): string {
  return message.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('')
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
    throw new PizxError('CANCELLED', "pizx/π: Execution cancelled by user at phase 'send'", {
      letter: 'π',
    })
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
      } else if (ev.type === 'done') {
        // Recover the full text when the provider skipped text_delta events.
        if (!text) {
          const full = textFromDoneMessage(ev.message)
          if (full) {
            text = full
            if (!opts.quiet) process.stdout.write(full)
          }
        }
      } else if (ev.type === 'error') {
        throw new Error(ev.error.errorMessage ?? 'Unknown stream error')
      }
    }
  } catch (err) {
    if (isPizxError(err)) throw err
    throw new PizxError('INTERNAL', `pizx/π: AI generation failed: ${getErrorMessage(err)}`, {
      letter: 'π',
      cause: err,
    })
  }
  if (!opts.quiet && text) process.stdout.write('\n')
  return new LetterOutput(text.trim(), model.id, false, t0, Date.now())
}

async function* stream(prompt: string, opts: PiOpts, env: LetterEnv): AsyncGenerator<string> {
  const { ctx } = env
  const model = await ctx.llm.pick(opts.model ?? ctx.llm.config.model)
  if (!model) throw modelError()

  let yielded = false
  for await (const ev of ctx.llm.stream(model, makeContext(prompt, opts), {
    maxTokens: opts.maxTokens,
    reasoning: opts.thinkingLevel as ThinkingLevel,
    thinkingBudgets: opts.thinkingBudgets,
    timeoutMs: opts.timeoutMs,
    maxRetries: opts.maxRetries,
    apiKey: opts.apiKey,
  })) {
    if (ev.type === 'text_delta') {
      yielded = true
      yield ev.delta
    } else if (ev.type === 'done') {
      // Same recovery as run(): a cache-hit response may carry the full
      // text in the done message with no text_delta events at all.
      if (!yielded) {
        const full = textFromDoneMessage(ev.message)
        if (full) yield full
      }
    } else if (ev.type === 'error') {
      throw new PizxError(
        'INTERNAL',
        `pizx/π: ${ev.error.errorMessage ?? 'Unknown stream error'}`,
        {
          letter: 'π',
        }
      )
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
