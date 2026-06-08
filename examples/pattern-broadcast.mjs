#!/usr/bin/env pizx
/**
 * ─── pattern-broadcast.mjs — Β (Beta) Broadcast ─────────────────────────────
 *
 * One lead agent broadcasts a question to all specialist workers.
 * Workers respond independently in parallel, then the lead synthesizes
 * all responses into a cohesive recommendation.
 *
 * Run:
 *   pizx examples/pattern-broadcast.mjs
 *
 * Communication: Broadcast (one-to-many) + Manager synthesis
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n Β Broadcast — One-to-Many Messaging\n'))
console.log(chalk.dim(' Lead → Broadcast → Workers respond → Synthesize\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Β({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  workers: 4,
})`
Evaluate this architectural decision: "Should we use TypeScript for our build
tool scripts instead of plain JavaScript?" Consider:
- Type safety benefits for tool code
- Build complexity and dependency management
- Developer experience and onboarding
- Ecosystem compatibility (esbuild, node APIs)
`

console.log(chalk.green(`\n ✓ Broadcast complete — ${result.responses.length} response(s)\n`))

console.log(chalk.bold.magenta('Synthesis:'))
console.log(chalk.white(result.synthesis))
console.log()

console.log(chalk.dim('Worker responses:'))
for (const wr of result.responses) {
  const icon = wr.success ? chalk.green('✓') : chalk.red('✗')
  console.log(chalk.yellow(`  ${icon} ${wr.role}:`))
  console.log(chalk.dim(`    ${wr.response.slice(0, 150)}${wr.response.length > 150 ? '...' : ''}`))
}
console.log()
