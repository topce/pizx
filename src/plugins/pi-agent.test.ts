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

async function bootAgent(lastAssistantText: string | undefined): Promise<LetterFn> {
  mountTestCore(ctx)
  ctx.plugin(piAgentPlugin)
  await ctx.start()

  const fakeSession = {
    sendUserMessage: vi.fn(async () => {}),
    getLastAssistantText: () => lastAssistantText,
    messages: [
      { role: 'user', content: 'goal', timestamp: Date.now() },
      { role: 'assistant', content: [], usage: FAKE_USAGE },
    ],
  } as unknown as AgentSession

  vi.spyOn(ctx.llm, 'agentSession').mockResolvedValue({
    session: fakeSession,
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
})
