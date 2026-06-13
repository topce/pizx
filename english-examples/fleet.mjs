#!/usr/bin/env pizx
/**
 * ─── fleet.mjs — fleet (alias for Φ Fleet) ─────────────────────────
 *
 * Runs multiple independent tasks in parallel. Each line or bullet point
 * becomes a separate parallel agent call. Uses the English word "fleet"
 * instead of the Greek letter Φ.
 *
 * Run:
 *   pizx english-examples/fleet.mjs
 *
 * Best for: code review across files, parallel research, batch analysis.
 */

import { chalk } from 'zx'

const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n fleet — Parallel Agent Execution\n'))
console.log(chalk.dim(' Each task runs in parallel via Promise.allSettled\n'))
console.log(chalk.dim(` Worker model: ${WORKER_MODEL}\n`))

const result = await fleet({
  workerModel: WORKER_MODEL,
  concurrency: 5,
  mode:'agent'
})`
Explain what this project does by analyzing package.json
List the key exports from src/index.ts
Check the tsconfig.json for TypeScript configuration
`

console.log(chalk.green(`\n ✓ fleet complete — ${result.successCount}/${result.members.length} succeeded\n`))

for (const member of result.members) {
  const icon = member.success ? chalk.green('✓') : chalk.red('✗')
  console.log(` ${icon} ${chalk.bold(member.task)}`)
  if (member.success) {
    console.log(chalk.white(`   ${member.text}`))
  } else {
    console.log(chalk.red(`   Error: ${member.error}`))
  }
  console.log()
}
