#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── pi-tool-trace.mjs — see what the coding agent actually did ──────────────
//
// A Π run is not a black box. Every completed tool execution is recorded as a
// `tool-call` trace event with `source: 'pi'`, the tool name, an `ok`/`error`
// status, and the execution time when the runtime reports it. That turns a run
// into an audit trail: which files it read, which commands it ran, what failed.
//
// This script runs one real inventory task over the repo with read-only tools,
// prints the events as a table, flushes the JSONL log, and re-reads the file to
// prove the events survive export. α (ACP agents) emits the same event kind
// with `source: 'acp'`; branch on `source` to tell them apart.
//
// level 7/7 ●●●●●●● · feature: Π tool-call tracing · previous: examples/pi-mcp.mjs · next: examples/llm-nonchat.mjs
//
// Run:   pizx examples/pi-tool-trace.mjs
//        pizx --trace --export-log examples/pi-tool-trace.mjs

import { createPizx } from '@topce/pizx'
import { chalk, fs } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'
const app = await createPizx()

try {
  echo(chalk.bold('\n Π tool-call tracing\n'))
  echo(chalk.dim('  task: inventory the letters registered by src/plugins/*.ts (read-only)\n'))

  // ── One run with tools that will actually be used ────────────────────────
  // `grep`/`find`/`ls` are off by default; naming them here makes the agent
  // search the tree instead of guessing, which produces several trace events.
  const result = await app.Π({
    model: MODEL,
    quiet: true,
    tools: ['read', 'grep', 'find', 'ls'],
    timeoutMs: 300000,
  })`
Inventory how this project registers its letters. Look at src/plugins/*.ts and
report a markdown table: file | letter(s) or word(s) it registers. Use grep,
find, ls and read to check the real files — do not guess.
`

  echo(result.text.trim().split('\n').map((l) => chalk.dim(`    │ ${l}`)).join('\n'))

  // ── The trace events ─────────────────────────────────────────────────────
  // `source` discriminates α (`'acp'`) from Π (`'pi'`). We keep only this run.
  const toolCalls = app.ctx.trace.events.filter((e) => e.kind === 'tool-call' && e.source === 'pi')

  echo(chalk.bold(`\n  ${toolCalls.length} tool-call event(s):\n`))
  echo(chalk.dim('    status   duration   tool       title'))
  for (const call of toolCalls) {
    const status = call.status === 'ok' ? chalk.green('ok    ') : chalk.red('error ')
    const ms = call.durationMs !== undefined ? `${call.durationMs}ms`.padStart(8) : '       —'
    echo(`    ${status} ${ms}   ${String(call.toolName).padEnd(10)} ${chalk.dim(call.title)}`)
  }

  // Shape of one event — the fields the new discriminated union adds.
  const sample = toolCalls[0]
  if (sample) {
    echo(chalk.dim('\n  an event in full:'))
    const shape = {
      kind: sample.kind,
      source: sample.source,
      toolName: sample.toolName,
      status: sample.status,
      durationMs: sample.durationMs,
      toolCallId: `${String(sample.toolCallId).slice(0, 12)}…`,
    }
    echo(chalk.dim(JSON.stringify(shape, null, 2).split('\n').map((l) => `    ${l}`).join('\n')))
  }

  // ── Export proof ─────────────────────────────────────────────────────────
  // `--export-log` does exactly this: write the run to JSONL. Reading it back
  // confirms the tool-call events are in the durable log, not just in memory.
  const logPath = await app.flushLog()
  const events = (await fs.readFile(logPath, 'utf-8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const exported = events.filter((e) => e.kind === 'tool-call')
  const kinds = [...new Set(events.map((e) => e.kind))].join(', ')

  echo(chalk.dim(`\n  wrote ${logPath}`))
  echo(chalk.dim(`  ${exported.length} tool-call event(s) in the log · event kinds: ${kinds}`))

  const byStatus = exported.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }), {})
  echo(
    chalk.dim(
      `  by status: ${Object.entries(byStatus).map(([s, n]) => `${s}×${n}`).join(' ') || '(none)'}`
    )
  )

  echo(chalk.dim(`\n${app.traceSummary()}`))
} finally {
  await app.dispose()
}

// ── Notes ──────────────────────────────────────────────────────────────────
// * Π records one event per *completed* execution (`tool_execution_end`).
//   α records one per ACP `session/update`, so a single ACP tool can appear
//   several times as its status changes.
// * `durationMs` comes from Pi when it reports one, else it is measured from
//   the start/end events. `title` mirrors the Π tool name.
// * `ToolCallEvent` replaced `AcpToolCallEvent` (kept as a deprecated alias):
//   `source` is now required and `server` is optional, set only for α.
// * Gate on the trail in CI: fail the job when any event has `status: 'error'`.
