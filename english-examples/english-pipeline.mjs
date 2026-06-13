#!/usr/bin/env pizx
/**
 * ─── english-pipeline.mjs — pipeline (alias for Λ Pipeline) ────────────────
 *
 * Sequential chain of agents, each receiving the previous stage's output.
 * Uses the English word "pipeline" instead of the Greek letter Λ.
 *
 * Run:
 *   pizx english-examples/english-pipeline.mjs
 */

import { chalk } from 'zx'

const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.green('\n pipeline — Sequential Agent Chain\n'))
console.log(chalk.dim(' English alias for Λ (Lambda). Stage 1 → Stage 2 → Stage 3\n'))
console.log(chalk.dim(` Worker model: ${WORKER_MODEL}\n`))

const result = await pipeline({
  workerModel: WORKER_MODEL,
  stages: [
    'Analyze the src/ directory structure and list all modules',
    'Identify which files are the most architecturally important and why',
    'Write a one-paragraph summary of the project architecture',
  ],
})`
Analyze this project's architecture
`

console.log(chalk.green(`\n ✓ pipeline complete — ${result.stages.length} stage(s)\n`))

for (const stage of result.stages) {
  console.log(chalk.yellow(`  Stage ${stage.index + 1}: ${stage.stage}`))
  console.log(chalk.dim(`   ${stage.output.slice(0, 200)}${stage.output.length > 200 ? '...' : ''}`))
  console.log()
}

console.log(chalk.bold.cyan('Final Output:'))
console.log(chalk.white(result.finalOutput))
console.log()
