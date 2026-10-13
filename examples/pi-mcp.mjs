#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── pi-mcp.mjs — Π + MCP servers and tool search ────────────────────────────
//
// MCP (Model Context Protocol) lets an agent use tools it was never compiled
// with. The Pi CLI connects servers automatically; the SDK does not, so pizx
// exposes two options:
//
//   Π({ mcp: true })          connect the servers in mcp.json (implies codemode)
//   Π({ toolSearch: true })   enable tool_search, which loads undeclared tools
//                             (MCP servers with `deferred` exposure) on demand
//
// Servers come from `~/.pi/agent/mcp.json` (or `PI_CODING_AGENT_DIR`) and, in a
// trusted project, `<project>/.pi/mcp.json`. Tool names are
// `mcp__<server>__<tool>`. This script discovers the configured servers, has Π
// search for a read-only MCP tool, call it, and reports what happened — and it
// prints the `mcp__*` tool-call trace events as evidence.
//
// level 7/7 ●●●●●●● · feature: Π MCP & tool search · previous: examples/pi-codemode.mjs · next: examples/pi-tool-trace.mjs
//
// Run:   pizx examples/pi-mcp.mjs
//
// If no server is configured the script explains how to add one and exits 0.

import { createPizx } from '@topce/pizx'
import { chalk, fs, os, path } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

// ── 1. Find the configuration the SDK will read ────────────────────────────
// Matches Pi's own lookup: the agent dir (honoring PI_CODING_AGENT_DIR) plus
// the project's .pi/mcp.json for a trusted project.
const agentDir = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), '.pi', 'agent')
const candidates = [path.join(agentDir, 'mcp.json'), path.join(process.cwd(), '.pi', 'mcp.json')]

async function readServers(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf-8'))
    return Object.entries(parsed.mcpServers ?? {}).map(([name, cfg]) => ({
      name,
      enabled: cfg.enabled !== false,
      source: file,
    }))
  } catch (err) {
    if (err.code !== 'ENOENT') echo(chalk.yellow(`  (could not parse ${file}: ${err.message})`))
    return []
  }
}

const servers = []
for (const file of candidates) {
  for (const server of await readServers(file)) {
    const existing = servers.findIndex((s) => s.name === server.name)
    if (existing >= 0) servers[existing] = server // project overrides user
    else servers.push(server)
  }
}

if (servers.length === 0) {
  echo(chalk.bold('\n Π + MCP\n'))
  echo(chalk.yellow('  skipped — no MCP servers configured.'))
  echo(chalk.dim(`  looked in:\n    ${candidates.join('\n    ')}\n`))
  echo(chalk.dim('  add one with the pi CLI, for example:\n'))
  echo(chalk.cyan('    pi mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem .'))
  echo(chalk.cyan('    pi mcp list          # validate the connection and list tools'))
  echo(chalk.dim('\n  or drop a file like this at .pi/mcp.json in a trusted project:\n'))
  echo(
    chalk.dim(
      JSON.stringify(
        { mcpServers: { filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] } } },
        null,
        2
      )
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n')
    )
  )
  echo(chalk.dim('\n  then re-run: pizx examples/pi-mcp.mjs\n'))
  process.exit(0)
}

// ── 2. Report what will connect ────────────────────────────────────────────
echo(chalk.bold('\n Π + MCP\n'))
echo(chalk.dim(`  ${servers.length} server(s) in scope:`))
for (const server of servers) {
  const state = server.enabled ? chalk.green('enabled ') : chalk.yellow('disabled')
  echo(`    ${state}  ${chalk.cyan(server.name)}  ${chalk.dim(path.relative(process.cwd(), server.source))}`)
}

// π finds the servers, then reports tools the model actually used so the shell
// never has to parse a server's own output.
const active = servers.filter((s) => s.enabled).map((s) => s.name)
const app = await createPizx()

try {
  // ── 3. One Π run with MCP + tool search active ────────────────────────────
  // `mcp` connects the servers; `toolSearch` enables the search tool that loads
  // a deferred server's tools for the next model call. The allow-list names
  // `codemode`/`tool_search` so the extensions activate, and deliberately has
  // no `mcp__` entry, so MCP tools keep their configured exposure rather than
  // being force-declared.
  echo(chalk.dim(`\n  asking Π to use a read-only MCP tool from: ${active.join(', ')}\n`))

  const result = await app.Π({
    model: MODEL,
    quiet: true,
    mcp: true,
    toolSearch: true,
    tools: ['read', 'bash', 'codemode', 'tool_search'],
    timeoutMs: 300000,
  })`
You have MCP servers connected: ${active.join(', ')}.

Find a harmless, read-only tool from one of them (use the tool_search tool if
the tools are not already declared), call it with minimal safe arguments, and
then reply with exactly three lines:
  tool:    the full mcp__... tool name you called
  args:    the JSON arguments you passed
  result:  one sentence describing what came back
If no MCP tool is reachable at all, reply with exactly: no mcp tools
`

  echo(result.text.trim().split('\n').map((l) => `    │ ${l}`).join('\n'))
  echo(chalk.dim(`\n  ${result.turnCount} turns · ${result.duration}ms`))

  // ── 4. Evidence from the trace ────────────────────────────────────────────
  // MCP tools are ordinary Π tool executions: one `tool-call` event each,
  // `toolName` prefixed with `mcp__`.
  const toolCalls = app.ctx.trace.events.filter((e) => e.kind === 'tool-call' && e.source === 'pi')
  const mcpCalls = toolCalls.filter((c) => String(c.toolName).startsWith('mcp__'))
  const searched = toolCalls.some((c) => c.toolName === 'tool_search')

  echo(chalk.dim(`\n  tool_search used: ${searched ? chalk.green('yes') : chalk.yellow('no (tools were already declared)')}`))
  echo(chalk.dim(`  MCP tool calls:   ${mcpCalls.length}`))
  for (const call of mcpCalls) {
    const ms = call.durationMs !== undefined ? `${call.durationMs}ms` : '—'
    echo(`    ${call.status === 'ok' ? chalk.green('ok ') : chalk.red('err')}  ${String(ms).padStart(7)}  ${call.toolName}`)
  }

  echo(chalk.dim(`\n${app.traceSummary()}`))
} finally {
  await app.dispose()
}

// ── Notes ──────────────────────────────────────────────────────────────────
// * `mcp: true` connects servers from mcp.json; servers with the default
//   `codemode` exposure are callable from a codemode script as
//   `tools.mcp__<server>__<tool>` — see examples/pi-codemode.mjs.
// * A server with `deferred` exposure is not declared until `tool_search`
//   finds it, which is when `toolSearch: true` earns its keep.
// * Server processes are pooled with the Π session, so repeated calls reuse one
//   connection. Tool names are `mcp__<server>__<tool>` (other characters → `_`).
// * CLI equivalents: `pizx --Pi --mcp "…"` and `pizx --Pi --mcp --tool-search "…"`.
// * Inspect connections outside the script with `pi mcp list` or the `/mcp`
//   command inside an interactive pi session.
