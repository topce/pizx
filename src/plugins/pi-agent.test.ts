import { Context } from '@cordisjs/core'
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LetterFn } from '../core/tags.ts'
import { FAKE_MODEL, FAKE_USAGE, mountTestCore } from '../testing/helpers.ts'
import { piAgentPlugin } from './pi-agent.ts'

let ctx: Context

beforeEach(() => {
  ctx = new Context()
})

afterEach(async () => {
  await ctx.stop()
  vi.restoreAllMocks()
})

/** A `SessionStats` snapshot with `assistantMessages` turns accumulated. */
function fakeStats(assistantMessages: number) {
  return {
    sessionFile: undefined,
    sessionId: 'fake',
    userMessages: assistantMessages,
    assistantMessages,
    toolCalls: 0,
    toolResults: 0,
    totalMessages: assistantMessages * 2,
    tokens: {
      input: FAKE_USAGE.input * assistantMessages,
      output: FAKE_USAGE.output * assistantMessages,
      cacheRead: FAKE_USAGE.cacheRead * assistantMessages,
      cacheWrite: FAKE_USAGE.cacheWrite * assistantMessages,
      total: FAKE_USAGE.totalTokens * assistantMessages,
    },
    cost: FAKE_USAGE.cost.total * assistantMessages,
  }
}

function fakeSession(overrides: Partial<Record<keyof AgentSession, unknown>> = {}): AgentSession {
  return {
    sendUserMessage: vi.fn(async () => {}),
    getLastAssistantText: () => 'ok',
    messages: [],
    getSessionStats: () => fakeStats(1),
    ...overrides,
  } as unknown as AgentSession
}

async function bootAgent(lastAssistantText: string | undefined): Promise<LetterFn> {
  mountTestCore(ctx)
  ctx.plugin(piAgentPlugin)
  await ctx.start()

  vi.spyOn(ctx.llm, 'agentSession').mockResolvedValue({
    session: fakeSession({
      getLastAssistantText: () => lastAssistantText,
      messages: [
        { role: 'user', content: 'goal', timestamp: Date.now() },
        { role: 'assistant', content: [], usage: FAKE_USAGE },
      ],
    } as Partial<Record<keyof AgentSession, unknown>>),
    modelId: FAKE_MODEL.id,
  })

  const Π = ctx.letters.get('Π')
  if (!Π) throw new Error('Π not registered')
  return Π
}

describe('Π letter plugin', () => {
  it('strips serialized tool-call markup from the result text', async () => {
    const Π = await bootAgent(
      'I implemented the plan.\n\n' +
        '<tool_calls>\n' +
        '<invoke name="bash">\n' +
        '<parameter name="command">ls</parameter>\n' +
        '</invoke>\n' +
        '</tool_calls>'
    )

    const out = await Π.quiet`fix it`
    expect(out.text).toBe('I implemented the plan.')
    expect(out.text).not.toContain('<tool_calls>')
    expect(out.text).not.toContain('<invoke')
    expect(out.turnCount).toBe(1)
  })

  it('strips unclosed tool-call markup (truncated streams)', async () => {
    const Π = await bootAgent('Working…\n\n<tool_calls>\n<invoke name="read">')

    const out = await Π.quiet`fix it`
    expect(out.text).toBe('Working…')
  })

  it('keeps clean assistant text unchanged', async () => {
    const Π = await bootAgent('All done.')

    const out = await Π.quiet`fix it`
    expect(out.text).toBe('All done.')
  })

  it('falls back when the agent produced no text', async () => {
    const Π = await bootAgent(undefined)

    const out = await Π.quiet`fix it`
    expect(out.text).toBe('(no assistant response)')
  })

  it('forwards timeoutMs and maxRetries to the agent session', async () => {
    const Π = await bootAgent('done')

    await Π.quiet({ timeoutMs: 1234, maxRetries: 7 })`fix it`

    expect(vi.mocked(ctx.llm.agentSession)).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 1234, maxRetries: 7 })
    )
  })

  it('reports only the latest invocation on a reused pooled session', async () => {
    mountTestCore(ctx)
    ctx.plugin(piAgentPlugin)
    await ctx.start()

    let assistantMessages = 0
    const session = fakeSession({
      sendUserMessage: vi.fn(async () => {
        assistantMessages += 1
      }),
      getSessionStats: () => fakeStats(assistantMessages),
    })
    vi.spyOn(ctx.llm, 'agentSession').mockResolvedValue({
      session,
      modelId: FAKE_MODEL.id,
    })
    const usage = vi.spyOn(ctx.llm, 'recordUsage')

    const Π = ctx.letters.get('Π')
    if (!Π) throw new Error('Π not registered')

    const first = await Π.quiet`one`
    const second = await Π.quiet`two`

    // Both invocations report one turn — not the pooled session's cumulative two.
    expect(first.turnCount).toBe(1)
    expect(second.turnCount).toBe(1)

    // The second invocation records only its own delta, not the replayed first.
    expect(usage).toHaveBeenCalledTimes(2)
    expect(usage.mock.calls[1][1]).toMatchObject({
      input: FAKE_USAGE.input,
      output: FAKE_USAGE.output,
      totalTokens: FAKE_USAGE.totalTokens,
    })
    expect(usage.mock.calls[1][1].cost.total).toBeCloseTo(FAKE_USAGE.cost.total)
  })

  it('records a failed run and does not bill it to the next call', async () => {
    mountTestCore(ctx)
    ctx.plugin(piAgentPlugin)
    await ctx.start()

    let assistantMessages = 0
    const session = fakeSession({
      sendUserMessage: vi.fn(async () => {
        assistantMessages += 1
        throw new Error('agent exploded')
      }),
      getSessionStats: () => fakeStats(assistantMessages),
    })
    vi.spyOn(ctx.llm, 'agentSession').mockResolvedValue({
      session,
      modelId: FAKE_MODEL.id,
    })
    const usage = vi.spyOn(ctx.llm, 'recordUsage')

    const Π = ctx.letters.get('Π')
    if (!Π) throw new Error('Π not registered')

    await expect(Π.quiet`one`).rejects.toMatchObject({ code: 'AGENT' })
    // The failed run's tokens are recorded into its own span...
    expect(usage).toHaveBeenCalledTimes(1)
    expect(usage.mock.calls[0][1].totalTokens).toBe(FAKE_USAGE.totalTokens)

    // ...and the next successful call reports only its own new turn.
    vi.mocked(session.sendUserMessage).mockImplementation(async () => {
      assistantMessages += 1
    })
    await Π.quiet`two`
    expect(usage).toHaveBeenCalledTimes(2)
    expect(usage.mock.calls[1][1].totalTokens).toBe(FAKE_USAGE.totalTokens)
  })
})
