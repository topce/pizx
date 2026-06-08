#!/usr/bin/env pizx
/**
 * ─── pattern-pipeline.mjs — Λ (Lambda) Pipeline ─────────────────────────────
 *
 * Runs a sequential chain of agents, each stage receiving the output
 * of the previous. Like Unix pipes, but for AI processing.
 *
 * Run:
 *   pizx examples/pattern-pipeline.mjs
 *
 * Best for: document generation, multi-stage transformations, ETL-like flows.
 */

import { chalk } from 'zx'

const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.green('\n Λ Pipeline — Sequential Agent Chain\n'))
console.log(chalk.dim(' Stage 1 → Stage 2 → Stage 3\n'))
console.log(chalk.dim(` Worker model: ${WORKER_MODEL}\n`))

const result = await Λ({
  workerModel: WORKER_MODEL,
  stages: [
    'Analyze the src/ directory structure and list all modules',
    'Identify which files are the most architecturally important and why',
    'Write a one-paragraph summary of the project architecture',
  ],
})`
Analyze this project's architecture
`

console.log(chalk.green(`\n ✓ Pipeline complete — ${result.stages.length} stage(s)\n`))

for (const stage of result.stages) {
  console.log(chalk.yellow(`  Stage ${stage.index + 1}: ${stage.stage}`))
  console.log(chalk.dim(`   ${stage.output.slice(0, 200)}${stage.output.length > 200 ? '...' : ''}`))
  console.log()
}

console.log(chalk.bold.cyan('Final Output:'))
console.log(chalk.white(result.finalOutput))
console.log()
