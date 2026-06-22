#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-fanout-synthesize.mjs — Fanout-And-Synthesize ─────────
 *
 * Workflow Pattern 2 of 6 (from Claude Code dynamic workflows):
 *
 *   Task → [Worker 1, Worker 2, Worker 3] → Synthesize
 *
 * Fan out a task to multiple parallel workers, then synthesize their outputs
 * into a unified answer. This is pizx's sweet spot — multiple patterns support
 * this natively: Φ Fleet, Β Broadcast, Ω Orchestrator, Σ Subagents.
 *
 * This example demonstrates all four approaches so you can pick the right one.
 *
 * Run:
 *   pizx examples/pattern-workflow-fanout-synthesize.mjs
 *
 * Real-world use: code review across modules, research synthesis, risk analysis.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n ⚡ Fanout-And-Synthesize Workflow\n'))
console.log(chalk.dim(' Task → Parallel Workers → Synthesize\n'))

// ── Approach 1: Φ Fleet — simplest fanout ─────────────────────────────────
console.log(chalk.bold.yellow('\n─── Approach 1: Φ Fleet (simplest) ───\n'))
console.log(chalk.dim(' Each line = one parallel task. Fleet auto-collects results.\n'))

const fleetResult = await Φ({
  workerModel: WORKER_MODEL,
  concurrency: 5,
})`
Review the pizx project for code quality from these angles:
1. TypeScript type safety — check for any usage patterns
2. Error handling — look at try/catch coverage
3. Test coverage — assess what exists in pattern tests
4. API consistency — check if pattern tags have consistent interfaces
`

console.log(chalk.green(`✓ Fleet: ${fleetResult.successCount}/${fleetResult.members.length} succeeded\n`))
for (const member of fleetResult.members) {
  console.log(chalk.dim(`  ${member.success ? '✓' : '✗'} ${member.task.slice(0, 80)}`))
}
console.log()

// ── Approach 2: Β Broadcast — one question, many experts ──────────────────
console.log(chalk.bold.yellow('\n─── Approach 2: Β Broadcast (expert poll) ───\n'))
console.log(chalk.dim(' Same question broadcast to all workers with different roles.\n'))

const broadcastResult = await Β({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  roles: [
    'Security Expert — find vulnerabilities',
    'Performance Expert — find bottlenecks',
    'DX Expert — assess developer experience',
    'Architecture Expert — evaluate code structure',
  ],
})`
Evaluate the pizx project's readiness for a v1.0 release.
What are the top 2 concerns from your perspective?
`

console.log(chalk.green(`✓ Broadcast: ${broadcastResult.responses.length} responses\n`))
console.log(chalk.bold.magenta('Synthesis:'))
console.log(chalk.white(broadcastResult.synthesis.slice(0, 400)))
console.log()

// ── Approach 3: Ω Orchestrator — plan + fanout + synthesize ───────────────
console.log(chalk.bold.yellow('\n─── Approach 3: Ω Orchestrator (plan + fanout) ───\n'))
console.log(chalk.dim(' Adds a planning phase before fanout. Best for complex tasks.\n'))

const orchResult = await Ω({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  workers: 3,
  quiet: true,
})`
Analyze the pizx project and create a "State of the Project" report covering
code health, documentation quality, and feature completeness.
`

console.log(chalk.green(`✓ Orchestrator: ${orchResult.workerResults.length} workers\n`))
console.log(chalk.dim(`  Plan: ${orchResult.plan.slice(0, 120)}...`))
console.log()

// ── Quick comparison ──────────────────────────────────────────────────────
console.log(chalk.bold.cyan('─── When to use which ───'))
console.log(chalk.white(`
  Φ Fleet       → Simple parallel tasks, no coordination needed
  Β Broadcast   → One question, many perspectives, need synthesis
  Ω Orchestrator → Complex task, needs planning before fanout
  Σ Subagents   → Task naturally decomposes into sub-domains
`))

console.log(chalk.dim('✓ Fanout-And-Synthesize — 4 approaches demonstrated\n'))
