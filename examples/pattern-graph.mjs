#!/usr/bin/env pizx
/**
 * ─── pattern-graph.mjs — Γ (Gamma) Graph ────────────────────────────────────
 *
 * DAG-based task execution: each node is a task, edges define dependencies.
 * Tasks with all dependencies met run in parallel batches. The final output
 * is the result of the graph's sink node.
 *
 * Run:
 *   pizx examples/pattern-graph.mjs
 *
 * Orchestration: DAG-Based workflow
 * Topology: Directed Acyclic Graph
 */

import { chalk } from 'zx'

const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n Γ Graph — DAG-Based Task Execution\n'))
console.log(chalk.dim(' Nodes + edges → topological sort → parallel batches\n'))
console.log(chalk.dim(` Worker model: ${WORKER_MODEL}\n`))

const result = await Γ({
  workerModel: WORKER_MODEL,
})`
Analyze the pizx project structure →
Identify all the agentic patterns implemented →
Categorize them by orchestration type →
Suggest which pattern to use for which use case
`

console.log(chalk.green(`\n ✓ Graph complete — ${result.nodeResults.length} node(s)\n`))

for (const nr of result.nodeResults) {
  const icon = nr.success ? chalk.green('✓') : chalk.red('✗')
  console.log(chalk.yellow(`  ${icon} [${nr.nodeId}] ${nr.task.slice(0, 60)}...`))
  console.log(chalk.dim(`    ${nr.output.slice(0, 200)}${nr.output.length > 200 ? '...' : ''}`))
  console.log()
}

console.log(chalk.bold.magenta('Final Output:'))
console.log(chalk.white(result.finalOutput))
console.log()
