#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-tournament.mjs — Tournament ───────────────────────────
 *
 * Workflow Pattern 5 of 6 (from Claude Code dynamic workflows):
 *
 *   Attempts → Pairwise Judges → Final Judge → Winner
 *
 * Multiple candidates compete in rounds. In each round, pairs are compared
 * head-to-head and winners advance. A final judge picks the champion.
 *
 * pizx implements this via composition:
 *   Round 1: Φ (Fleet) generates all candidates
 *   Round 2: π pairwise comparisons (bracket)
 *   Final:   π selects the ultimate winner
 *
 * Run:
 *   pizx examples/pattern-workflow-tournament.mjs
 *
 * Real-world use: picking the best architecture, selecting a library,
 * choosing a naming convention, comparing algorithm designs.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.blue('\n ⚡ Tournament Workflow\n'))
console.log(chalk.dim(' Round 1: Φ Fleet generates → Round 2: π pairwise bracket → Final Judge\n'))

const PROBLEM = `
Design a caching strategy for a CLI tool that makes frequent LLM API calls.
The tool runs scripts that may call the same prompts repeatedly within a session.
Constraints: must work offline, respect token budgets, be transparent to users.
`

// ── Round 1: Generate 4 competing solutions ───────────────────────────────
console.log(chalk.bold.yellow('─── Round 1: Φ Fleet — Generate Competing Solutions ───\n'))

const solutions = await Φ({
  workerModel: WORKER_MODEL,
  concurrency: 4,
  tasks: [
    `Design a caching strategy with an LRU in-memory cache. ${PROBLEM}`,
    `Design a caching strategy with a file-system based cache (SQLite). ${PROBLEM}`,
    `Design a caching strategy with content-addressable hashing. ${PROBLEM}`,
    `Design a caching strategy with a hybrid approach (memory + disk). ${PROBLEM}`,
  ],
})`generate solutions`

const entries = solutions.members
  .filter((m) => m.success)
  .map((m, i) => ({
    id: String.fromCharCode(65 + i), // A, B, C, D
    name: ['LRU Memory Cache', 'SQLite Disk Cache', 'Content-Hash Cache', 'Hybrid Cache'][i],
    solution: m.text.trim(),
  }))

console.log(chalk.green(`✓ ${entries.length} solutions generated\n`))
for (const e of entries) {
  console.log(chalk.dim(`  [${e.id}] ${e.name}: ${e.solution.slice(0, 100)}...`))
}
console.log()

// ── Round 2: Pairwise bracket ─────────────────────────────────────────────
console.log(chalk.bold.yellow('─── Round 2: Pairwise Bracket ───\n'))

async function judgePair(a, b) {
  const result = await π({
    model: PLANNER_MODEL,
    quiet: true,
  })`
You are judging two competing solutions for: ${PROBLEM.slice(0, 200)}...

Compare these two approaches head-to-head. Pick the BETTER one.
Consider: simplicity, performance, reliability, edge case handling.

[Solution ${a.id}] ${a.name}:
${a.solution.slice(0, 500)}

[Solution ${b.id}] ${b.name}:
${b.solution.slice(0, 500)}

Reply with ONLY the letter of the winner: "${a.id}" or "${b.id}"
Then on the next line, a one-sentence reason.
`

  const lines = result.text.trim().split('\n')
  const winner = lines[0].trim().replace(/[^A-D]/g, '')
  const reason = lines[1] ?? ''
  return { winner, reason, a, b }
}

// Semi-finals: A vs B, C vs D
console.log(chalk.cyan('Semi-final 1: [A] LRU Memory vs [B] SQLite Disk\n'))
const sf1 = await judgePair(entries[0], entries[1])
console.log(chalk.green(`  Winner: [${sf1.winner}] — ${sf1.reason}\n`))

console.log(chalk.cyan('Semi-final 2: [C] Content-Hash vs [D] Hybrid\n'))
const sf2 = await judgePair(entries[2], entries[3])
console.log(chalk.green(`  Winner: [${sf2.winner}] — ${sf2.reason}\n`))

// Finals
const finalist1 = entries.find((e) => e.id === sf1.winner) ?? entries[0]
const finalist2 = entries.find((e) => e.id === sf2.winner) ?? entries[2]

console.log(chalk.cyan(`🏆 FINAL: [${finalist1.id}] vs [${finalist2.id}]\n`))
const final = await judgePair(finalist1, finalist2)

const champion = entries.find((e) => e.id === final.winner) ?? finalist1
console.log(chalk.bold.green(`\n═══ 🏆 CHAMPION: [${champion.id}] ${champion.name} ═══`))
console.log(chalk.white(`\n${champion.solution.slice(0, 400)}`))
console.log()

// ── Bracket visualization ─────────────────────────────────────────────────
console.log(chalk.bold.cyan('Tournament Bracket:'))
console.log(chalk.white(`
  [A] LRU Memory ──┐
                    ├── [${sf1.winner}] ──┐
  [B] SQLite Disk ──┘                     │
                                           ├── 🏆 [${final.winner}]
  [C] Content-Hash ─┐                     │
                    ├── [${sf2.winner}] ──┘
  [D] Hybrid ───────┘
`))

console.log(chalk.dim('✓ Tournament — bracket resolved\n'))
