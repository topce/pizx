#!/usr/bin/env pizx
/**
 * ─── pattern-tracking.mjs — Token, Cost & Phase Tracking ────────────────────
 *
 * Demonstrates the built-in execution trace, cost accounting, and structured
 * phase logging available on every π call and every pattern output.
 *
 * Every LLM call is automatically recorded with:
 *   - Token counts (input, output, cache, total)
 *   - Cost in USD
 *   - Duration
 *   - Prompt/output previews
 *
 * Patterns additionally record a structured phaseLog showing what happened
 * during each phase of execution (plan, dispatch, synthesize, etc.).
 *
 * Run:
 *   pizx examples/pattern-tracking.mjs
 */

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'
const PLANNER = 'deepseek/deepseek-v4-pro'

console.log(chalk.bold('\n ── Token, Cost & Phase Tracking Demo ──\n'))

// ═════════════════════════════════════════════════════════════════════════════
// 1. π (small pi) — per-call trace
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 1. π — Per-Call Trace\n'))

const answer = await π({ model: MODEL })`
explain what a Promise is in JavaScript in two sentences.
`

console.log(`   Answer: ${chalk.cyan(answer)}`)
console.log()
console.log(chalk.dim('   ── Execution Trace ──'))

for (const t of answer.trace) {
  console.log(`     Call #${t.call}:`)
  console.log(`       model:       ${t.modelId}`)
  console.log(`       inputTokens: ${t.inputTokens}`)
  console.log(`       outputTokens:${t.outputTokens}`)
  console.log(`       cache read:  ${t.cacheReadTokens}`)
  console.log(`       cache write: ${t.cacheWriteTokens}`)
  console.log(`       totalTokens: ${t.totalTokens}`)
  console.log(`       cost:        $${t.cost.toFixed(6)}`)
  console.log(`       duration:    ${t.durationMs}ms`)
}

console.log(chalk.dim('   ── Convenience Accessors ──'))
console.log(`     inputTokens  → ${answer.inputTokens}`)
console.log(`     outputTokens → ${answer.outputTokens}`)
console.log(`     totalTokens  → ${answer.totalTokens}`)
console.log(`     totalCost    → $${answer.totalCost.toFixed(6)}`)
console.log(`     duration     → ${answer.duration}ms`)

// ═════════════════════════════════════════════════════════════════════════════
// 2. Pattern — per-call breakdown on trace
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.magenta('\n 2. Ω Orchestrator — Per-Call Breakdown\n'))

const orchestratorResult = await Ω({
  plannerModel: PLANNER,
  workerModel: MODEL,
  workers: 2,
  quiet: true,
})`
Suggest two simple names for a new CLI tool that helps developers track
their daily standup notes. Return just the names, one per line.
`

console.log(chalk.dim('   ── Per-Call Breakdown ──'))
for (const t of orchestratorResult.trace) {
  const icon = t.cost > 0.001 ? chalk.yellow('$') : chalk.green('·')
  console.log(`   ${icon} Call #${t.call}: ${chalk.bold(t.modelId)}`)
  console.log(`       ${t.totalTokens} tokens  |  $${t.cost.toFixed(6)}  |  ${t.durationMs}ms`)
  console.log(`       prompt:  ${chalk.dim(t.promptPreview.slice(0, 80))}${t.promptPreview.length > 80 ? '…' : ''}`)
  console.log(`       output:  ${chalk.dim(t.outputPreview.slice(0, 80))}${t.outputPreview.length > 80 ? '…' : ''}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Aggregates
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.green('\n 3. Aggregates (both π and patterns)\n'))

console.log(`   Property            π call          Ω pattern`)
console.log(`   ────────────────────────────────────────────────`)
console.log(`   totalTokens         ${String(answer.totalTokens).padStart(6)}           ${String(orchestratorResult.totalTokens).padStart(6)}`)
console.log(`   totalCost           $${answer.totalCost.toFixed(4)}        $${orchestratorResult.totalCost.toFixed(4)}`)
console.log(`   callCount           ${String(answer.callCount).padStart(6)}           ${String(orchestratorResult.callCount).padStart(6)}`)
console.log(`   duration            ${String(answer.duration).padStart(6)}ms        ${String(orchestratorResult.duration).padStart(6)}ms`)

// ═════════════════════════════════════════════════════════════════════════════
// 4. Phase Log (patterns only)
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.yellow('\n 4. Phase Log — Structured audit trail\n'))

console.log(chalk.dim('   The phaseLog records key execution phases with timing.\n'))

for (const phase of orchestratorResult.phaseLog) {
  const icon =
    phase.phase === 'plan' ? '📋' :
    phase.phase === 'dispatch' ? '🚀' :
    phase.phase === 'synthesize' ? '🧩' :
    phase.phase === 'execute' ? '⚡' :
    phase.phase === 'review' ? '🔍' :
    '·'
  console.log(`   ${icon} ${chalk.bold(phase.phase)}`)
  console.log(`      duration:   ${phase.durationMs}ms`)
  console.log(`      description: ${phase.description}`)
  if (phase.modelUsed) console.log(`      model:      ${phase.modelUsed}`)
  if (phase.callCount) console.log(`      calls:      ${phase.callCount}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. π.quiet with trace
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.cyan('\n 5. π.quiet — Also tracks token/cost\n'))

const jsonResult = await π.quiet({ model: MODEL, system: 'You are a JSON-only assistant.' })`
Generate a JSON object about a book. Keys: title, author, year.
`

console.log(`   Output: ${chalk.green(jsonResult)}`)
console.log()
for (const t of jsonResult.trace) {
  console.log(chalk.dim(`   inputTokens=${t.inputTokens}  outputTokens=${t.outputTokens}  totalTokens=${t.totalTokens}  cost=$${t.cost.toFixed(6)}`))
}

console.log(chalk.dim('\n ── All data collected automatically — no extra flags needed ──\n'))
