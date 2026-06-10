#!/usr/bin/env pizx
/**
 * ─── social-content-verify.mjs — Test social media code examples ───────────
 *
 * Tests the exact patterns from social-content marketing materials:
 *   1. Φ (Fleet) without explicit file list — does it find files on its own?
 *   2. Σ (Subagents) without reviews passed in — does it synthesize from context?
 *   3. Same with reviews passed explicitly
 *
 * Run:
 *   pizx social-content/verify-social-patterns.mjs
 */

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n🧪 Testing social-content code patterns\n'))

// ── Test A: Φ without passing files ────────────────────────────────────────
// The social posts do: Φ`review files for bugs` without passing which files.
// Does Fleet figure out which files to review on its own?

console.log(chalk.bold.yellow('── Test A: Φ (Fleet) without explicit file list ──\n'))
console.log(chalk.dim('Task: "review package.json and tsconfig.json for issues"'))
console.log(chalk.dim('No file paths provided — agent must discover them.\n'))

const fleetResult = await Φ({
  workerModel: MODEL,
  concurrency: 2,
  quiet: true,
})`review package.json and tsconfig.json for issues`

console.log(chalk.green(`✓ Fleet done — ${fleetResult.successCount}/${fleetResult.members.length} tasks\n`))

for (const m of fleetResult.members) {
  console.log(`  ${m.success ? chalk.green('✓') : chalk.red('✗')} ${m.task}`)
  if (m.success) {
    console.log(chalk.dim(`    ${m.text.slice(0, 200)}${m.text.length > 200 ? '...' : ''}`))
  }
  console.log()
}

// ── Test B: Σ with Fleet results passed explicitly ─────────────────────────

console.log(chalk.bold.yellow('── Test B: Σ with Fleet reviews passed ──\n'))
console.log(chalk.dim('Passing Fleet output explicitly to Subagents for synthesis.\n'))

const reviewsText = fleetResult.members
  .map((m, i) => `Task ${i + 1}: ${m.task}\nResult: ${m.text.slice(0, 500)}`)
  .join('\n\n')

const synthesisExplicit = await Σ({
  plannerModel: MODEL,
  workerModel: MODEL,
  maxSubTasks: 2,
  quiet: true,
})`synthesize these findings into a brief summary report:\n\n${reviewsText}`

console.log(chalk.green('✓ Σ with explicit reviews:\n'))
console.log(chalk.white(synthesisExplicit.synthesis?.slice(0, 500) || synthesisExplicit.text?.slice(0, 500)))
console.log()

// ── Test C: Σ WITHOUT passing reviews (like social posts do) ───────────────

console.log(chalk.bold.yellow('── Test C: Σ WITHOUT passing reviews ──\n'))
console.log(chalk.dim('Same task, but no review data provided. Can Σ still produce output?\n'))

const synthesisBlind = await Σ({
  plannerModel: MODEL,
  workerModel: MODEL,
  maxSubTasks: 2,
  quiet: true,
})`synthesize findings into a brief summary report`

console.log(chalk.green('✓ Σ without reviews:\n'))
console.log(chalk.white(synthesisBlind.synthesis?.slice(0, 500) || synthesisBlind.text?.slice(0, 500)))
console.log()

// ── Summary ────────────────────────────────────────────────────────────────

console.log(chalk.bold.cyan(`${'─'.repeat(50)}`))
console.log(chalk.bold('Conclusion:'))
console.log()

if (synthesisExplicit.synthesis?.length > synthesisBlind.synthesis?.length) {
  console.log(chalk.green('  ✓ Passing reviews explicitly produces richer synthesis'))
} else if (synthesisBlind.synthesis?.length > synthesisExplicit.synthesis?.length) {
  console.log(chalk.yellow('  ⚠ Blind Σ was more verbose — but likely less accurate'))
}

if (fleetResult.successCount > 0) {
  console.log(chalk.green('  ✓ Fleet finds files on its own (no file list needed)'))
  console.log(chalk.dim('    → Removing const files = await glob(...) was correct'))
} else {
  console.log(chalk.red('  ✗ Fleet failed without explicit file list'))
}

console.log()
