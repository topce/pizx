#!/usr/bin/env pizx
/**
 * ─── pattern-orchestrator.mjs — Ω (Omega) Orchestrator ──────────────────────
 *
 * The most sophisticated pattern: Plan → Dispatch → Synthesize.
 * Creates a detailed plan, dispatches worker agents in parallel,
 * then synthesizes a final deliverable.
 *
 * Run:
 *   pizx examples/pattern-orchestrator.mjs
 *
 * Best for: complex multi-step tasks, project generation, architecture design.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.red('\n Ω Orchestrator — Plan → Dispatch → Synthesize\n'))
console.log(chalk.dim(' The most powerful pattern: planner + workers + synthesis\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Ω({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  workers: 3,
})`
Analyze this pizx project and suggest:
1. What's the project's core value proposition?
2. What's missing or could be improved?
3. What would be the next most valuable feature to add?

Be specific — reference actual files and code patterns.
`

console.log(chalk.green(`\n ✓ Orchestrator complete — ${result.workerResults.length} worker(s)\n`))

console.log(chalk.bold.magenta('Plan:'))
console.log(chalk.cyan(result.plan))

console.log(chalk.bold.yellow('\nWorker Results:'))
for (const wr of result.workerResults) {
  const icon = wr.success ? chalk.green('✓') : chalk.red('✗')
  console.log(` ${icon} ${chalk.bold(wr.task.slice(0, 80))}`)
  if (wr.success) {
    console.log(chalk.dim(`   ${wr.output.slice(0, 200)}${wr.output.length > 200 ? '...' : ''}`))
  }
  console.log()
}

console.log(chalk.bold.green('Synthesis:'))
console.log(chalk.white(result.synthesis))
console.log()
