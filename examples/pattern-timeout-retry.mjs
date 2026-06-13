#!/usr/bin/env pizx
/**
 * ─── pattern-timeout-retry.mjs — Timeout & Retry ────────────────────────────
 *
 * Demonstrates timeoutMs and maxRetries on π (small pi) and patterns.
 *
 * timeoutMs:  Maximum time in milliseconds to wait for a single LLM call.
 *             If the call takes longer, it's aborted and retried (if retries remain).
 * maxRetries: How many times to retry after a transient failure (network, rate limit, timeout).
 *             Default: provider SDK default (typically 2).
 *
 * Also shows configurePi() for setting global defaults across all π calls.
 *
 * Run:
 *   pizx examples/pattern-timeout-retry.mjs
 */

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\n ── Timeout & Retry Demo ──\n'))

// ═════════════════════════════════════════════════════════════════════════════
// 1. π with custom timeout and retry
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 1. π — Per-call timeoutMs & maxRetries\n'))

const quick = await π({
  model: MODEL,
  timeoutMs: 30000,   // 30 seconds max per call
  maxRetries: 3,      // retry up to 3 times on failure
})`
What is the difference between "let", "const", and "var" in JavaScript?
Answer in two sentences.
`

console.log(`   Answer: ${chalk.cyan(quick)}`)

for (const t of quick.trace) {
  console.log(chalk.dim(`   Call #${t.call}: ${t.durationMs}ms  |  ${t.totalTokens} tokens  |  $${t.cost.toFixed(6)}`))
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. π.quiet with aggressive timeout
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n 2. π.quiet — Tight timeout (fast query)\n'))

const fast = await π.quiet({
  model: MODEL,
  timeoutMs: 15000,   // 15 seconds — fine for simple queries
  maxRetries: 1,
})`What is 2 + 2? Respond with JUST the number.`

console.log(`   Result: ${chalk.green(fast)}`)
console.log(chalk.dim(`   Duration: ${fast.duration}ms  |  Retries configured: 1\n`))

// ═════════════════════════════════════════════════════════════════════════════
// 3. Pattern with timeout & retry
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 3. Φ Fleet — Pattern-level timeout & retry\n'))

const fleetResult = await Φ({
  model: MODEL,
  timeoutMs: 60000,    // 60 seconds per worker call
  maxRetries: 2,       // 2 retries per worker
  quiet: true,
  tasks: [
    'Name one benefit of TypeScript over JavaScript. One sentence.',
    'Name one benefit of JavaScript over TypeScript. One sentence.',
  ],
})`Compare TypeScript vs JavaScript.`

console.log(chalk.green(`   Output: ${fleetResult.text}`))
console.log(chalk.dim(`   Calls: ${fleetResult.callCount}  |  Duration: ${fleetResult.duration}ms`))
for (const t of fleetResult.trace) {
  console.log(chalk.dim(`   Call #${t.call}: ${t.durationMs}ms  |  ${t.totalTokens} tokens  |  $${t.cost.toFixed(6)}`))
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Global defaults with configurePi
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n 4. configurePi — Global defaults\n'))

// Set once, applies to all subsequent π calls in this script
configurePi({ timeoutMs: 45000, maxRetries: 3 })

console.log(chalk.dim('   configurePi({ timeoutMs: 45000, maxRetries: 3 }) — applied globally\n'))

const globalExample = await π`What is a Promise in JavaScript? One sentence.`
console.log(`   Answer: ${chalk.cyan(globalExample)}`)
console.log(chalk.dim(`   Duration: ${globalExample.duration}ms  |  Model: ${globalExample.modelUsed}`))

for (const t of globalExample.trace) {
  console.log(chalk.dim(`   Call #${t.call}: ${t.durationMs}ms  |  ${t.totalTokens} tokens`))
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Per-call overrides global defaults
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n 5. Per-call overrides global defaults\n'))

const override = await π({
  timeoutMs: 10000,    // This call: 10s (overrides global 45s)
  maxRetries: 0,       // This call: no retries (overrides global 3)
})`What is a closure? One sentence.`

console.log(`   Answer: ${chalk.cyan(override)}`)
console.log(chalk.dim(`   Duration: ${override.duration}ms  |  Per-call timeoutMs=10000 overrides global\n`))

// ═════════════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold(' ── Quick Reference ──\n'))
console.log(chalk.dim('   Per-call:     π({ timeoutMs: 30000, maxRetries: 2 })\`prompt\`'))
console.log(chalk.dim('   Per-pattern:  Ω({ timeoutMs: 60000, maxRetries: 3 })\`prompt\`'))
console.log(chalk.dim('   Global:       configurePi({ timeoutMs: 45000, maxRetries: 3 })'))
console.log(chalk.dim('   Default:      provider SDK default (typically 10 min, 2 retries)\n'))
