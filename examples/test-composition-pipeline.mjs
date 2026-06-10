#!/usr/bin/env pizx
/**
 * test-composition-pipeline.mjs — Pattern composition inside Pipeline
 *
 * Pipeline stages accept TaskDescriptor: plain strings for LLM calls,
 * or functions that receive the previous stage's output and invoke
 * other patterns.
 *
 * Run:   npm run test:composition-pipeline
 *        pizx examples/test-composition-pipeline.mjs
 */

import { chalk } from 'zx'

const PLANNER = 'deepseek/deepseek-v4-pro'
const WORKER  = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('Pipeline with composed stages\n'))

const result = await Λ({
  plannerModel: PLANNER,
  workerModel: WORKER,
  quiet: true,
  stages: [
    // Stage 1 — plain LLM: generate raw content
    'Generate a short product description for a task management app called "PiTask". 2-3 sentences.',

    // Stage 2 — function receives previous output, pipes it into Critique
    (prev) => Ψ({ quiet: true })`
      Critique this product description:
      ---
      ${prev}
      ---
      Suggest 2 specific improvements for clarity and persuasion.
    `,
  ],
})`generate → improve`

console.log(chalk.bold('Stage 1 — Generated Product Description:'))
console.log(chalk.white(`  ${result.stages[0].output.slice(0, 250)}`))
console.log()

console.log(chalk.bold('Stage 2 — Critique & Improvements:'))
console.log(chalk.white(`  ${result.stages[1].output.slice(0, 300)}`))
console.log()

console.log(chalk.dim(`✓ Pipeline completed ${result.stages.length} stages (${result.stages[1].output.length} chars final output)\n`))
