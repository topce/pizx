#!/usr/bin/env pizx
/**
 * test-quality.mjs — qualityCheck + system + phaseLog
 *
 * Demonstrates:
 *   1. system: user prompt merged with pattern defaults
 *   2. qualityCheck: LLM-based quality scoring on output
 *   3. phaseLog: structured audit trail of execution phases
 *
 * Run:   npm run test:quality
 *        pizx examples/test-quality.mjs
 */

import { chalk } from 'zx'

const PLANNER = 'deepseek/deepseek-v4-pro'
const WORKER  = 'deepseek/deepseek-v4-flash'

const result = await Ω({
  plannerModel: PLANNER,
  workerModel: WORKER,
  workers: 2,
  system: 'You are an expert software architect with 20 years of experience.',
  qualityCheck: true,
})`
Outline a 3-tier architecture for a real-time collaboration app.
Keep it concise — 3 paragraphs max.
`

// ── qualityCheck ────────────────────────────────────────────────────────────
if (result.qualityReview) {
  const { score, assessment, recommendation } = result.qualityReview
  console.log(chalk.bold.yellow('\nQuality Review:'))
  console.log(`  Score:        ${'★'.repeat(Math.round(score * 5))}${'☆'.repeat(5 - Math.round(score * 5))} ${(score * 100).toFixed(0)}%`)
  console.log(`  Assessment:   ${assessment}`)
  console.log(`  Recommendation: ${recommendation}`)
} else {
  console.log(chalk.dim('\n(qualityCheck was not enabled — no quality review)'))
}

// ── phaseLog ────────────────────────────────────────────────────────────────
console.log(chalk.bold.magenta('\nPhase Log:'))
for (const phase of result.phaseLog) {
  const icon = phase.phase === 'plan'          ? '📋'
             : phase.phase === 'dispatch'      ? '🚀'
             : phase.phase === 'synthesize'    ? '🧩'
             : phase.phase === 'quality-review' ? '⭐'
             : '·'
  console.log(`  ${icon} ${chalk.bold(phase.phase.padEnd(14))} ${phase.durationMs.toString().padStart(5)}ms  ${phase.description.slice(0, 60)}`)
}
console.log(chalk.dim(`  ── Total: ${result.phaseLog.reduce((s, p) => s + p.durationMs, 0)}ms across ${result.phaseLog.length} phases\n`))

// ── Programmatic access ─────────────────────────────────────────────────────
console.log(chalk.bold('Programmatic access:'))
console.log(`  Plan phase duration:   ${result.phaseLog.find(p => p.phase === 'plan')?.durationMs ?? 'N/A'}ms`)
console.log(`  Synthesize model:      ${result.phaseLog.find(p => p.phase === 'synthesize')?.modelUsed ?? 'N/A'}`)
console.log(`  Quality score:         ${result.qualityReview?.score.toFixed(2) ?? 'N/A'}`)
console.log()

// ── Synthesis preview ───────────────────────────────────────────────────────
console.log(chalk.green(`\n✓ Synthesis (first 200 chars):`))
console.log(chalk.white(`  ${result.synthesis.slice(0, 200)}...`))
console.log()
