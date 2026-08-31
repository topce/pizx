import { Context } from '@cordisjs/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPizxError } from './errors.ts'
import { Llm } from './llm.ts'

describe('Llm auth errors', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ask() throws a PizxError(AUTH) with the `pi auth login` hint when no model is configured', async () => {
    const ctx = new Context()
    const llm = new Llm(ctx)
    vi.spyOn(llm, 'pick').mockResolvedValue(undefined)

    await expect(llm.ask('hello')).rejects.toSatisfy(
      (err) => isPizxError(err) && err.code === 'AUTH' && /pi auth login/.test(err.message)
    )
  })

  it('agentSession() throws a PizxError(AUTH) with the `pi auth login` hint when no model is configured', async () => {
    const ctx = new Context()
    const llm = new Llm(ctx)
    vi.spyOn(llm, 'pick').mockResolvedValue(undefined)

    await expect(llm.agentSession({})).rejects.toSatisfy(
      (err) => isPizxError(err) && err.code === 'AUTH' && /pi auth login/.test(err.message)
    )
  })
})
