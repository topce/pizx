#!/usr/bin/env pizx
/**
 * ─── pattern-adaptive.mjs — Α (Alpha) Adaptive ──────────────────────────────
 *
 * Self-adjusting orchestration: starts with an initial plan, executes
 * step by step, evaluates quality after each step, and adapts the workflow
 * — adding, skipping, or refining steps based on intermediate results.
 *
 * Run:
 *   pizx examples/pattern-adaptive.mjs
 *
 * Orchestration: Adaptive Workflow (changes based on progress)
 * Topology: Dynamic — shifts between sequential, parallel, checkpoint
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n Α Adaptive — Self-Adjusting Orchestration\n'))
console.log(chalk.dim(' Plan → Execute → Evaluate → Adapt → Repeat\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Α({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxSteps: 4,
  qualityThreshold: 0.8,
})`
Create a plan for improving the error handling in the pizx/patterns directory.
Look at the source files in src/patterns/ and suggest concrete improvements.
`

console.log(chalk.green(`\n ✓ Adaptive complete — ${result.totalSteps} step(s)\n`))

for (const step of result.steps) {
  const qualityPct = Math.round(step.quality * 100)
  const qualityColor = step.quality >= 0.8 ? chalk.green : chalk.yellow
  console.log(chalk.yellow(`  Step ${step.step}: ${step.action.slice(0, 60)}...`))
  console.log(chalk.dim(`    Result: ${step.result.slice(0, 150)}${step.result.length > 150 ? '...' : ''}`))
  console.log(`    Quality: ${qualityColor(`${qualityPct}%`)}  Adaptation: ${chalk.cyan(step.adaptation)}`)
  console.log()
}

console.log(chalk.bold.magenta('Final Result:'))
console.log(chalk.white(result.finalResult))
console.log()
