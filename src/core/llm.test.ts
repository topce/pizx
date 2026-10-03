import { Context } from '@cordisjs/core'
import { type SessionInfo, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPizxError } from './errors.ts'
import {
  agentSessionKey,
  agentSettingsManager,
  Llm,
  openNamedSession,
  releaseNamedSession,
} from './llm.ts'

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

describe('agentSessionKey (Π session pool)', () => {
  it('treats a durable session name as part of the session identity', () => {
    expect(agentSessionKey({ session: 'review' })).not.toBe(agentSessionKey({ session: 'other' }))
    expect(agentSessionKey({ session: 'review' })).not.toBe(agentSessionKey({}))
  })

  it('ignores option order but not option values', () => {
    const a = agentSessionKey({ tools: ['read', 'edit'], timeoutMs: 1000 })

    expect(a).toBe(agentSessionKey({ timeoutMs: 1000, tools: ['edit', 'read'] }))
    expect(a).not.toBe(agentSessionKey({ timeoutMs: 1000, tools: ['read'] }))
  })

  it('distinguishes an empty allow-list from no allow-list', () => {
    expect(agentSessionKey({ tools: [] })).not.toBe(agentSessionKey({}))
  })
})

describe('openNamedSession (durable Π sessions)', () => {
  const REVIEW = '/sessions/review.jsonl'
  const FRESH = '/sessions/fresh.jsonl'

  afterEach(() => {
    // Claims are process-global: release them or the next test sees this one's.
    releaseNamedSession(REVIEW)
    releaseNamedSession(FRESH)
    vi.restoreAllMocks()
  })

  it('opens the persisted session whose name matches', async () => {
    const info = { path: REVIEW, name: 'review' } as SessionInfo
    vi.spyOn(SessionManager, 'list').mockResolvedValue([info])
    const existing = { getSessionFile: () => REVIEW } as unknown as SessionManager
    const open = vi.spyOn(SessionManager, 'open').mockReturnValue(existing)

    await expect(openNamedSession('/repo', 'review')).resolves.toBe(existing)
    expect(SessionManager.list).toHaveBeenCalledWith('/repo')
    expect(open).toHaveBeenCalledWith(REVIEW)
  })

  it('creates and names a new session when the name is unknown', async () => {
    vi.spyOn(SessionManager, 'list').mockResolvedValue([])
    const appendSessionInfo = vi.fn()
    const created = { appendSessionInfo, getSessionFile: () => FRESH } as unknown as SessionManager
    const create = vi.spyOn(SessionManager, 'create').mockReturnValue(created)

    await expect(openNamedSession('/repo', 'fresh')).resolves.toBe(created)
    expect(create).toHaveBeenCalledWith('/repo')
    expect(appendSessionInfo).toHaveBeenCalledWith('fresh')
  })

  it('refuses a second live handle on one session name', async () => {
    const info = { path: REVIEW, name: 'review' } as SessionInfo
    const list = vi.spyOn(SessionManager, 'list').mockResolvedValue([info])
    vi.spyOn(SessionManager, 'open').mockReturnValue({
      getSessionFile: () => REVIEW,
    } as unknown as SessionManager)

    await openNamedSession('/repo', 'review')

    // Two live handles on one JSONL fork it silently (each keeps its own leaf
    // pointer), so the second open must fail loudly instead.
    await expect(openNamedSession('/repo', 'review')).rejects.toSatisfy(
      (err) => isPizxError(err) && err.code === 'VALIDATION' && /already open/.test(err.message)
    )
    expect(list).toHaveBeenCalledTimes(1)

    // Disposing the first app releases the claim.
    releaseNamedSession(REVIEW)
    await expect(openNamedSession('/repo', 'review')).resolves.toBeDefined()
  })

  it('keeps the same name free in another working directory', async () => {
    vi.spyOn(SessionManager, 'list').mockResolvedValue([])
    vi.spyOn(SessionManager, 'create').mockReturnValue({
      appendSessionInfo: vi.fn(),
      getSessionFile: () => FRESH,
    } as unknown as SessionManager)

    await expect(openNamedSession('/repo', 'fresh')).resolves.toBeDefined()
    await expect(openNamedSession('/other', 'fresh')).resolves.toBeDefined()
  })
})
