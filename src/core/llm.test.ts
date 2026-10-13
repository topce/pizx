import { Context } from '@cordisjs/core'
import { type SessionInfo, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAKE_MODEL, FAKE_USAGE } from '../testing/helpers.ts'
import { isPizxError } from './errors.ts'
import {
  agentSessionKey,
  agentSettingsManager,
  createLoader,
  Llm,
  openNamedSession,
  releaseNamedSession,
} from './llm.ts'

// ── Pi SDK mocks ────────────────────────────────────────────────────────────
//
// The Pi CLI loads codemode, tool_search, and MCP as built-in extensions; the
// SDK does not, so pizx attaches them to the resource loader itself. Those
// factories, the agent dir, and the model registry are mocked so the wiring can
// be asserted without reading (or writing) the real Pi installation on disk.
// Everything else stays real, so the SettingsManager/SessionManager tests below
// still exercise the actual SDK classes.

const piMocks = vi.hoisted(() => {
  const codemodeExt = { name: 'test-codemode' }
  const toolSearchExt = { name: 'test-tool_search' }
  const mcpExt = { name: 'test-mcp' }
  return {
    codemodeExt,
    toolSearchExt,
    mcpExt,
    loaderOptions: [] as Array<Record<string, unknown>>,
    loaderReloads: 0,
    agentDir: '/test/pi-agent-dir',
    createAgentSession: vi.fn(),
    registry: {
      getModelsOfType: vi.fn(),
      getModelOfType: vi.fn(),
      getAvailableOfType: vi.fn(),
      classify: vi.fn(),
      generateImages: vi.fn(),
    },
  }
})

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@earendil-works/pi-coding-agent')>()
  return {
    ...actual,
    getAgentDir: () => piMocks.agentDir,
    createCodemodeExtension: () => piMocks.codemodeExt,
    createToolSearchExtension: () => piMocks.toolSearchExt,
    createMcpExtension: () => piMocks.mcpExt,
    createAgentSession: piMocks.createAgentSession,
    // A recording stand-in: createLoader's wiring is under test, not the SDK
    // constructor (which resolves the real agent dir and settings manager).
    DefaultResourceLoader: class {
      constructor(options: Record<string, unknown>) {
        piMocks.loaderOptions.push(options)
      }
      async reload() {
        piMocks.loaderReloads++
      }
    },
    ModelRuntime: { create: async () => ({}) },
    ModelRegistry: class {
      getModelsOfType(...args: unknown[]) {
        return piMocks.registry.getModelsOfType(...args)
      }
      getModelOfType(...args: unknown[]) {
        return piMocks.registry.getModelOfType(...args)
      }
      getAvailableOfType(...args: unknown[]) {
        return piMocks.registry.getAvailableOfType(...args)
      }
      classify(...args: unknown[]) {
        return piMocks.registry.classify(...args)
      }
      generateImages(...args: unknown[]) {
        return piMocks.registry.generateImages(...args)
      }
    },
  } as unknown as typeof actual
})

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

  it('returns undefined when only plugin flags are requested but false', () => {
    expect(agentSettingsManager({ codemode: false, toolSearch: false })).toBeUndefined()
  })

  it('activates codemode/tool_search through additive defaultTools', () => {
    // `+name` keeps the built-in defaults and adds the tool.
    expect(agentSettingsManager({ codemode: true })?.getDefaultTools()).toEqual([
      'read',
      'bash',
      'edit',
      'write',
      'codemode',
    ])
    expect(agentSettingsManager({ toolSearch: true })?.getDefaultTools()).toEqual([
      'read',
      'bash',
      'edit',
      'write',
      'tool_search',
    ])
    expect(agentSettingsManager({ codemode: true, toolSearch: true })?.getDefaultTools()).toEqual([
      'read',
      'bash',
      'edit',
      'write',
      'codemode',
      'tool_search',
    ])
  })

  it('combines tool activation with retry overrides', () => {
    const manager = agentSettingsManager({ codemode: true, timeoutMs: 500 })
    expect(manager?.getDefaultTools()).toContain('codemode')
    expect(manager?.getProviderRetrySettings()).toMatchObject({ timeoutMs: 500 })
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

describe('createLoader (Π SDK extension wiring)', () => {
  beforeEach(() => {
    piMocks.loaderOptions.length = 0
  })

  const lastOptions = () => piMocks.loaderOptions.at(-1)

  it('returns undefined when neither a system prompt nor an extension is requested', () => {
    expect(createLoader({})).toBeUndefined()
    expect(piMocks.loaderOptions).toHaveLength(0)
  })

  it('builds a loader for a custom system prompt, with no extension factories', () => {
    expect(createLoader({ system: 'custom' })).toBeDefined()
    expect(lastOptions()?.systemPrompt).toBe('custom')
    expect(lastOptions()).not.toHaveProperty('extensionFactories')
  })

  it('reads the agent dir from getAgentDir() — where mcp.json lives', () => {
    createLoader({ codemode: true })

    expect(lastOptions()?.agentDir).toBe(piMocks.agentDir)
  })

  it('maps codemode to the codemode extension alone', () => {
    createLoader({ codemode: true })

    expect(lastOptions()?.extensionFactories).toEqual([piMocks.codemodeExt])
  })

  it('maps toolSearch to the tool_search extension alone', () => {
    createLoader({ toolSearch: true })

    expect(lastOptions()?.extensionFactories).toEqual([piMocks.toolSearchExt])
  })

  it('makes mcp imply codemode, since MCP servers activate it', () => {
    createLoader({ mcp: true })

    expect(lastOptions()?.extensionFactories).toEqual([piMocks.codemodeExt, piMocks.mcpExt])
  })

  it('loads codemode, tool_search, then MCP when all three are requested', () => {
    createLoader({ codemode: true, toolSearch: true, mcp: true })

    expect(lastOptions()?.extensionFactories).toEqual([
      piMocks.codemodeExt,
      piMocks.toolSearchExt,
      piMocks.mcpExt,
    ])
  })

  it('wraps appendSystemPrompt as a single-element array', () => {
    createLoader({ appendSystemPrompt: 'extra' })

    expect(lastOptions()?.appendSystemPrompt).toEqual(['extra'])
  })
})

describe('agentSession (Π session build)', () => {
  const BOOM = '/sessions/boom.jsonl'

  beforeEach(() => {
    piMocks.createAgentSession.mockReset()
    piMocks.loaderOptions.length = 0
    piMocks.loaderReloads = 0
  })

  afterEach(() => {
    releaseNamedSession(BOOM)
    vi.restoreAllMocks()
  })

  /** A stand-in agent session recording whether extensions were bound. */
  function stubSession() {
    const bindExtensions = vi.fn(async () => {})
    piMocks.createAgentSession.mockResolvedValue({ session: { bindExtensions } })
    return bindExtensions
  }

  function newLlm() {
    const llm = new Llm(new Context())
    vi.spyOn(llm, 'pick').mockResolvedValue(FAKE_MODEL)
    return llm
  }

  it('binds extensions for a codemode session so MCP servers can connect', async () => {
    const bindExtensions = stubSession()

    await newLlm().agentSession({ codemode: true })

    expect(bindExtensions).toHaveBeenCalledWith({})
  })

  it('reloads the loader so extension factories actually register', async () => {
    stubSession()

    await newLlm().agentSession({ codemode: true })

    // Without a reload the codemode/tool_search/MCP factories never run and
    // their tools stay unavailable even though the options were requested.
    expect(piMocks.loaderReloads).toBe(1)
  })

  it('reloads a system-prompt-only loader too', async () => {
    stubSession()

    await newLlm().agentSession({ system: 'custom' })

    expect(piMocks.loaderReloads).toBe(1)
  })

  it('does not reload when no loader is built at all', async () => {
    stubSession()

    await newLlm().agentSession({})

    expect(piMocks.loaderReloads).toBe(0)
  })

  it('does not bind for a system-prompt-only loader (no extension factories)', async () => {
    const bindExtensions = stubSession()

    await newLlm().agentSession({ system: 'custom' })

    expect(piMocks.loaderOptions.at(-1)?.systemPrompt).toBe('custom')
    expect(bindExtensions).not.toHaveBeenCalled()
  })

  it('does not bind when no loader is built at all', async () => {
    const bindExtensions = stubSession()

    await newLlm().agentSession({})

    expect(piMocks.loaderOptions).toHaveLength(0)
    expect(bindExtensions).not.toHaveBeenCalled()
  })

  it('releases a durable name when the session build fails, so it can be retried', async () => {
    vi.spyOn(SessionManager, 'list').mockResolvedValue([])
    vi.spyOn(SessionManager, 'create').mockReturnValue({
      appendSessionInfo: vi.fn(),
      getSessionFile: () => BOOM,
    } as unknown as SessionManager)
    piMocks.createAgentSession.mockRejectedValue(new Error('build failed'))
    const llm = newLlm()

    await expect(llm.agentSession({ session: 'boom' })).rejects.toThrow('build failed')

    // A leaked claim would fail the retry with VALIDATION('already open').
    await expect(llm.agentSession({ session: 'boom' })).rejects.toThrow('build failed')
  })
})

describe('Llm non-chat models (classify / generateImages / modelsOfType / pickOfType)', () => {
  const newLlm = () => new Llm(new Context())

  beforeEach(() => {
    for (const fn of Object.values(piMocks.registry)) fn.mockReset()
  })

  it('modelsOfType forwards the type and provider to the registry', async () => {
    const models = [{ id: 'fake/cls' }]
    piMocks.registry.getModelsOfType.mockReturnValue(models)

    await expect(newLlm().modelsOfType('classifier', 'fake')).resolves.toBe(models)
    expect(piMocks.registry.getModelsOfType).toHaveBeenCalledWith('classifier', 'fake')
  })

  it('pickOfType resolves an explicit `provider/id` without a suffix search', async () => {
    const hit = { id: 'cls' }
    piMocks.registry.getModelOfType.mockReturnValue(hit)

    await expect(newLlm().pickOfType('classifier', 'fake/cls')).resolves.toBe(hit)
    expect(piMocks.registry.getModelOfType).toHaveBeenCalledWith('classifier', 'fake', 'cls')
    expect(piMocks.registry.getModelsOfType).not.toHaveBeenCalled()
  })

  it('pickOfType matches a bare id by suffix when no provider is given', async () => {
    const hit = { id: 'vendor/cls' }
    piMocks.registry.getModelsOfType.mockReturnValue([hit])

    await expect(newLlm().pickOfType('classifier', 'cls')).resolves.toBe(hit)
    expect(piMocks.registry.getModelsOfType).toHaveBeenCalledWith('classifier')
    expect(piMocks.registry.getAvailableOfType).not.toHaveBeenCalled()
  })

  it('pickOfType falls back to the first credentialed model of that type', async () => {
    const hit = { id: 'any/image' }
    piMocks.registry.getAvailableOfType.mockResolvedValue([hit])

    await expect(newLlm().pickOfType('image')).resolves.toBe(hit)
    expect(piMocks.registry.getAvailableOfType).toHaveBeenCalledWith('image')
  })

  it('pickOfType returns undefined when nothing of that type has credentials', async () => {
    piMocks.registry.getAvailableOfType.mockResolvedValue([])

    await expect(newLlm().pickOfType('image')).resolves.toBeUndefined()
  })

  it('classify bills usage to the provider/model that answered', async () => {
    const result = { provider: 'fake', model: 'cls-1', usage: FAKE_USAGE, stopReason: 'stop' }
    piMocks.registry.classify.mockResolvedValue(result)
    const llm = newLlm()
    const record = vi.spyOn(llm, 'recordUsage').mockImplementation(() => {})

    await expect(llm.classify({} as never, {} as never)).resolves.toBe(result)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0][0]).toBe('fake/cls-1')
    expect(record.mock.calls[0][1]).toBe(FAKE_USAGE)
  })

  it('classify records nothing when the service reported no token counts', async () => {
    piMocks.registry.classify.mockResolvedValue({ provider: 'fake', model: 'cls-1' })
    const llm = newLlm()
    const record = vi.spyOn(llm, 'recordUsage').mockImplementation(() => {})

    await llm.classify({} as never, {} as never)

    expect(record).not.toHaveBeenCalled()
  })

  it('generateImages passes through to the registry and bills its usage', async () => {
    const result = { provider: 'fake', model: 'img-1', usage: FAKE_USAGE }
    piMocks.registry.generateImages.mockResolvedValue(result)
    const llm = newLlm()
    const record = vi.spyOn(llm, 'recordUsage').mockImplementation(() => {})

    await expect(llm.generateImages({} as never, {} as never)).resolves.toBe(result)
    expect(record.mock.calls[0][0]).toBe('fake/img-1')
  })

  it('generateImages records nothing when the service reported no token counts', async () => {
    piMocks.registry.generateImages.mockResolvedValue({ provider: 'fake', model: 'img-1' })
    const llm = newLlm()
    const record = vi.spyOn(llm, 'recordUsage').mockImplementation(() => {})

    await llm.generateImages({} as never, {} as never)

    expect(record).not.toHaveBeenCalled()
  })
})
