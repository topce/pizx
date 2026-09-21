/**
 * pizx ACP service — pools ACP server processes for the α letter.
 *
 * Every α invocation used to spawn a fresh server process, do the initialize
 * handshake, create a session, run one turn, and kill the process. Spawning
 * plus handshake dominates the cost (measured: ~30 ms even for a trivial
 * mock, hundreds of ms for a real CLI). This service keeps one live
 * connection per { server, cwd, env } key and reuses it across calls.
 *
 * Each call still runs in a **fresh session**, so turns never share
 * conversation state (no bleed). Connections unref their handles while idle
 * and are killed on app dispose (or after `idleMs` of inactivity), so a
 * script that forgets to dispose still exits and leaves no orphan.
 *
 * This mirrors the session pooling `ctx.llm.agentSession` already does for Π.
 */

import { resolve } from 'node:path'
import { type Context, Service } from '@cordisjs/core'
import {
  AcpConnection,
  type AcpRunOptions,
  type AcpRunResult,
  type AcpStreamOptions,
  runAcpPrompt,
  streamAcpPrompt,
} from './acp-client.ts'
import { PizxError } from './errors.ts'

const PREFIX = 'pizx/α'

export interface AcpConfig {
  /**
   * Kill an idle pooled server after this many ms of inactivity.
   * Default 60_000. Set 0 to keep connections until dispose.
   */
  idleMs?: number
  /**
   * Reuse server processes across calls. Default true. Set false (or
   * `PIZX_ACP_POOL=0`) to spawn a fresh process per call — the escape hatch
   * for agents that do not behave well when a connection is reused.
   */
  pool?: boolean
}

declare module '@cordisjs/core' {
  interface Context {
    acp: Acp
  }
}

/** Stable pool key over every option that changes the server process. */
function poolKey(server: string[], cwd: string, env?: Record<string, string>): string {
  const normalizedEnv = env
    ? Object.fromEntries(Object.entries(env).sort(([a], [b]) => a.localeCompare(b)))
    : null
  return JSON.stringify({ server, cwd, env: normalizedEnv })
}

/** Operational kill switch: `PIZX_ACP_POOL=0` (or `false`) disables pooling. */
function poolEnabledFromEnv(): boolean {
  const value = process.env.PIZX_ACP_POOL
  return value !== '0' && value !== 'false'
}

export class Acp extends Service<AcpConfig> {
  private readonly pool = new Map<string, AcpConnection>()
  /** In-flight `open()` calls, so concurrent first calls share one process. */
  private readonly pending = new Map<string, Promise<AcpConnection>>()
  private readonly idleMs: number
  private readonly poolEnabled: boolean
  private disposed = false

  constructor(ctx: Context, config: AcpConfig = {}) {
    super(ctx, 'acp')
    this.config = config
    this.idleMs = config.idleMs ?? 60_000
    this.poolEnabled = config.pool ?? poolEnabledFromEnv()
  }

  /** Number of live pooled connections (diagnostics and tests). */
  get size(): number {
    return this.pool.size
  }

  protected stop(): void {
    this.disposeAll()
  }

  /** Close every pooled connection and kill its server process. */
  disposeAll(): void {
    this.disposed = true
    for (const conn of this.pool.values()) conn.close()
    this.pool.clear()
  }

  /** Run one prompt turn (pooled by default; one-shot when pooling is disabled). */
  async runPrompt(opts: AcpRunOptions): Promise<AcpRunResult> {
    if (!this.poolEnabled) return runAcpPrompt(opts)
    const conn = await this.acquire(opts)
    try {
      return await conn.runTurn(opts.prompt, opts)
    } catch (err) {
      if (!conn.isAlive()) this.evict(conn)
      throw err
    }
  }

  /** Stream one prompt turn (pooled by default; one-shot when pooling is disabled). */
  async *streamPrompt(opts: AcpStreamOptions): AsyncGenerator<string> {
    if (!this.poolEnabled) {
      yield* streamAcpPrompt(opts)
      return
    }
    const conn = await this.acquire(opts)
    try {
      yield* conn.streamTurn(opts.prompt, opts)
    } catch (err) {
      if (!conn.isAlive()) this.evict(conn)
      throw err
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async acquire(opts: AcpRunOptions): Promise<AcpConnection> {
    if (!opts.server || opts.server.length === 0) {
      throw new PizxError(
        'VALIDATION',
        `${PREFIX}: no ACP server specified — pass { server: ['kiro-cli', 'acp'] } or any other ` +
          'ACP-compatible agent command'
      )
    }

    const cwd = resolve(opts.cwd ?? process.cwd())
    const key = poolKey(opts.server, cwd, opts.env)

    const existing = this.pool.get(key)
    if (existing) {
      if (existing.isAlive()) return existing
      existing.close()
      this.pool.delete(key)
    }

    // A concurrent first call is already opening this key — share its process
    // instead of spawning a second one.
    const inflight = this.pending.get(key)
    if (inflight) return inflight

    const opening = AcpConnection.open({
      server: opts.server,
      cwd,
      env: opts.env,
      timeoutMs: opts.timeoutMs,
      idleMs: this.idleMs,
      onClose: (dead) => {
        if (this.pool.get(key) === dead) this.pool.delete(key)
      },
    }).then(
      (conn) => {
        this.pending.delete(key)
        // A connection that finished opening after teardown must not leak.
        if (this.disposed) {
          conn.close()
          return conn
        }
        this.pool.set(key, conn)
        return conn
      },
      (err) => {
        this.pending.delete(key)
        throw err
      }
    )
    this.pending.set(key, opening)
    return opening
  }

  private evict(conn: AcpConnection): void {
    for (const [key, value] of this.pool) {
      if (value === conn) this.pool.delete(key)
    }
    conn.close()
  }
}
