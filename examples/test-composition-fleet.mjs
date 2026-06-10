#!/usr/bin/env pizx
/**
 * test-composition-fleet.mjs — Pattern composition inside Fleet
 *
 * Fleet tasks accept TaskDescriptor: plain strings for LLM calls,
 * or functions that invoke other patterns as sub-tasks.
 *
 * Run:   npm run test:composition-fleet
 *        pizx examples/test-composition-fleet.mjs
 */

import { chalk } from 'zx'

const PLANNER = 'deepseek/deepseek-v4-pro'
const WORKER  = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('Fleet with composed pattern tasks\n'))

const result = await Φ({
  plannerModel: PLANNER,
  workerModel: WORKER,
  tasks: [
    // Plain string — standard LLM call
    'List 3 key performance metrics for a web app.',

    // Function — Subagents pattern as a fleet member
    () => Σ({ quiet: true })`
      Propose 3 caching strategies for Node.js APIs.
      Cover: Redis, CDN, in-memory. Keep each under 50 words.
    `,

    // Function — Critique pattern as a fleet member
    () => Ψ({ quiet: true })`
      Review this statement: "Microservices are always better than monoliths."
      Provide a balanced analysis.
    `,
  ],
  quiet: true,
})`gather expert opinions`

console.log(chalk.green(`✓ ${result.successCount}/${result.members.length} tasks succeeded\n`))

for (const member of result.members) {
  const icon = member.success ? chalk.green('✓') : chalk.red('✗')
  const firstLine = member.text.split('\n')[0]
  console.log(`  ${icon} ${firstLine?.slice(0, 100) ?? '(empty)'}`)
}

console.log(chalk.dim(`\n  (${result.members.length} total — ${result.successCount} succeeded, ${result.failureCount} failed)\n`))
