/**
 * α ACP connection-pool tests — run against the offline mock ACP server, so no
 * network and no real agent CLI is required.
 *
 * The mock appends its pid to MOCK_ACP_START_LOG on boot, which lets us count
 * how many server processes were spawned. Pool reuse means: N calls, one pid.
 */

import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@cordisjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acpPlugin } from '../plugins/acp.ts'
import { runAcpPrompt } from './acp-client.ts'
import type { AcpConfig } from './acp-service.ts'
import { Letters } from './letters.ts'
import { Trace } from './trace.ts'

const MOCK = fileURLToPath(new URL('../testing/acp-mock-server.mjs', import.meta.url))

let ctx: Context | undefined

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  await ctx?.stop()
  ctx = undefined
  vi.restoreAllMocks()
})

async function boot(config: AcpConfig = {}): Promise<Context> {
  const c = new Context()
  c.plugin({
    name: 'test-core',
    apply(c: Context) {
      c.plugin(Trace)
      c.plugin(Letters)
    },
  })
  c.plugin(acpPlugin, config)
  await c.start()
  ctx = c
  return c
}

function alpha(c: Context) {
  const fn = c.letters.get('α')
  if (!fn) throw new Error('α not registered')
  return fn
}

async function newLog(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pizx-acp-pool-'))
  return join(dir, 'starts.log')
}

async function starts(log: string): Promise<string[]> {
  try {
    return (await readFile(log, 'utf-8')).trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function serverEnv(log: string, mode = 'ok'): Record<string, string> {
  return {
    MOCK_ACP_MODE: mode,
    MOCK_ACP_START_LOG: log,
    MOCK_ACP_EVENT_LOG: `${log}.events`,
  }
}

async function events(log: string, kind: string): Promise<string[]> {
  try {
    return (await readFile(`${log}.events`, 'utf-8'))
      .trim()
      .split('\n')
      .filter((line) => line.startsWith(kind))
  } catch {
    return []
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Poll until `predicate` holds, so timing-sensitive tests don't rely on a fixed sleep. */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await sleep(10)
  }
  throw new Error('condition not met before timeout')
}

describe('α connection pool', () => {
  it('reuses one server process across sequential calls', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)
    const env = serverEnv(log)

    const first = await α.quiet({ server: [process.execPath, MOCK], env })`one`
    const second = await α.quiet({ server: [process.execPath, MOCK], env })`two`

    expect(first.text).toContain('Hello from the mock agent')
    expect(second.text).toContain('Hello from the mock agent')
    expect(await starts(log)).toHaveLength(1)
    expect(c.acp.size).toBe(1)
  })

  it('runs each call in a fresh session (no conversation bleed)', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)
    const env = serverEnv(log, 'session-echo')

    const first = await α.quiet({ server: [process.execPath, MOCK], env })`one`
    const second = await α.quiet({ server: [process.execPath, MOCK], env })`two`

    // session-echo appends the session id, so distinct ids prove fresh sessions.
    expect(first.text).not.toBe(second.text)
    expect(await starts(log)).toHaveLength(1)
  })

  it('serves concurrent calls from a single process', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)
    const env = serverEnv(log, 'session-echo')

    const results = await Promise.all(
      [1, 2, 3].map((i) => α.quiet({ server: [process.execPath, MOCK], env })`p${i}`)
    )

    expect(new Set(results.map((r) => r.text)).size).toBe(3)
    expect(await starts(log)).toHaveLength(1)
    expect(c.acp.size).toBe(1)
  })

  it('pools by cwd — a different directory gets its own process', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)
    const env = serverEnv(log)
    const dirA = await mkdtemp(join(tmpdir(), 'pizx-acp-a-'))
    const dirB = await mkdtemp(join(tmpdir(), 'pizx-acp-b-'))

    await α.quiet({ server: [process.execPath, MOCK], env, cwd: dirA })`a`
    await α.quiet({ server: [process.execPath, MOCK], env, cwd: dirB })`b`

    expect(await starts(log)).toHaveLength(2)
    expect(c.acp.size).toBe(2)
  })

  it('closes each agent-side session when the agent supports it', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)
    const env = serverEnv(log)

    await α.quiet({ server: [process.execPath, MOCK], env })`one`
    await α.quiet({ server: [process.execPath, MOCK], env })`two`
    await α.quiet({ server: [process.execPath, MOCK], env })`three`

    // Pooling creates one session per call; a supporting agent must see them closed.
    expect(await events(log, 'new')).toHaveLength(3)
    expect(await events(log, 'close')).toHaveLength(3)
    expect(await starts(log)).toHaveLength(1)
  })

  it('cancels only the timed-out session, leaving siblings and the connection healthy', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)
    const env = serverEnv(log, 'cancel')

    const [slow, fast] = await Promise.allSettled([
      α.quiet({ server: [process.execPath, MOCK], env, timeoutMs: 200 })`HANG`,
      α.quiet({ server: [process.execPath, MOCK], env })`fast`,
    ])

    expect(slow.status).toBe('rejected')
    expect((slow as PromiseRejectedResult).reason.message).toMatch(/timed out after 200ms/)
    expect(fast.status).toBe('fulfilled')
    expect((fast as PromiseFulfilledResult<{ text: string }>).value.text).toContain(
      'Hello from the mock agent'
    )

    // The timed-out turn was cancelled in place — the shared process survived.
    expect(await starts(log)).toHaveLength(1)
    expect(c.acp.size).toBe(1)
  })

  it('evicts an idle connection after idleMs and respawns on the next call', async () => {
    const log = await newLog()
    const c = await boot({ idleMs: 40 })
    const α = alpha(c)
    const env = serverEnv(log)

    await α.quiet({ server: [process.execPath, MOCK], env })`one`
    expect(c.acp.size).toBe(1)

    await waitFor(() => c.acp.size === 0)

    await α.quiet({ server: [process.execPath, MOCK], env })`two`
    expect(await starts(log)).toHaveLength(2)
  })

  it('kills pooled servers on dispose', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)

    await α.quiet({ server: [process.execPath, MOCK], env: serverEnv(log) })`one`
    const acp = c.acp
    expect(acp.size).toBe(1)

    await c.stop()
    ctx = undefined
    expect(acp.size).toBe(0)
  })

  it('does not pool the one-shot runAcpPrompt helper', async () => {
    const log = await newLog()
    const env = serverEnv(log)

    await runAcpPrompt({ server: [process.execPath, MOCK], prompt: 'one', env })
    await runAcpPrompt({ server: [process.execPath, MOCK], prompt: 'two', env })

    expect(await starts(log)).toHaveLength(2)
  })

  it('leaves no pending pool entry when a server cannot be started', async () => {
    const c = await boot()
    const α = alpha(c)

    await expect(α.quiet({ server: ['pizx-command-that-does-not-exist'] })`hello`).rejects.toThrow(
      'cannot start ACP server'
    )
    expect(c.acp.size).toBe(0)

    // A second attempt must not be blocked by a stale in-flight entry.
    await expect(α.quiet({ server: ['pizx-command-that-does-not-exist'] })`hello`).rejects.toThrow(
      'cannot start ACP server'
    )
    expect(c.acp.size).toBe(0)
  })

  it('evicts a connection that dies mid-turn', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)

    await expect(
      α.quiet({ server: [process.execPath, MOCK], env: serverEnv(log, 'bad-exit') })`boom`
    ).rejects.toThrow(/exited with code 3/)

    expect(c.acp.size).toBe(0)
  })

  it('pools streaming calls too', async () => {
    const log = await newLog()
    const c = await boot()
    const α = alpha(c)
    const env = serverEnv(log)

    const read = async (): Promise<string> => {
      let text = ''
      for await (const chunk of α({ server: [process.execPath, MOCK], env }).stream`x`) {
        text += chunk
      }
      return text
    }

    expect(await read()).toContain('Hello from the mock agent')
    expect(await read()).toContain('Hello from the mock agent')
    expect(await starts(log)).toHaveLength(1)
  })

  it('spawns a fresh process per call when pooling is disabled by config', async () => {
    const log = await newLog()
    const c = await boot({ pool: false })
    const α = alpha(c)
    const env = serverEnv(log)

    await α.quiet({ server: [process.execPath, MOCK], env })`one`
    await α.quiet({ server: [process.execPath, MOCK], env })`two`

    expect(await starts(log)).toHaveLength(2)
    expect(c.acp.size).toBe(0)
  })

  it('honors PIZX_ACP_POOL=0 as an operational kill switch', async () => {
    const previous = process.env.PIZX_ACP_POOL
    process.env.PIZX_ACP_POOL = '0'
    try {
      const log = await newLog()
      const c = await boot()
      const α = alpha(c)
      const env = serverEnv(log)

      await α.quiet({ server: [process.execPath, MOCK], env })`one`
      await α.quiet({ server: [process.execPath, MOCK], env })`two`

      expect(await starts(log)).toHaveLength(2)
      expect(c.acp.size).toBe(0)
    } finally {
      if (previous === undefined) delete process.env.PIZX_ACP_POOL
      else process.env.PIZX_ACP_POOL = previous
    }
  })
})
