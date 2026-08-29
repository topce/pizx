#!/usr/bin/env pizx
// ─── acp-basic.mjs — Using α (any ACP-compatible coding agent) ─────────────
//
// α speaks the generic Agent Client Protocol (agentclientprotocol.com): it
// spawns the server command you pass and streams its session/update events.
// No pi involvement — π/Π keep using pi's SDK, α needs only the agent CLI.
//
// Prerequisites: install Kiro CLI (https://kiro.dev/docs/cli/acp/) and log
// in, then run:
//
//   node dist/cli.js examples/acp-basic.mjs
//
// Swap SERVER for any ACP v1 server, e.g. ['npx', '@github/copilot', '--acp'].

import { chalk } from 'zx'

const SERVER = ['kiro-cli', 'acp']

console.log(chalk.bold(`\n α — ACP agent (${SERVER.join(' ')})`))
console.log(chalk.dim('  (kiro must be installed and authenticated)\n'))

// ── Simple agent run (streams output as it arrives) ─────────────────────────
const result = await α({ server: SERVER })`
list the source files in src/ and summarize what each one does in one line.
`
console.log(`\n  summary: ${chalk.green(result)}`)
console.log(
  `  server: ${chalk.dim(result.modelUsed)}  turns: ${chalk.dim(result.turnCount)}  duration: ${chalk.dim(result.duration + 'ms')}\n`
)

// ── Quiet mode — no streamed output, just the result ────────────────────────
const quiet = await α.quiet({ server: SERVER })`
what is the license of this project? answer in one sentence.
`
console.log(`Quiet mode: ${chalk.cyan(quiet)}\n`)

// ── Streaming — consume chunks as the agent produces them ───────────────────
process.stdout.write('Streaming: ')
for await (const chunk of α({ server: SERVER }).stream`name three pizx letters`) {
  process.stdout.write(chunk)
}
process.stdout.write('\n\n')

console.log(chalk.dim('  (α works with any ACP v1 agent — see docs/acp.md)\n'))
