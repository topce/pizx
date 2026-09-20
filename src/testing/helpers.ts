/**
 * Test helpers — fake LLM service and minimal app bootstrapping.
 * Not published (excluded from the d.ts build).
 */

import { type Context, Service } from '@cordisjs/core'
import type {
  Api,
  AssistantMessageEventStream,
  Model,
  Context as PiContext,
  Usage,
} from '@earendil-works/pi-ai'
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai'
import { Cache } from '../core/cache.ts'
import { Letters } from '../core/letters.ts'
import { Trace } from '../core/trace.ts'
import { Words } from '../core/words.ts'

export const FAKE_MODEL = {
  id: 'fake/model',
  provider: 'fake',
  api: {} as Api,
} as Model<Api>

export const FAKE_USAGE: Usage = {
  input: 10,
  output: 5,
  cacheRead: 3,
  cacheWrite: 4,
  totalTokens: 15,
  cost: { input: 0.001, output: 0.002, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0033 },
}

/** Build a done event carrying FAKE_USAGE. */
export function fakeDone(): { type: 'done'; reason: 'stop'; message: { usage: Usage } } {
  return { type: 'done', reason: 'stop', message: { usage: FAKE_USAGE } }
}

/** Build a text_delta event. */
export function fakeDelta(delta: string) {
  return { type: 'text_delta' as const, contentIndex: 0, delta, partial: null }
}

/** A service named 'llm' that never touches the network. */
export class FakeLlm extends Service {
  calls = 0

  constructor(ctx: Context) {
    super(ctx, 'llm')
  }

  config = {
    model: undefined as string | undefined,
    thinkingLevel: 'medium',
    maxTokens: 4096,
    cache: false,
  }

  pick() {
    return FAKE_MODEL
  }

  stream(
    _model: Model<Api>,
    _context: PiContext,
    _options?: { trace?: boolean }
  ): AssistantMessageEventStream {
    this.calls++
    const stream = createAssistantMessageEventStream()
    stream.push(fakeDelta('hello from fake') as never)
    stream.push(fakeDone() as never)
    stream.end()
    return stream
  }

  recordUsage(): void {
    // no-op in tests
  }

  agentSession(): never {
    throw new Error('FakeLlm.agentSession not implemented')
  }
}

/** A service named 'typesafe' that returns deterministic typed answers. */
export class FakeTypeSafe extends Service {
  calls: { state: unknown; questions: Record<string, any>; model?: string }[] = []

  constructor(ctx: Context) {
    super(ctx, 'typesafe')
  }

  config = {}

  get available() {
    return true
  }

  async ask(state: unknown, questions: Record<string, any>, opts?: { model?: string }) {
    // Mirror the real service: a null/absent state is sent as an empty string.
    this.calls.push({ state: state ?? '', questions, model: opts?.model })
    const answers: Record<string, any> = {}
    for (const [name, q] of Object.entries(questions)) {
      if (q.type === 'noul') {
        answers[name] = { type: 'noul', noul: 0.87 }
      } else if (q.type === 'choice') {
        const first = Object.keys(q.criteria ?? {})[0] ?? 'x'
        answers[name] = {
          type: 'choice',
          choice: first,
          confidence: 0.78,
          probabilities: { [first]: 0.85 },
        }
      } else if (q.type === 'score') {
        answers[name] = {
          type: 'score',
          score: 1,
          confidence: 0.9,
          legend: {},
          probabilities: {},
        }
      }
    }
    return {
      model: opts?.model ?? 'fake-jev',
      answers,
      usage: { input_tokens: 100, output_tokens: 0 },
    }
  }

  async listModels() {
    return [{ name: 'fake-jev', description: 'fake', release_date: '2024-01-01' }]
  }
}

/** Mount trace + cache + a fake llm + a fake typesafe + letters + words. */
export function mountTestCore(
  ctx: Context,
  opts: { cache?: boolean; cacheDir?: string } = {}
): void {
  ctx.plugin({
    name: 'test-core',
    apply(ctx: Context) {
      ctx.plugin(Trace)
      ctx.plugin(Cache, {
        enabled: opts.cache ?? false,
        dir: opts.cacheDir,
        maxEntries: 10,
      })
      ctx.plugin(FakeLlm)
      ctx.plugin(FakeTypeSafe)
      ctx.plugin(Letters)
      ctx.plugin(Words)
    },
  })
}
