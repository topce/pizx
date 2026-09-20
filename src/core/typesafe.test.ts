import { Context } from '@cordisjs/core'
import {
  APIConnectionError,
  APITimeoutError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
  type TypeSafeClient,
} from '@typesafe-ai/sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPizxError } from './errors.ts'
import { Trace } from './trace.ts'
import { JEV_USD_PER_MTOK, mapTypeSafeError, TypeSafe } from './typesafe.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
  vi.restoreAllMocks()
})

function fakeClient(overrides: Record<string, unknown> = {}): TypeSafeClient {
  return {
    systemOne: async () => ({
      model: 'jev-test',
      answers: { a: { type: 'noul', noul: 0.9 } },
      usage: { input_tokens: 1000, output_tokens: 0 },
    }),
    models: { list: async () => [] },
    ...overrides,
  } as unknown as TypeSafeClient
}

async function boot(config: ConstructorParameters<typeof TypeSafe>[1] = { client: fakeClient() }) {
  ctx.plugin(Trace)
  ctx.plugin(TypeSafe, config)
  await ctx.start()
}

describe('TypeSafe service', () => {
  it('asks questions and returns typed answers', async () => {
    await boot()
    const result = await ctx.typesafe.ask('state', { a: { type: 'noul' } })
    expect(result.model).toBe('jev-test')
    expect(result.answers.a.noul).toBe(0.9)
  })

  it('records an llm-call trace event with Jev cost from input tokens', async () => {
    await boot()
    const span = ctx.trace.span('test', 'state')
    await ctx.trace.within(span, () => ctx.typesafe.ask('state', { a: { type: 'noul' } }))
    const calls = span.llmCalls
    expect(calls).toHaveLength(1)
    expect(calls[0].modelId).toBe('jev-test')
    expect(calls[0].inputTokens).toBe(1000)
    expect(calls[0].totalTokens).toBe(1000)
    expect(calls[0].costUsd).toBeCloseTo((1000 / 1_000_000) * JEV_USD_PER_MTOK, 10)
  })

  it('counts direct service calls in the run totals (no active span)', async () => {
    await boot()
    await ctx.typesafe.ask('state', { a: { type: 'noul' } })
    const totals = ctx.trace.totals()
    expect(totals.llmCalls).toBe(1)
    expect(totals.letters).toBe(0)
    expect(totals.inputTokens).toBe(1000)
    expect(totals.costUsd).toBeCloseTo((1000 / 1_000_000) * JEV_USD_PER_MTOK, 10)
  })

  it('rejects an empty question set with VALIDATION', async () => {
    await boot()
    await expect(ctx.typesafe.ask('state', {})).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('maps a client failure through ask() to a PizxError', async () => {
    await boot({
      client: fakeClient({
        systemOne: async () => {
          throw new AuthenticationError(401, {}, new Headers())
        },
      }),
    })
    await expect(ctx.typesafe.ask('state', { a: { type: 'noul' } })).rejects.toMatchObject({
      code: 'AUTH',
    })
  })

  it('normalizes a null state to an empty string (the API rejects null/omitted)', async () => {
    let seen: unknown
    await boot({
      client: fakeClient({
        systemOne: async (request: { state: unknown }) => {
          seen = request.state
          return {
            model: 'jev-test',
            answers: { a: { type: 'noul', noul: 0.5 } },
            usage: { input_tokens: 1, output_tokens: 0 },
          }
        },
      }),
    })
    await ctx.typesafe.ask(null, { a: { type: 'noul' } })
    expect(seen).toBe('')
  })

  it('throws AUTH when no key or client is available', async () => {
    const prev = process.env.TYPESAFE_API_KEY
    delete process.env.TYPESAFE_API_KEY
    try {
      await boot({})
      expect(ctx.typesafe.available).toBe(false)
      await expect(ctx.typesafe.ask('state', { a: { type: 'noul' } })).rejects.toMatchObject({
        code: 'AUTH',
      })
    } finally {
      if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev
    }
  })

  it('maps SDK errors onto pizx error codes', () => {
    const auth = mapTypeSafeError(new AuthenticationError(401, {}, new Headers()))
    expect([auth.code, isPizxError(auth)]).toEqual(['AUTH', true])

    const bad = mapTypeSafeError(new BadRequestError(400, {}, new Headers()))
    expect(bad.code).toBe('VALIDATION')

    const rate = mapTypeSafeError(new RateLimitError(429, {}, new Headers()))
    expect(rate.code).toBe('TYPESAFE')

    const conn = mapTypeSafeError(new APIConnectionError('boom'))
    expect(conn.code).toBe('TYPESAFE')

    const timeout = mapTypeSafeError(new APITimeoutError(1000))
    expect(timeout.code).toBe('TYPESAFE')
    expect(timeout.message).toContain('timed out')
  })
})
