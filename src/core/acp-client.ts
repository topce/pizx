/**
 * pizx ACP client — a minimal, general client for the Agent Client Protocol
 * (https://agentclientprotocol.com), built on the official
 * @agentclientprotocol/sdk.
 *
 * The client spawns any ACP v1 agent server as a subprocess, speaks
 * JSON-RPC 2.0 over newline-delimited stdio (initialize → session/new →
 * session/prompt → session/update → stop), and returns the aggregated text.
 * It has no relationship to pi: the server is an explicit command line, e.g.
 * ['kiro-cli', 'acp'] or ['npx', '@github/copilot', '--acp'].
 *
 * Behavior notes:
 * - Tool permissions are auto-approved (allow_always > allow_once).
 * - File-system requests delegated to the client are served honestly.
 * - The child process is killed on every exit path (error, timeout, stop).
 * - stderr of the agent is mirrored to our stderr and kept as a tail for
 *   error diagnostics.
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
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
  /** Kill the server after this many ms (optional). */
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

// ── Internals ───────────────────────────────────────────────────────────────

const PREFIX = 'pizx/α'
/** Keep at most this many stderr bytes for error diagnostics. */
const STDERR_TAIL_BYTES = 4096

function serverLabel(server: string[]): string {
  return server.join(' ')
}

/** npx needs its .cmd shim on Windows. */
function normalizeCommand(command: string): string {
  if (command === 'npx' && process.platform === 'win32') return 'npx.cmd'
  return command
}

async function wrapError(
  err: unknown,
  server: string[],
  child: ChildProcess,
  stderrTail: string
): Promise<Error> {
  const message = err instanceof Error ? err.message : String(err)

  if (message.startsWith(PREFIX)) return err as Error

  // A failed spawn surfaces as an ENOENT-style error event.
  if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
    return new Error(
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
    return new Error(
      `${PREFIX}: ACP server '${serverLabel(server)}' exited with code ${child.exitCode}` +
        (tail ? `:\n${tail}` : ''),
      { cause: err }
    )
  }
  if (child.signalCode) {
    return new Error(
      `${PREFIX}: ACP server '${serverLabel(server)}' was killed by signal ${child.signalCode}` +
        (tail ? `:\n${tail}` : ''),
      { cause: err }
    )
  }
  if (child.exitCode === 0) {
    return new Error(
      `${PREFIX}: ACP server '${serverLabel(server)}' closed the connection unexpectedly ` +
        `(exit code 0) — the agent may be unauthenticated, misconfigured, or unsupported in this environment` +
        (tail ? `:\n${tail}` : ''),
      { cause: err }
    )
  }

  if (/auth|authenticate/i.test(message)) {
    return new Error(`${PREFIX}: the agent requires authentication, which is not supported yet`, {
      cause: err,
    })
  }

  return new Error(`${PREFIX}: ACP agent failed: ${message}`, { cause: err })
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

async function handleReadTextFile(params: ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
  const content = await readFile(params.path, 'utf-8')
  const lines = content.split('\n')
  const start = params.line ? params.line - 1 : 0
  const end = params.limit ? start + params.limit : lines.length
  return { content: lines.slice(start, end).join('\n') }
}

async function handleWriteTextFile(
  params: WriteTextFileRequest
): Promise<acp.WriteTextFileResponse> {
  await mkdir(dirname(params.path), { recursive: true })
  await writeFile(params.path, params.content, 'utf-8')
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

/** Spawn the server and run one prompt turn; returns the aggregated result. */
async function connectAndPrompt(opts: AcpRunOptions): Promise<AcpRunResult> {
  const cwd = resolve(opts.cwd ?? process.cwd())
  const [command, ...args] = opts.server
  const child = spawn(normalizeCommand(command), args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })

  let stderrTail = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderrTail = `${stderrTail}${chunk.toString('utf-8')}`.slice(-STDERR_TAIL_BYTES)
    process.stderr.write(chunk)
  })

  let killTimer: NodeJS.Timeout | undefined
  const timeoutError = new Promise<never>((_, reject) => {
    if (!opts.timeoutMs) return
    killTimer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(
        new Error(
          `${PREFIX}: ACP server '${serverLabel(opts.server)}' timed out after ${opts.timeoutMs}ms`
        )
      )
    }, opts.timeoutMs)
  })

  const spawnError = new Promise<never>((_, reject) => {
    child.once('error', (err) => reject(err))
  })

  const work = (async (): Promise<AcpRunResult> => {
    const input = Writable.toWeb(child.stdin)
    const output = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    const stream = acp.ndJsonStream(input, output)

    return acp
      .client({ name: 'pizx' })
      .onRequest(acp.methods.client.session.requestPermission, ({ params }) => autoApprove(params))
      .onRequest(acp.methods.client.fs.readTextFile, ({ params }) => handleReadTextFile(params))
      .onRequest(acp.methods.client.fs.writeTextFile, ({ params }) => handleWriteTextFile(params))
      .connectWith(stream, async (ctx) => {
        await ctx.request(acp.methods.agent.initialize, {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
          clientInfo: { name: 'pizx', version: pizxVersion },
        })

        return ctx.buildSession(cwd).withSession(async (session) => {
          let text = ''
          const toolCallIds = new Set<string>()

          void session.prompt(opts.prompt)

          for (;;) {
            const message = await session.nextUpdate()
            if (message.kind === 'stop') {
              if (message.response.usage) opts.onUsage?.(normalizeUsage(message.response.usage))
              return {
                text,
                stopReason: message.stopReason,
                serverLabel: serverLabel(opts.server),
                toolCallCount: toolCallIds.size,
              }
            }

            const update = message.update
            if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
              text += update.content.text
              opts.onText?.(update.content.text)
            }

            const toolEvent = toolEventFromUpdate(update)
            if (toolEvent) {
              toolCallIds.add(toolEvent.toolCallId)
              opts.onToolCall?.(toolEvent)
            }
          }
        })
      })
  })()

  // Attach no-op handlers so a promise that loses the race never surfaces as
  // an unhandled rejection.
  work.catch(() => {})
  spawnError.catch(() => {})
  timeoutError.catch(() => {})

  try {
    return await Promise.race([work, spawnError, timeoutError])
  } catch (err) {
    throw await wrapError(err, opts.server, child, stderrTail)
  } finally {
    if (killTimer) clearTimeout(killTimer)
    child.kill()
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Run one prompt turn against an ACP server; returns the aggregated text. */
export async function runAcpPrompt(opts: AcpRunOptions): Promise<AcpRunResult> {
  if (!opts.server || opts.server.length === 0) {
    throw new Error(
      `${PREFIX}: no ACP server specified — pass { server: ['kiro-cli', 'acp'] } or any other ` +
        'ACP-compatible agent command'
    )
  }
  let text = ''
  const result = await connectAndPrompt({
    ...opts,
    onText: (chunk) => {
      text += chunk
      opts.onText?.(chunk)
    },
  })
  return { ...result, text }
}

/** Stream one prompt turn against an ACP server, yielding text chunks. */
export async function* streamAcpPrompt(opts: AcpRunOptions): AsyncGenerator<string> {
  if (!opts.server || opts.server.length === 0) {
    throw new Error(
      `${PREFIX}: no ACP server specified — pass { server: ['kiro-cli', 'acp'] } or any other ` +
        'ACP-compatible agent command'
    )
  }

  const queue: string[] = []
  let waiting: ((chunk: string | undefined) => void) | undefined
  let done = false
  let error: unknown

  const work = connectAndPrompt({
    ...opts,
    onText: (chunk) => {
      if (waiting) {
        const resolve = waiting
        waiting = undefined
        resolve(chunk)
      } else {
        queue.push(chunk)
      }
    },
  })
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
