#!/usr/bin/env pizx
/**
 * ─── fleet-review-then-fix.mjs ──────────────────────────────────────────────
 *
 * Demonstrates the social-content pattern:
 *   1. Φ (Fleet) — parallel review of every file for bugs/security issues
 *   2. Π (Capital Pi) — coding agent auto-fixes everything found
 *
 * This matches the social posts:
 *   const bugs = await Φ`review every file for bugs and security issues`
 *   const fixed = await Π`fix everything: bugs, types, tests, and docs`
 *
 * NOTE: bugs.text (Fleet findings) must be passed to Π so the agent
 *       knows what to fix. Without it, Π has no context.
 *
 * Run:
 *   pizx social-content/fleet-review-then-fix.mjs
 */

import { chalk } from 'zx'

const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const FIXER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n🐛 Fleet Review → Auto-Fix Pipeline\n'))
console.log(chalk.dim(`Reviewer: ${WORKER_MODEL}  |  Fixer: ${FIXER_MODEL}\n`))

// ── Step 1: Φ (Fleet) — parallel review ────────────────────────────────────
console.log(chalk.bold.yellow('Step 1: Φ Fleet — parallel bug review\n'))
console.log(chalk.dim('Reviewing the source directory for bugs, type errors, and security issues...\n'))

const bugs = await Φ({
  workerModel: WORKER_MODEL,
  concurrency: 3,
})`
Scan the src/ directory and find:
- TypeScript type errors or unsafe type usage
- Missing error handling in async functions
- Potential null/undefined access bugs
- Security issues (injection, unsafe defaults)
- Unused variables or dead code

For each file, report:
  File: path
  Line: line number
  Severity: critical | high | medium | low
  Issue: description of the problem
  Fix: suggested fix
`

console.log(chalk.green(`✓ Review complete — ${bugs.successCount}/${bugs.members.length} tasks succeeded\n`))

for (const m of bugs.members) {
  const icon = m.success ? chalk.green('✓') : chalk.red('✗')
  console.log(` ${icon} ${chalk.bold(m.task)}`)
  if (m.success) {
    console.log(chalk.dim(`   ${m.text.slice(0, 300)}${m.text.length > 300 ? '...' : ''}`))
  }
  console.log()
}

// ── Step 2: Π (Capital Pi) — auto-fix ──────────────────────────────────────
console.log(chalk.bold.yellow('Step 2: Π Capital Pi — auto-fix\n'))
console.log(chalk.dim('Applying fixes for all issues found above...\n'))

const fixed = await Π({
  model: FIXER_MODEL,
  maxTurns: 1,
  quiet: false,
})`Fix all the issues identified in this code review. Apply the suggested fixes:

${bugs.text}

Instructions:
1. Read each affected file
2. Apply the suggested fix for each issue
3. Verify the fix is correct (no new errors introduced)
4. Report what was changed
`

console.log(chalk.green(`\n✓ Fixes applied — ${fixed.turnCount} turn(s), ${fixed.duration}ms\n`))
console.log(chalk.cyan('Fix summary:'))
console.log(chalk.white(fixed.text))

console.log(chalk.bold.green('\n✓ Fleet Review → Auto-Fix pipeline complete!\n'))
