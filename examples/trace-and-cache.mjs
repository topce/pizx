#!/usr/bin/env pizx
// ─── trace-and-cache.mjs — trace export + local result cache ───────────────
//
// Runs the same cacheable π prompt twice: the second call is served from
// the local cache (no LLM call) and the trace shows it. Run with:
//
//   node dist/cli.js --cache --trace --export-log examples/trace-and-cache.mjs
//
// The trace lands in .pizx/logs/<runId>.jsonl — one JSON event per line:
// run-start, letter-start, cache-miss, llm-call, cache-hit, letter-end, run-end.

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold(`\n trace + cache (${MODEL})\n`))

// .cache enables the local result cache for this letter.
const first = await π.cache({ model: MODEL })`
what is the answer to life, the universe, and everything?
reply with a single sentence.
`
console.log(`  first call:  ${chalk.cyan(first.text.trim())}`)
console.log(`    fromCache: ${first.fromCache}`)

const second = await π.cache({ model: MODEL })`
what is the answer to life, the universe, and everything?
reply with a single sentence.
`
console.log(`  second call: ${chalk.cyan(second.text.trim())}`)
console.log(`    fromCache: ${second.fromCache}  ← served from .pizx/cache`)

console.log(chalk.dim('\n  with --trace: stderr shows tokens, cache hits, and cost at the end'))
console.log(chalk.dim('  with --export-log: the run is written as JSONL'))
