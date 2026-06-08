#!/usr/bin/env pizx
// ─── hello-pizx.mjs — Basic pizx demo mixing $, π, Π ────────────────────────
//
// Shows all three template tags working together with report metadata.
// API keys loaded automatically from ~/.pi/agent/auth.json.
//
// Run:   node dist/cli.js examples/hello-pizx.mjs
//        pizx examples/hello-pizx.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold(`\n pizx — three template tags (${MODEL})\n`))

// 1. $ — shell commands (unchanged from zx)
const whoami = (await $`whoami`).stdout.trim()
const platform = (await $`uname -s`).stdout.trim()
console.log(`  $ whoami          → ${chalk.green(whoami)}`)
console.log(`  $ uname -s        → ${chalk.green(platform)}`)

// 2. π — pi-ai text generation (returns PiOutput with metadata)
const slogan = await π({ model: MODEL, maxTokens: 512 })`
write a one-line slogan for a CLI tool called "pizx"
that combines shell scripting with AI.
`

console.log(`  π slogan          → ${chalk.cyan(slogan)}`)
console.log(`    model: ${chalk.dim(slogan.modelUsed)}`)
console.log(`    duration: ${chalk.dim(slogan.duration + 'ms')}`)
console.log(`    chars: ${chalk.dim(slogan.length)}`)

// 3. Π — pi coding agent with tools (returns AgentOutput)
const agentResult = await Π({ model: MODEL, maxTurns: 5, quiet: true })`
List all .mjs files in the examples/ directory and tell me:
- How many there are
- Which one is the largest
- What they do in one sentence each
`

console.log(`  Π agent           → ${chalk.dim(agentResult.turnCount + ' turns, ' + agentResult.duration + 'ms')}`)
console.log(`    model: ${chalk.dim(MODEL)}`)
console.log(`    response:`)
console.log(chalk.green(agentResult.text.split('\n').map((l) => `    │ ${l}`).join('\n')))

// 4. π.quiet — quiet mode (no streaming output)
const quiet = await π.quiet({ model: MODEL })`what is 2 + 2. respond with JUST the number`
console.log(`  π.quiet math      → ${chalk.yellow(quiet)}`)
console.log(`    model: ${chalk.dim(quiet.modelUsed)}  duration: ${chalk.dim(quiet.duration + 'ms')}`)

console.log(chalk.dim('\n  (API keys loaded from ~/.pi/agent/auth.json)\n'))
