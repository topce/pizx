#!/usr/bin/env pizx
/**
 * ─── pattern-quality.mjs — Quality Validation (qualityCheck) ────────────────
 *
 * Demonstrates the optional qualityCheck flag available on all 15 patterns.
 * When enabled, the pattern runs a post-execution LLM review that scores the
 * final output (0.0–1.0), provides an assessment, and recommends improvements.
 *
 * Run:
 *   pizx examples/pattern-quality.mjs
 */

import { chalk } from 'zx'

const PLANNER = 'deepseek/deepseek-v4-pro'
const WORKER = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\n ── Quality Validation Demo (qualityCheck) ──\n'))

// ═════════════════════════════════════════════════════════════════════════════
// 1. Ω Orchestrator with qualityCheck
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 1. Ω Orchestrator with qualityCheck=true\n'))

const orchestratorResult = await Ω({
  plannerModel: PLANNER,
  workerModel: WORKER,
  workers: 2,
  qualityCheck: true,
  quiet: true,
})`
Write a brief developer guide for setting up a new Node.js project with:
- TypeScript
- Biome for linting
- Vitest for testing
- A proper tsconfig.json

Keep it actionable with file snippets.
`

console.log(chalk.green(`   Output (${orchestratorResult.text.length} chars)\n`))
console.log(chalk.cyan(orchestratorResult.text.slice(0, 600)))
if (orchestratorResult.text.length > 600) console.log(chalk.dim('   … (truncated)'))

console.log(chalk.bold.magenta('\n   ── Quality Review ──\n'))
if (orchestratorResult.qualityReview) {
  const qr = orchestratorResult.qualityReview
  const scoreBar = chalkBar(qr.score)
  console.log(`   Score:        ${chalkBarLabel(qr.score)} ${scoreBar} ${qr.score.toFixed(2)}`)
  console.log(`   Assessment:   ${chalk.cyan(qr.assessment)}`)
  console.log(`   Recommend:    ${chalk.yellow(qr.recommendation)}`)
}

console.log(chalk.dim('\n   ── Phase Log (includes quality-review) ──'))
for (const phase of orchestratorResult.phaseLog) {
  console.log(`     ${chalk.bold(phase.phase)}: ${phase.durationMs}ms — ${phase.description}`)
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Σ Subagents with qualityCheck
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n 2. Σ Subagents with qualityCheck=true\n'))

const subResult = await Σ({
  plannerModel: PLANNER,
  workerModel: WORKER,
  subAgents: 2,
  qualityCheck: true,
  quiet: true,
})`
List three key best practices for writing readable JavaScript. One sentence each.
`

console.log(chalk.green(`   Output: ${chalk.cyan(subResult.text)}`))

if (subResult.qualityReview) {
  const qr = subResult.qualityReview
  console.log(chalk.magenta(`\n   Quality score:  ${qr.score.toFixed(2)}`))
  console.log(chalk.dim(`   Assessment:     ${qr.assessment}`))
  console.log(chalk.dim(`   Recommendation: ${qr.recommendation}`))
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Δ Debate with qualityCheck
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n 3. Δ Debate with qualityCheck=true\n'))

const debateResult = await Δ({
  plannerModel: PLANNER,
  workerModel: WORKER,
  perspectives: 2,
  qualityCheck: true,
  quiet: true,
})`
What is the best way to structure error handling in a Node.js API?
Justify your position briefly.
`

console.log(chalk.green(`   Output: ${chalk.cyan(debateResult.text.slice(0, 400))}…`))

if (debateResult.qualityReview) {
  const qr = debateResult.qualityReview
  console.log(chalk.magenta(`\n   Quality score:  ${qr.score.toFixed(2)}`))
  console.log(chalk.dim(`   Assessment:     ${qr.assessment}`))
  console.log(chalk.dim(`   Recommendation: ${qr.recommendation}`))
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Without qualityCheck (shows no qualityReview)
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue('\n 4. Without qualityCheck (disabled by default)\n'))

const noQuality = await Ω({
  plannerModel: PLANNER,
  workerModel: WORKER,
  workers: 2,
  quiet: true,
})`Suggest a name for a new task-runner CLI tool.`

const hasQr = noQuality.qualityReview !== undefined
console.log(`   qualityReview defined: ${hasQr ? chalk.green('yes') : chalk.red('no — disabled by default')}`)
console.log(chalk.dim('\n   Set qualityCheck: true on any pattern to enable.'))

// ═════════════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold('\n ── Summary ──\n'))
console.log(chalk.dim('   qualityCheck adds one extra LLM call (~200 tokens) per pattern run.'))
console.log(chalk.dim('   Available on all 15 patterns: Ω Σ Δ Φ Λ Ψ Ρ Θ Μ Β Α Γ Ν Χ Τ'))
console.log(chalk.dim('   The review uses plannerModel (or model) as fallback.\n'))

// ── Helper: colored bar ─────────────────────────────────────────────────────
function chalkBar(score, width = 12) {
  const filled = Math.round(score * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  if (score >= 0.8) return chalk.green(bar)
  if (score >= 0.5) return chalk.yellow(bar)
  return chalk.red(bar)
}

function chalkBarLabel(score) {
  if (score >= 0.9) return chalk.green('★ excellent')
  if (score >= 0.8) return chalk.green('● good')
  if (score >= 0.6) return chalk.yellow('◆ fair')
  return chalk.red('■ poor')
}
