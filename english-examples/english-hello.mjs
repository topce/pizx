#!/usr/bin/env pizx
// ─── english-hello.mjs — Basic pizx demo using English word aliases ─────────
//
// Same as examples/hello-pizx.mjs but using pi, Pi instead of π, Π.
// All Greek letter tags have English aliases (pi, Pi, fleet, ralph, etc.)
//
// Run:   pizx english-examples/english-hello.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold(`\n pizx — English word aliases (${MODEL})\n`))
console.log(chalk.dim(' Same as π, Π, Φ, etc. — just English names.\n'))

// 1. $ — shell commands (unchanged from zx)
const whoami = (await $`whoami`).stdout.trim()
const platform = (await $`uname -s`).stdout.trim()
console.log(`  $ whoami          → ${chalk.green(whoami)}`)
console.log(`  $ uname -s        → ${chalk.green(platform)}`)

// 2. pi — AI text generation (alias for π)
const slogan = await pi({ model: MODEL, maxTokens: 512 })`
write a one-line slogan for a CLI tool called "pizx"
that combines shell scripting with AI.
`

console.log(`  pi slogan          → ${chalk.cyan(slogan)}`)
console.log(`    model: ${chalk.dim(slogan.modelUsed)}`)
console.log(`    duration: ${chalk.dim(slogan.duration + 'ms')}`)
console.log(`    chars: ${chalk.dim(slogan.length)}`)

// 3. Pi — coding agent with tools (alias for Π)
const agentResult = await Pi({ model: MODEL, maxTurns: 5, quiet: true })`
List all .mjs files in the examples/ directory and tell me:
- How many there are
- Which one is the largest
- What they do in one sentence each
`

console.log(`  Pi agent           → ${chalk.dim(agentResult.turnCount + ' turns, ' + agentResult.duration + 'ms')}`)
console.log(`    model: ${chalk.dim(MODEL)}`)
console.log(`    response:`)
console.log(chalk.green(agentResult.text.split('\n').map((l) => `    │ ${l}`).join('\n')))

// 4. pi.quiet — quiet mode (no streaming output)
const quiet = await pi.quiet({ model: MODEL })`what is 2 + 2. respond with JUST the number`
console.log(`  pi.quiet math      → ${chalk.yellow(quiet)}`)
console.log(`    model: ${chalk.dim(quiet.modelUsed)}  duration: ${chalk.dim(quiet.duration + 'ms')}`)

console.log(chalk.dim('\n  All Greek letters have English word aliases. See english-all-patterns.mjs\n'))
