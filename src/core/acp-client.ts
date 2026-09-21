/**
 * pizx ACP client — a minimal, general client for the Agent Client Protocol
 * (https://agentclientprotocol.com), built on the official
 * @agentclientprotocol/sdk.
 *
 * The client speaks to any ACP v1 agent server over newline-delimited stdio
 * (initialize → session/new → session/prompt → session/update → stop) and
 * returns the aggregated text. It has no relationship to pi: the server is an
 * explicit command line, e.g. ['kiro-cli', 'acp'] or ['npx', '@github/copilot',
 * '--acp'].
 *
 * Two layers live here:
 * - `AcpConnection` — one live server process + ACP connection, able to run
 *   many prompt turns (each in a fresh session). `AcpConnection.open()` spawns
 *   and initializes; `close()` tears down.
 * - `runAcpPrompt` / `streamAcpPrompt` — one-shot helpers that open a
 *   connection, run a single turn, and close it again.
 *
 * Pooling (reusing one process across calls) is owned by the `Acp` service in
 * `acp-service.ts`, which keys connections by { server, cwd, env }.
 *
 * Behavior notes:
 * - Tool permissions are auto-approved (allow_always > allow_once).
 * - File-system requests delegated to the client are served honestly.
 * - Idle pooled connections unref their handles so a script can still exit
 *   naturally; a process-exit hook kills any surviving children.
 * - stderr of the agent is mirrored to our stderr and kept as a tail for
 *   error diagnostics.
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { Readable, Writable } from 'node:stream'
import type {
  ReadTextFileRequest,
  RequestPermissionRequest,
  SessionUpdate,
  Usage,
  WriteTextFileRequest,
} from '@agentclientprotocol/sdk'
import * as acp from '@agentclientprotocol/sdk'
import { version as pizxVersion } from '../../package.json'
import { isPizxError, PizxError } from './errors.ts'
import { getErrorMessage } from './utils.ts'

// ── Types ───────────────────────────────────────────────────────────────────

/** A tool call reported by the agent (tool_call / tool_call_update). */
export interface AcpToolEvent {
  toolCallId: string
  title: string
  status: string
}

/** Token usage reported by the agent in the final prompt response. */
export interface AcpUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
}

export interface AcpRunOptions {
  /** Server command line: argv[0] + arguments. Required, no default. */
  server: string[]
  /** The user prompt sent to the agent. */
  prompt: string
  /** Working directory handed to the agent. Defaults to process.cwd(). */
  cwd?: string
  /** Extra environment variables for the server process. */
  env?: Record<string, string>
  /**
   * Timeout in ms for the `initialize` handshake and, unless a turn overrides
   * it, for each prompt turn. Omit for no timeout.
   */
  timeoutMs?: number
  /** Called for every text chunk as it streams in. */
  onText?: (chunk: string) => void
  /** Called for every tool-call progress update. */
  onToolCall?: (ev: AcpToolEvent) => void
  /** Called once with the final prompt-response usage, when the agent reports it. */
  onUsage?: (usage: AcpUsage) => void
}

export interface AcpRunResult {
  /** Aggregated assistant text ('' when the agent produced none). */
  text: string
  /** The final stopReason of the prompt turn. */
  stopReason: string
  /** The server command line, for output/trace attribution. */
  serverLabel: string
  /** Number of distinct tool calls reported during the turn. */
  toolCallCount: number
}

/** Options for opening a pooled connection. */
export interface AcpConnectionOptions {
  /** Server command line: argv[0] + arguments. */
  server: string[]
  /** Absolute working directory handed to the agent. */
  cwd: string
  /** Extra environment variables for the server process. */
  env?: Record<string, string>
  /** Handshake timeout in ms. Also the default per-turn timeout for turns that do not set one. */
  timeoutMs?: number
  /** Kill the connection after this many ms idle; 0 disables. */
  idleMs?: number
  /** Called when a pooled connection becomes unusable (crash or idle eviction). */
  onClose?: (conn: AcpConnection) => void
}

/** Per-turn options (a connection may serve many turns). */
export interface AcpTurnOptions {
  timeoutMs?: number
  onText?: (chunk: string) => void
  onToolCall?: (ev: AcpToolEvent) => void
  onUsage?: (usage: AcpUsage) => void
}

/**
 * Per-turn options for a streaming turn. Text is delivered by the async
 * iterator, so `onText` is intentionally not part of this contract.
 */
export type AcpStreamTurnOptions = Omit<AcpTurnOptions, 'onText'>

/**
 * Options for streaming a prompt. Text is delivered by the async iterator, so
 * `onText` is intentionally not part of this contract.
 */
export type AcpStreamOptions = Omit<AcpRunOptions, 'onText'>

// ── Internals ───────────────────────────────────────────────────────────────

const PREFIX = 'pizx/α'
/** Keep at most this many stderr bytes for error diagnostics. */
const STDERR_TAIL_BYTES = 4096
/** Grace period for an agent to honor `session/cancel` before the connection is torn down. */
const CANCEL_GRACE_MS = 1000

/** Child stdio pipes expose ref/unref even though their public type does not. */
interface Refable {
  ref?: () => void
  unref?: () => void
}

/**
 * Every live child is tracked so a `process.on('exit')` hook can kill it. This
 * is the safety net for consumers that never call `dispose()` — a pooled
 * process must not outlive the script that spawned it.
 */
const liveChildren = new Set<ChildProcess>()
let exitHookInstalled = false

function trackChild(child: ChildProcess): void {
  liveChildren.add(child)
  if (!exitHookInstalled) {
    exitHookInstalled = true
    process.once('exit', () => {
      for (const c of liveChildren) {
        try {
          c.kill()
        } catch {
          // best-effort
        }
      }
    })
  }
}

function untrackChild(child: ChildProcess | undefined): void {
  if (child) liveChildren.delete(child)
}

function setRef(handle: Refable | null | undefined, ref: boolean): void {
  try {
    if (ref) handle?.ref?.()
    else handle?.unref?.()
  } catch {
    // best-effort
  }
}

function serverLabel(server: string[]): string {
  return server.join(' ')
}

/** npx needs its .cmd shim on Windows. */
function normalizeCommand(command: string): string {
  if (command === 'npx' && process.platform === 'win32') return 'npx.cmd'
  return command
}

/** Resolve true when `promise` settles (either way) within `ms`; false on timeout. */
async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  const settled = promise.then(
    () => true,
    () => true
  )
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms)
    timer.unref?.()
  })
  const result = await Promise.race([settled, timedOut])
  if (timer) clearTimeout(timer)
  return result
}

async function wrapError(
  err: unknown,
  server: string[],
  child: ChildProcess,
  stderrTail: string
): Promise<Error> {
  const message = err instanceof Error ? err.message : String(err)

  if (isPizxError(err)) return err

  // A failed spawn surfaces as an ENOENT-style error event.
  if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
    return new PizxError(
      'ACP',
      `${PREFIX}: cannot start ACP server '${serverLabel(server)}': command not found — ` +
        'install the agent CLI or pass a working { server: [...] } command',
      { cause: err }
    )
  }

  // The stream-close rejection can race the child's 'exit' event; give the
  // exit state a moment to land so non-zero exits report their stderr tail.
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 200)),
    ])
  }

  const tail = stderrTail.trim()
  if (child.exitCode !== null && child.exitCode !== 0) {
    return new PizxError(
      'ACP',
      `${PREFIX}: ACP server '${serverLabel(server)}' exited with code ${child.exitCode}` +
        (tail ? `:\n${tail}` : ''),
      { cause: err }
    )
  }
  if (child.signalCode) {
    return new PizxError(
      'ACP',
      `${PREFIX}: ACP server '${serverLabel(server)}' was killed by signal ${child.signalCode}` +
        (tail ? `:\n${tail}` : ''),
      { cause: err }
    )
  }
  if (child.exitCode === 0) {
    return new PizxError(
      'ACP',
      `${PREFIX}: ACP server '${serverLabel(server)}' closed the connection unexpectedly ` +
        `(exit code 0) — the agent may be unauthenticated, misconfigured, or unsupported in this environment` +
        (tail ? `:\n${tail}` : ''),
      { cause: err }
    )
  }

  if (/auth|authenticate/i.test(message)) {
    return new PizxError(
      'ACP',
      `${PREFIX}: the agent requires authentication, which is not supported yet`,
      { cause: err }
    )
  }

  return new PizxError('ACP', `${PREFIX}: ACP agent failed: ${message}`, { cause: err })
}

function autoApprove(params: RequestPermissionRequest): acp.RequestPermissionResponse {
  // Prefer a blanket allow, then a one-shot allow, then give up.
  const pick = (kind: string) => params.options.find((o) => o.kind === kind)
  const option = pick('allow_always') ?? pick('allow_once')
  if (!option) {
    return { outcome: { outcome: 'cancelled' } }
  }
  return { outcome: { outcome: 'selected', optionId: option.optionId } }
}

/**
 * Resolve an agent-requested path against the session `cwd` and require it to
 * stay inside that directory. Agent input is untrusted, so this is the
 * boundary check that keeps a configured ACP server from reading/writing
 * arbitrary files as the invoking user.
 */
function resolveWithin(root: string, target: string): string {
  const resolved = resolve(root, target)
  const rel = relative(root, resolved)
  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) {
    throw new PizxError(
      'ACP',
      `${PREFIX}: path '${target}' is outside the session working directory`
    )
  }
  return resolved
}

async function handleReadTextFile(
  params: ReadTextFileRequest,
  cwd: string
): Promise<acp.ReadTextFileResponse> {
  const path = resolveWithin(cwd, params.path)
  const content = await readFile(path, 'utf-8')
  const lines = content.split('\n')
  const start = Math.max(0, (params.line ?? 1) - 1)
  const end = params.limit && params.limit > 0 ? start + params.limit : lines.length
  return { content: lines.slice(start, end).join('\n') }
}

async function handleWriteTextFile(
  params: WriteTextFileRequest,
  cwd: string
): Promise<acp.WriteTextFileResponse> {
  const path = resolveWithin(cwd, params.path)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, params.content, 'utf-8')
  return {}
}

function normalizeUsage(usage: Usage): AcpUsage {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadTokens: usage.cachedReadTokens ?? 0,
    cacheWriteTokens: usage.cachedWriteTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
  }
}

function toolEventFromUpdate(update: SessionUpdate): AcpToolEvent | undefined {
  if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
    return undefined
  }
  // tool_call carries a full title; tool_call_update may only patch status.
  return {
    toolCallId: update.toolCallId,
    title: 'title' in update && update.title ? update.title : update.toolCallId,
    status: update.status ?? 'unknown',
  }
}

// ── Connection ──────────────────────────────────────────────────────────────

/**
 * One live ACP server process + connection. A connection can serve many prompt
 * turns; each turn runs in its own session, so turns never share conversation
 * state.
 */
export class AcpConnection {
  private readonly server: string[]
  private readonly cwd: string
  private readonly env: Record<string, string> | undefined
  private readonly label: string
  private readonly defaultTimeoutMs: number | undefined
  private readonly idleMs: number
  private readonly onClose: ((conn: AcpConnection) => void) | undefined

  private child: ChildProcess | undefined
  private connection: acp.ClientConnection | undefined
  private client: acp.ClientContext | undefined
  private stderrTail = ''
  private sessionCloseSupported = false
  private inflight = 0
  private dead = false
  private closing = false
  private idleTimer: NodeJS.Timeout | undefined

  private constructor(opts: AcpConnectionOptions) {
    this.server = opts.server
    this.cwd = opts.cwd
    this.env = opts.env
    this.label = serverLabel(opts.server)
    this.defaultTimeoutMs = opts.timeoutMs
    this.idleMs = opts.idleMs ?? 0
    this.onClose = opts.onClose
  }

  /** Spawn the server and perform the ACP initialize handshake. */
  static async open(opts: AcpConnectionOptions): Promise<AcpConnection> {
    assertServer(opts.server)
    const conn = new AcpConnection(opts)
    await conn.connect()
    return conn
  }

  /** True while the process is running and the ACP connection is open. */
  isAlive(): boolean {
    if (this.dead || this.closing) return false
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) return false
    return !this.connection?.signal.aborted
  }

  /**
   * Run one prompt turn in a fresh session on this connection. A connection
   * may run several turns concurrently: the SDK routes updates per session id.
   */
  async runTurn(prompt: string, turn: AcpTurnOptions = {}): Promise<AcpRunResult> {
    return this.runTracked(prompt, turn, true)
  }

  /**
   * Shared lifecycle for a turn: mark it in-flight (so idle eviction waits),
   * run it, then release the connection back to the pool. A timeout is handled
   * inside `runTurnWork` by cancelling the session, so it never tears down a
   * connection that concurrent turns are still using.
   */
  private async runTracked(
    prompt: string,
    turn: AcpTurnOptions,
    collectText: boolean
  ): Promise<AcpRunResult> {
    if (!this.isAlive()) {
      throw new PizxError('ACP', `${PREFIX}: ACP server '${this.label}' is not running`)
    }

    this.inflight += 1
    this.setRefs(true)
    this.clearIdle()

    try {
      return await this.runTurnWork(prompt, turn, collectText)
    } catch (err) {
      // Only a dead process is evicted here; a per-turn timeout has already
      // decided (in runTurnWork) whether the connection was wedged.
      if (!this.isAlive()) this.close()
      throw await this.wrap(err)
    } finally {
      this.inflight -= 1
      if (this.inflight === 0 && this.isAlive()) {
        this.setRefs(false)
        this.scheduleIdle()
      }
    }
  }

  /** Run one prompt turn, yielding text chunks as they arrive. */
  async *streamTurn(prompt: string, turn: AcpStreamTurnOptions = {}): AsyncGenerator<string> {
    const queue: string[] = []
    let waiting: ((chunk: string | undefined) => void) | undefined
    let done = false
    let error: unknown

    const work = this.runTracked(
      prompt,
      {
        ...turn,
        onText: (chunk) => {
          if (waiting) {
            const resolve = waiting
            waiting = undefined
            resolve(chunk)
          } else {
            queue.push(chunk)
          }
        },
      },
      false
    )
    void work.then(
      () => {
        done = true
        waiting?.(undefined)
      },
      (err) => {
        error = err
        done = true
        waiting?.(undefined)
      }
    )

    for (;;) {
      if (queue.length > 0) {
        yield queue.shift() as string
      } else if (done) {
        if (error) {
          throw error instanceof Error ? error : new Error(getErrorMessage(error))
        }
        return
      } else {
        const chunk = await new Promise<string | undefined>((resolve) => {
          waiting = resolve
        })
        if (chunk !== undefined) yield chunk
      }
    }
  }

  /** Close the connection and kill the server process. Idempotent. */
  close(): void {
    if (this.dead) {
      this.killChild()
      return
    }
    this.closing = true
    this.clearIdle()
    try {
      this.connection?.close()
    } catch {
      // best-effort
    }
    this.killChild()
    this.dead = true
    untrackChild(this.child)
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    const [command, ...args] = this.server
    const child = spawn(normalizeCommand(command), args, {
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
    })
    this.child = child
    trackChild(child)

    child.stderr?.on('data', (chunk: Buffer) => {
      this.stderrTail = `${this.stderrTail}${chunk.toString('utf-8')}`.slice(-STDERR_TAIL_BYTES)
      process.stderr.write(chunk)
    })

    const spawnError = new Promise<never>((_, reject) => child.once('error', reject))
    spawnError.catch(() => {})

    if (!child.stdin || !child.stdout) {
      this.close()
      throw await this.wrap(new Error('server produced no stdio pipes'))
    }

    const input = Writable.toWeb(child.stdin)
    const output = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    const stream = acp.ndJsonStream(input, output)

    const app = acp
      .client({ name: 'pizx' })
      .onRequest(acp.methods.client.session.requestPermission, ({ params }) => autoApprove(params))
      .onRequest(acp.methods.client.fs.readTextFile, ({ params }) =>
        handleReadTextFile(params, this.cwd)
      )
      .onRequest(acp.methods.client.fs.writeTextFile, ({ params }) =>
        handleWriteTextFile(params, this.cwd)
      )

    this.connection = app.connect(stream)
    this.client = this.connection.agent
    // A remote close is only "unexpected" when we did not ask for it.
    this.connection.closed.then(
      () => this.markDead(),
      () => this.markDead()
    )

    try {
      const initialized = this.client.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
        clientInfo: { name: 'pizx', version: pizxVersion },
      })
      initialized.catch(() => {})
      const response = await this.withTimeout(
        Promise.race([initialized, spawnError]),
        this.defaultTimeoutMs
      )
      this.sessionCloseSupported = Boolean(response.agentCapabilities?.sessionCapabilities?.close)
    } catch (err) {
      this.close()
      throw await this.wrap(err)
    }
  }

  private async runTurnWork(
    prompt: string,
    turn: AcpTurnOptions,
    collectText: boolean
  ): Promise<AcpRunResult> {
    const client = this.client
    if (!client) throw new PizxError('ACP', `${PREFIX}: ACP connection is not initialized`)

    const session = await client.buildSession(this.cwd).start()
    try {
      const drain = this.drainSession(session, prompt, turn, collectText)
      // The drain may settle after a timeout (the agent honours cancel late);
      // never let that surface as an unhandled rejection.
      drain.catch(() => {})

      const timeoutMs = turn.timeoutMs ?? this.defaultTimeoutMs
      if (timeoutMs && !(await settlesWithin(drain, timeoutMs))) {
        await this.cancelAndSettle(client, session, drain)
        throw new PizxError(
          'ACP',
          `${PREFIX}: ACP server '${this.label}' timed out after ${timeoutMs}ms`
        )
      }

      const { text, stopReason, toolCallCount } = await drain
      return { text, stopReason, serverLabel: this.label, toolCallCount }
    } finally {
      await this.closeSession(client, session.sessionId)
      session.dispose()
    }
  }

  /** Read updates from one session until the prompt turn stops. */
  private async drainSession(
    session: acp.ActiveSession,
    prompt: string,
    turn: AcpTurnOptions,
    collectText: boolean
  ): Promise<{ text: string; stopReason: string; toolCallCount: number }> {
    let text = ''
    const toolCallIds = new Set<string>()
    void session.prompt(prompt)
    for (;;) {
      const message = await session.nextUpdate()
      if (message.kind === 'stop') {
        if (message.response.usage) turn.onUsage?.(normalizeUsage(message.response.usage))
        return { text, stopReason: message.stopReason, toolCallCount: toolCallIds.size }
      }

      const update = message.update
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        if (collectText) text += update.content.text
        turn.onText?.(update.content.text)
      }

      const toolEvent = toolEventFromUpdate(update)
      if (toolEvent) {
        toolCallIds.add(toolEvent.toolCallId)
        turn.onToolCall?.(toolEvent)
      }
    }
  }

  /**
   * Free the agent-side session so pooled connections do not accumulate one
   * session per call. Best-effort: only when the agent advertises the
   * capability, and never blocking on an unresponsive server.
   */
  private async closeSession(client: acp.ClientContext, sessionId: string): Promise<void> {
    if (!this.sessionCloseSupported || !this.isAlive()) return
    try {
      const closing = client.request(acp.methods.agent.session.close, { sessionId })
      closing.catch(() => {})
      await this.withTimeout(closing, CANCEL_GRACE_MS)
    } catch {
      // best-effort — the connection may have closed during the turn
    }
  }

  /**
   * Ask the agent to cancel only this session, then give it a grace period to
   * settle. If it does not, the connection is wedged and is torn down — but a
   * cooperating agent leaves the connection healthy for concurrent turns.
   */
  private async cancelAndSettle(
    client: acp.ClientContext,
    session: acp.ActiveSession,
    drain: Promise<unknown>
  ): Promise<void> {
    try {
      await client.notify(acp.methods.agent.session.cancel, { sessionId: session.sessionId })
    } catch {
      // best-effort — a failed cancel is handled by the grace period below
    }
    if (!(await settlesWithin(drain, CANCEL_GRACE_MS))) this.close()
  }

  private markDead(): void {
    if (this.dead) return
    this.dead = true
    this.clearIdle()
    untrackChild(this.child)
    if (!this.closing) {
      this.killChild()
      this.onClose?.(this)
    }
  }

  private killChild(): void {
    const child = this.child
    if (!child) return
    untrackChild(child)
    try {
      child.kill()
    } catch {
      // best-effort
    }
  }

  private setRefs(ref: boolean): void {
    setRef(this.child, ref)
    setRef(this.child?.stdin as unknown as Refable, ref)
    setRef(this.child?.stdout as unknown as Refable, ref)
    setRef(this.child?.stderr as unknown as Refable, ref)
  }

  private clearIdle(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = undefined
    }
  }

  private scheduleIdle(): void {
    if (!this.idleMs || this.idleMs <= 0) return
    if (this.inflight > 0 || !this.isAlive()) return
    this.clearIdle()
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined
      if (this.inflight === 0) {
        this.close()
        // Explicit `close()` suppresses onClose; idle eviction must still let
        // the pool drop its reference to this dead connection.
        this.onClose?.(this)
      }
    }, this.idleMs)
    this.idleTimer.unref?.()
  }

  private async withTimeout<T>(work: Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs) return work
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new PizxError(
            'ACP',
            `${PREFIX}: ACP server '${this.label}' timed out after ${timeoutMs}ms`
          )
        )
      }, timeoutMs)
      timer.unref?.()
    })
    try {
      return await Promise.race([work, timeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private wrap(err: unknown): Promise<Error> {
    if (!this.child) return Promise.resolve(err instanceof Error ? err : new Error(String(err)))
    return wrapError(err, this.server, this.child, this.stderrTail)
  }
}

// ── One-shot public API ─────────────────────────────────────────────────────

function assertServer(server: string[] | undefined): asserts server is string[] {
  if (!server || server.length === 0) {
    throw new PizxError(
      'VALIDATION',
      `${PREFIX}: no ACP server specified — pass { server: ['kiro-cli', 'acp'] } or any other ` +
        'ACP-compatible agent command'
    )
  }
}

/** Validate options and open a fresh, non-pooled connection. */
async function openFresh(opts: AcpRunOptions): Promise<AcpConnection> {
  assertServer(opts.server)
  return AcpConnection.open({
    server: opts.server,
    cwd: resolve(opts.cwd ?? process.cwd()),
    env: opts.env,
    timeoutMs: opts.timeoutMs,
  })
}

/** Run one prompt turn against a fresh ACP server; returns the aggregated text. */
export async function runAcpPrompt(opts: AcpRunOptions): Promise<AcpRunResult> {
  const conn = await openFresh(opts)
  try {
    return await conn.runTurn(opts.prompt, {
      timeoutMs: opts.timeoutMs,
      onText: opts.onText,
      onToolCall: opts.onToolCall,
      onUsage: opts.onUsage,
    })
  } finally {
    conn.close()
  }
}

/** Stream one prompt turn against a fresh ACP server, yielding text chunks. */
export async function* streamAcpPrompt(opts: AcpStreamOptions): AsyncGenerator<string> {
  const conn = await openFresh(opts)
  try {
    yield* conn.streamTurn(opts.prompt, {
      timeoutMs: opts.timeoutMs,
      onToolCall: opts.onToolCall,
      onUsage: opts.onUsage,
    })
  } finally {
    conn.close()
  }
}
