#!/usr/bin/env pizx
// ─── basic-capital-pi.mjs — Using Π (big Pi) for the coding agent ──────────
//
// Π calls @earendil-works/pi-coding-agent — full coding agent with
// tools: read, bash, edit, write, grep, find, ls.
//
// Uses deepseek/deepseek-v4-flash. API keys loaded from ~/.pi/agent/auth.json.
//
// Run:   node dist/cli.js examples/basic-capital-pi.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold(`\n Π — pi-coding-agent with tools (${MODEL})\n`))

// ── Simple agent prompt ─────────────────────────────────────────────────────
// Π gets read/bash/edit/write tools automatically.
const agentResult = await Π({ model: MODEL, maxTurns: 8, quiet: true })`
List files in the current directory group by type:
- .mjs files (scripts)
- .ts files (source)
- .json files (config)
- other

For each file, tell me its size in bytes.
Then tell me the total number of files.
`

console.log(`  Π agent           → ${chalk.dim(agentResult.turnCount + ' turns, ' + agentResult.duration + 'ms')}`)
console.log(`    model: ${chalk.dim(MODEL)}`)
console.log(`    response:`)
console.log(chalk.green(agentResult.text.split('\n').map((l) => `    │ ${l}`).join('\n')))

console.log('')
