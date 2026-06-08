#!/usr/bin/env pizx
// ─── basic-pi.mjs — Using π (small pi) for AI text generation ──────────────
//
// π calls @earendil-works/pi-ai — unified LLM API.
// Uses deepseek/deepseek-v4-flash (fast model).
// API keys loaded from ~/.pi/agent/auth.json automatically.
//
// Run:   node dist/cli.js examples/basic-pi.mjs

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold(`\n π — pi-ai text generation (${MODEL})\n`))

// ── Simple ask ──────────────────────────────────────────────────────────────
const answer = await π({ model: MODEL })`
what is the difference between git merge and git rebase?
answer in one short paragraph.
`
console.log(`Q: git merge vs rebase?\nA: ${chalk.cyan(answer)}`)
console.log(`  model: ${chalk.dim(answer.modelUsed)}  duration: ${chalk.dim(answer.duration + 'ms')}\n`)

// ── With system prompt ──────────────────────────────────────────────────────
const strict = await π.quiet({ model: MODEL, system: 'You are a JSON-only assistant.' })`
Generate a JSON object with keys: name, email, age.
Use values: Alice, alice@example.com, 30.
`
console.log(`With system prompt:\n${chalk.green(strict)}`)
console.log(`  model: ${chalk.dim(strict.modelUsed)}\n`)

// ── Quiet mode (no streaming) ───────────────────────────────────────────────
const code = await π.quiet({ model: MODEL })`
write a bash function that renames .jpg files to .jpeg in a directory.
Only output the function code, no explanation.
`
console.log(`Quiet mode (bash function):\n${chalk.yellow(code)}`)
console.log(`  model: ${chalk.dim(code.modelUsed)}\n`)

// ── Template literal interpolation ──────────────────────────────────────────
const language = 'TypeScript'
const framework = 'React'
const tip = await π({ model: MODEL, maxTokens: 512 })`
write a one-sentence ${language} ${framework} tip for a beginner.
`
console.log(`Interpolation: ${chalk.cyan(tip)}`)
console.log(`  model: ${chalk.dim(tip.modelUsed)}  duration: ${chalk.dim(tip.duration + 'ms')}\n`)

console.log(chalk.dim('  (keys from ~/.pi/agent/auth.json)\n'))
