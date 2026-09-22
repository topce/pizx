import { Context } from '@cordisjs/core'
import { SettingsManager } from '@earendil-works/pi-coding-agent'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPizxError } from './errors.ts'
import { agentSettingsManager, Llm } from './llm.ts'

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

describe('agentSettingsManager (Π timeout/retry wiring)', () => {
  it('returns undefined when neither override is set', () => {
    expect(agentSettingsManager({})).toBeUndefined()
  })

  it('maps timeoutMs/maxRetries onto Pi provider and agent retry settings', () => {
    const manager = agentSettingsManager({ timeoutMs: 1234, maxRetries: 7 })

    expect(manager).toBeInstanceOf(SettingsManager)
    expect(manager?.getProviderRetrySettings()).toMatchObject({ timeoutMs: 1234, maxRetries: 7 })
    expect(manager?.getRetrySettings()).toMatchObject({ maxRetries: 7 })
  })

  it('overrides only the option that was set', () => {
    const timeoutOnly = agentSettingsManager({ timeoutMs: 500 })
    expect(timeoutOnly?.getProviderRetrySettings()).toMatchObject({ timeoutMs: 500 })

    const retriesOnly = agentSettingsManager({ maxRetries: 2 })
    expect(retriesOnly?.getRetrySettings()).toMatchObject({ maxRetries: 2 })
  })
})
