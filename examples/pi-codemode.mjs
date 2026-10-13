#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── pi-codemode.mjs — Π + codemode: JavaScript over the tools ───────────────
//
// The Pi *CLI* loads `codemode` as a built-in extension; the SDK does not.
// pizx exposes it as an option — `Π({ codemode: true })` — and the model can
// then write one JavaScript script that calls the session's other tools in
// parallel inside a QuickJS sandbox. Only the script's output reaches the
// model, so fanning out over 50 files costs one small tool result instead of a
// transcript full of file contents.
//
// This script gives codemode a real job over this repository's source tree,
// then verifies the answer with the shell — a model's table is a claim until a
// command confirms it. It also prints the `tool-call` trace event the run
// produces, which is how you see codemode actually being used.
//
// level 7/7 ●●●●●●● · feature: Π codemode & tool tracing · next: examples/pi-mcp.mjs
//
// Run:   pizx examples/pi-codemode.mjs
//        pizx --Pi --codemode "count the TypeScript files in src/"

import { createPizx } from '@topce/pizx'
import { chalk, fs, glob } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'
const app = await createPizx()

try {
  // ── Real input: this repo's TypeScript sources ───────────────────────────
  const files = (await glob('src/**/*.ts')).sort()
  echo(chalk.bold('\n Π codemode — one script, many tools\n'))
  echo(chalk.dim(`  ${files.length} TypeScript files · model ${MODEL}\n`))

  // ── One Π run, codemode enabled ──────────────────────────────────────────
  // The extension registers `codemode` inactive; naming it in an explicit
  // `tools` allow-list activates it, and here it also keeps the run read-only.
  const result = await app.Π({
    model: MODEL,
    quiet: true,
    codemode: true,
    tools: ['read', 'bash', 'codemode'],
    maxRetries: 2,
    timeoutMs: 300000,
  })`
Use the codemode tool to answer in a single JavaScript script: read every
*.ts file under src/ (including tests), count its lines, and return a markdown
table of the eight largest, columns "lines | file", sorted descending.
Call tools.read in parallel with Promise.all. Return only the table — do not
print the file contents. Do not use the read or bash tools directly this time.
`

  echo(result.text.trim())
  echo(chalk.dim(`\n  ${result.turnCount} turns · ${result.duration}ms`))

  // ── Independent verification ─────────────────────────────────────────────
  // Compute the real answer in the host, then check how many of the filenames
  // the model reported are in the true top eight. Tolerant by design: the
  // point is evidence, not a brittle string diff.
  const counts = await Promise.all(
    files.map(async (file) => ({ file, lines: (await fs.readFile(file, 'utf-8')).split('\n').length }))
  )
  counts.sort((a, b) => b.lines - a.lines)
  const truth = counts.slice(0, 8)
  const truthFiles = new Set(truth.map((c) => c.file))

  const claimed = [...new Set(result.text.match(/src\/[\w./-]+\.ts/g) ?? [])]
  const correct = claimed.filter((f) => truthFiles.has(f)).length
  echo(chalk.dim('\n  shell says the largest are:'))
  for (const { file, lines } of truth.slice(0, 5)) echo(chalk.dim(`    ${String(lines).padStart(6)}  ${file}`))
  echo(
    `\n  ${correct >= 5 ? chalk.green('✓') : chalk.yellow('·')} model named ${correct}/${claimed.length} files that are in the real top eight`
  )

  // ── The new Π trace event ────────────────────────────────────────────────
  // Every completed tool execution is recorded as a `tool-call` with
  // `source: 'pi'` — codemode shows up as one event alongside read/bash.
  const toolCalls = app.ctx.trace.events.filter((e) => e.kind === 'tool-call' && e.source === 'pi')
  echo(chalk.dim('\n  Π tool-call trace events (source: pi):'))
  if (toolCalls.length === 0) {
    echo(chalk.yellow('    (none — the model solved it without tools)'))
  } else {
    for (const call of toolCalls) {
      const ms = call.durationMs !== undefined ? `${call.durationMs}ms` : '—'
      echo(
        `    ${call.status === 'ok' ? chalk.green('ok ') : chalk.red('err')}  ${String(ms).padStart(7)}  ${call.toolName}`
      )
    }
  }
  const usedCodemode = toolCalls.some((c) => c.toolName === 'codemode')
  echo(
    chalk.dim(`\n  codemode used: ${usedCodemode ? chalk.green('yes') : chalk.yellow('no — the model chose read/bash')}`)
  )

  echo(chalk.dim(`\n${app.traceSummary()}`))
} finally {
  await app.dispose()
}

// ── Notes ──────────────────────────────────────────────────────────────────
// * `codemode: true` is a Π option (and a `--Pi --codemode` CLI flag). An
//   explicit `tools` allow-list must name `codemode` for the extension's tool
//   to be active — `['read', 'bash', 'codemode']` is the read-only shape.
// * codemode reaches non-LLM models too (`models.classify`,
//   `models.generateImages`) — see examples/llm-nonchat.mjs for the service
//   these are built on.
// * `--trace --export-log` writes the same tool-call events to
//   `.pizx/logs/<runId>.jsonl`; every event carries `source: 'pi'`.
// * The QuickJS sandbox has no filesystem or network of its own: it only
//   reaches the tools the session can already call.
