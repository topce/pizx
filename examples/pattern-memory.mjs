#!/usr/bin/env pizx
/**
 * ─── pattern-memory.mjs — Μ (Mu) Memory ─────────────────────────────────────
 *
 * Shared blackboard pattern: multiple agents write findings in parallel,
 * each seeing what others have contributed. After all rounds, a consolidator
 * merges everything into a comprehensive synthesis.
 *
 * Run:
 *   pizx examples/pattern-memory.mjs
 *
 * Communication: Tool-Mediated (shared memory/blackboard)
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n Μ Memory — Shared Blackboard\n'))
console.log(chalk.dim(' Multiple agents write → read → refine → consolidate\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Μ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  agents: 3,
  rounds: 1,
})`
Analyze this pizx project — it's a zx fork with AI template tags.
What are the key architectural decisions?
What could be improved?
What's the next most valuable feature to add?
`

console.log(chalk.green(`\n ✓ Memory complete — ${result.entries.length} entries\n`))

console.log(chalk.bold.magenta('Synthesis:'))
console.log(chalk.white(result.synthesis))
console.log()

console.log(chalk.dim('Contributions:'))
for (const entry of result.entries) {
  console.log(chalk.yellow(`  [${entry.role}] Round ${entry.round}:`))
  console.log(chalk.dim(`    ${entry.content.slice(0, 150)}${entry.content.length > 150 ? '...' : ''}`))
}
console.log()
