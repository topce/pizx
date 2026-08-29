/**
 * α (alpha) — any ACP-compatible coding agent, as a letter plugin.
 *
 *   await α({ server: ['kiro-cli', 'acp'] })`fix the TypeScript errors in src/`
 *   await α({ server: ['npx', '@github/copilot', '--acp'] })`review this diff`
 *   await α.quiet({ server: ['./my-agent'] })`run checks`
 *   for await (const c of α({ server: ['kiro-cli', 'acp'] }).stream`explain x`) ...
 *
 * α speaks the generic Agent Client Protocol (agentclientprotocol.com): it
 * spawns the given server command per invocation and consumes its
 * session/update stream. It has no relationship to pi — the server is an
 * explicit, required command line. Tool permissions are auto-approved and
 * the letter is cache: false: agent runs mutate the filesystem.
 */

import type { Plugin } from '@cordisjs/core'
import Schema from 'schemastery'
import type { AcpToolEvent, AcpUsage } from '../core/acp-client.ts'
import { runAcpPrompt, streamAcpPrompt } from '../core/acp-client.ts'
import type { LetterEnv } from '../core/tags.ts'
import { LetterOutput } from '../core/tags.ts'
import { confirmPhase, getErrorMessage } from '../core/utils.ts'

const PREFIX = 'pizx/α'

const options = Schema.object({
  server: Schema.array(Schema.string()).description(
    'ACP server command + args (required), e.g. ["kiro-cli", "acp"]'
  ),
  cwd: Schema.string().description('Working directory for the agent'),
  env: Schema.dict(Schema.string()).description('Extra environment variables for the server'),
  quiet: Schema.boolean().default(false).description('Suppress streaming output'),
  timeoutMs: Schema.natural().description('Kill the server after this many ms'),
  confirm: Schema.any().description('Confirmation gate: true | { semi } | { hitl } | { auto }'),
})

type AlphaOpts = ReturnType<typeof options>

function requireServer(opts: AlphaOpts): string[] {
  if (!opts.server || opts.server.length === 0) {
    throw new Error(
      `${PREFIX}: no ACP server specified — pass { server: ['kiro-cli', 'acp'] } or any other ` +
        'ACP-compatible agent command'
    )
  }
  return opts.server
}

function toolTraceEvent(serverLabel: string, ev: AcpToolEvent) {
  return {
    kind: 'tool-call' as const,
    server: serverLabel,
    toolCallId: ev.toolCallId,
    title: ev.title,
    status: ev.status,
  }
}

function usageTraceEvent(modelId: string, usage: AcpUsage, durationMs: number) {
  return {
    kind: 'llm-call' as const,
    modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    totalTokens: usage.totalTokens,
    costUsd: 0,
    durationMs,
  }
}

async function run(prompt: string, opts: AlphaOpts, env: LetterEnv): Promise<LetterOutput> {
  const { span } = env
  const server = requireServer(opts)
  const label = server.join(' ')

  if (
    !(await confirmPhase(
      `Send to ACP agent (${label}):\n    ${prompt.slice(0, 200)}${prompt.length > 200 ? '...' : ''}`,
      'send',
      true,
      opts
    ))
  ) {
    throw new Error(`${PREFIX}: Execution cancelled by user at phase 'send'`)
  }

  if (!opts.quiet) {
    process.stderr.write(
      `α (${label}): ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}\n`
    )
  }

  const t0 = Date.now()
  try {
    const result = await runAcpPrompt({
      server,
      prompt,
      cwd: opts.cwd,
      env: opts.env,
      timeoutMs: opts.timeoutMs,
      onText: (chunk) => {
        if (!opts.quiet) process.stdout.write(chunk)
      },
      onToolCall: (ev) => {
        span?.emit(toolTraceEvent(label, ev))
        if (!opts.quiet) process.stderr.write(`  α: ${ev.title} [${ev.status}]\n`)
      },
      onUsage: (usage) => {
        span?.emit(usageTraceEvent(`acp:${label}`, usage, Date.now() - t0))
      },
    })

    const text = result.text.trim() || '(no assistant response)'
    const t1 = Date.now()
    if (!opts.quiet) {
      process.stderr.write(
        `  α: done (stopReason: ${result.stopReason}, ${result.toolCallCount} tool call(s))\n`
      )
      if (result.text.trim()) process.stdout.write('\n')
    }
    const output = new LetterOutput(text, `acp:${label}`, false, t0, t1)
    output.turnCount = result.toolCallCount
    return output
  } catch (err) {
    const message = getErrorMessage(err)
    if (message.startsWith(PREFIX)) throw err
    throw new Error(`${PREFIX}: agent failed: ${message}`, { cause: err })
  }
}

async function* stream(prompt: string, opts: AlphaOpts, env: LetterEnv): AsyncGenerator<string> {
  const { span } = env
  const server = requireServer(opts)
  const label = server.join(' ')
  const t0 = Date.now()

  yield* streamAcpPrompt({
    server,
    prompt,
    cwd: opts.cwd,
    env: opts.env,
    timeoutMs: opts.timeoutMs,
    onToolCall: (ev) => span?.emit(toolTraceEvent(label, ev)),
    onUsage: (usage) => span?.emit(usageTraceEvent(`acp:${label}`, usage, Date.now() - t0)),
  })
}

export const acpPlugin: Plugin.Object = {
  name: 'pizx-acp',
  inject: ['letters'],
  apply(ctx) {
    ctx.letters.define('α', {
      aliases: ['acp', 'agent'],
      description: 'Any ACP-compatible coding agent (server required)',
      cache: false,
      options,
      run,
      stream,
    })
  },
}
