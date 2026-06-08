#!/usr/bin/env pizx
/**
 * ─── quick-ask.mjs — Quick π query with DeepSeek ───────────────────────────
 *
 * The simplest possible pizx script: one π call.
 * Uses deepseek/deepseek-v4-flash — a fast, general-purpose model.
 *
 * API keys are loaded automatically from ~/.pi/agent/auth.json
 * by pizx's CLI entry point (cli.ts → loadPiAuth).
 *
 * Run:
 *   node dist/cli.js examples/quick-ask.mjs
 *   pizx examples/quick-ask.mjs
 */

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold(`\n π — quick ask (${MODEL})\n`))

const answer = await π({ model: MODEL })`
Explain the difference between "git merge" and "git rebase" in one paragraph.
Start with a single-word answer: "MERGE" or "REBASE" depending on which is safer.
`

console.log(` ${chalk.cyan(answer)}`)
console.log(`   model: ${chalk.dim(answer.modelUsed)}  duration: ${chalk.dim(answer.duration + 'ms')}\n`)

// Also demonstrate quiet mode (no streaming, just result)
const strict = await π.quiet({ model: MODEL })`
Respond with ONLY the number 42. No other text.
`
console.log(` Quiet mode: ${chalk.green(strict.trim())}`)
console.log(`   model: ${chalk.dim(strict.modelUsed)}`)

console.log(chalk.dim('\n ✓ quick-ask complete\n'))
