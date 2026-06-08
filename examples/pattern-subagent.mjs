#!/usr/bin/env pizx
/**
 * ─── pattern-subagent.mjs — Σ (Sigma) Subagents ─────────────────────────────
 *
 * Hierarchical task delegation: a planner decomposes the task, sub-agents
 * execute in parallel, and results are synthesized into a final answer.
 *
 * Run:
 *   pizx examples/pattern-subagent.mjs
 *
 * Best for: complex analysis that benefits from specialized perspectives.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.yellow('\n Σ Subagents — Hierarchical Delegation\n'))
console.log(chalk.dim(' Planner → Sub-agents (parallel) → Synthesis\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Σ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxSubTasks: 3,
})`
Analyze the src/ directory structure and provide:
1. Overview of the project architecture
2. Key design patterns used
3. Suggestions for improvement
`

console.log(chalk.green(`\n ✓ Subagents complete — ${result.subResults.length} sub-task(s)\n`))

console.log(chalk.bold.cyan('Synthesis:'))
console.log(chalk.white(result.synthesis))

console.log(chalk.dim('\nSub-task results:'))
for (const sr of result.subResults) {
  const icon = sr.success ? chalk.green('✓') : chalk.red('✗')
  console.log(` ${icon} ${chalk.bold(sr.subTask.slice(0, 80))}`)
  if (!sr.success) console.log(chalk.red(`   ${sr.text}`))
}
console.log()
