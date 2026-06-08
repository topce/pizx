#!/usr/bin/env pizx
/**
 * ─── pattern-thread.mjs — Θ (Theta) Thread ──────────────────────────────────
 *
 * Multi-agent conversation where agents with different roles engage
 * in a back-and-forth discussion on a topic, then synthesize a conclusion.
 *
 * Run:
 *   pizx examples/pattern-thread.mjs
 *
 * Communication: Direct agent-to-agent message passing
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n Θ Thread — Multi-Agent Conversation\n'))
console.log(chalk.dim(' Proposer · Critic · Synthesizer — back-and-forth discussion\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const result = await Θ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  agents: 3,
  turns: 2,
})`
What is the best approach for implementing a real-time notification system
in a web application? Consider WebSockets, SSE, and polling.
`

console.log(chalk.green(`\n ✓ Thread complete — ${result.messages.length} messages\n`))

console.log(chalk.bold.magenta('Conclusion:'))
console.log(chalk.white(result.conclusion))
console.log()

console.log(chalk.dim('Conversation highlights:'))
const highlights = [0, Math.floor(result.messages.length / 2), result.messages.length - 1]
for (const idx of highlights) {
  if (idx < result.messages.length) {
    const m = result.messages[idx]
    console.log(chalk.yellow(`  [${m.role}] Turn ${m.turn}:`))
    console.log(chalk.dim(`    ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`))
  }
}
console.log()
