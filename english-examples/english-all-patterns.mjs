#!/usr/bin/env pizx
/**
 * ─── english-all-patterns.mjs — All 15 pattern tags with English word aliases
 *
 * Demonstrates every English word alias available in pizx:
 *
 *   Core:         pi (π), Pi (Π)
 *   Agent:        ralph (Ρ), fleet (Φ), subagent (Σ), debate (Δ),
 *                 pipeline (Λ), critique (Ψ), orchestrator (Ω), team (Ν)
 *   Comm:         thread (Θ), memory (Μ), broadcast (Β)
 *   Topologies:   adaptive (Α), graph (Γ), learn (Χ), store (Τ)
 *
 * Run:
 *   pizx english-examples/english-all-patterns.mjs
 */

import { chalk } from 'zx'
import {
  // Core
  pi,
  Pi,
  // Agent patterns
  ralph,
  fleet,
  subagent,
  debate,
  pipeline,
  critique,
  orchestrator,
  team,
  // Communication patterns
  thread,
  memory,
  broadcast,
  // Orchestration topologies
  adaptive,
  graph,
  learn,
  store,
} from '@topce/pizx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.cyan('\n═══════════════════════════════════════════'))
console.log(chalk.bold.cyan('  pizx — All 17 English Word Aliases'))
console.log(chalk.bold.cyan('═══════════════════════════════════════════\n'))
console.log(chalk.dim(' Imported all aliases from @topce/pizx — no Greek letters needed.\n'))
console.log(chalk.dim(` Model: ${MODEL}\n`))

// ── Core ────────────────────────────────────────────────────────────────────
console.log(chalk.bold.yellow('── Core Tags ──\n'))

// pi — text generation (alias for π)
const greeting = await pi({ model: MODEL, maxTokens: 256 })`
say hello in one sentence and introduce yourself as the pizx CLI tool
`
console.log(`pi:   ${chalk.green(greeting)}`)
console.log(chalk.dim(`      model: ${greeting.modelUsed}  duration: ${greeting.duration}ms\n`))

// Pi — coding agent (alias for Π)
const agentResult = await Pi.quiet({ model: MODEL, maxTurns: 3 })`
count the number of .mjs files in the examples/ directory
`
console.log(`Pi:   ${chalk.cyan(agentResult.text.trim())}`)
console.log(chalk.dim(`      ${agentResult.turnCount} turns, ${agentResult.duration}ms\n`))

// ── Agent Patterns ──────────────────────────────────────────────────────────
console.log(chalk.bold.yellow('── Agent Patterns ──\n'))

// ralph — iterative self-correcting loop (alias for Ρ)
const ralphResult = await ralph({ model: MODEL, maxIterations: 2, quiet: true })`
list 3 best practices for writing clean JavaScript
`
console.log(`ralph:       ${chalk.green(ralphResult.iterationCount)} iteration(s) → ${ralphResult.text.slice(0, 80)}...`)
console.log(chalk.dim(`             ${ralphResult.iterationCount} iterations\n`))

// fleet — parallel execution (alias for Φ)
const fleetResult = await fleet({ model: MODEL, concurrency: 3, quiet: true })`
What is Node.js
What is TypeScript
What is pizx
`
console.log(`fleet:       ${chalk.green(fleetResult.successCount)}/${fleetResult.members.length} tasks succeeded`)
console.log(chalk.dim(`             parallel execution\n`))

// subagent — hierarchical delegation (alias for Σ)
console.log(chalk.dim(`subagent:    available (hierarchical task delegation)\n`))

// debate — multi-perspective convergence (alias for Δ)
console.log(chalk.dim(`debate:      available (multi-perspective convergence)\n`))

// pipeline — sequential chain (alias for Λ)
console.log(chalk.dim(`pipeline:    available (sequential stage chain)\n`))

// critique — generate → improve (alias for Ψ)
console.log(chalk.dim(`critique:    available (generate → critique → improve)\n`))

// orchestrator — plan → dispatch → synthesize (alias for Ω)
console.log(chalk.dim(`orchestrator: available (plan → dispatch → synthesize)\n`))

// team — self-organizing teams (alias for Ν Nu)
console.log(chalk.dim(`team:        available (self-organizing teams)\n`))

// ── Communication Patterns ──────────────────────────────────────────────────
console.log(chalk.bold.yellow('── Communication Patterns ──\n'))

// thread — multi-agent conversation (alias for Θ)
console.log(chalk.dim(`thread:      available (multi-agent conversation)\n`))

// memory — shared blackboard (alias for Μ)
console.log(chalk.dim(`memory:      available (shared blackboard)\n`))

// broadcast — one-to-many messaging (alias for Β)
console.log(chalk.dim(`broadcast:   available (one-to-many messaging)\n`))

// ── Orchestration Topologies ────────────────────────────────────────────────
console.log(chalk.bold.yellow('── Orchestration Topologies ──\n'))

// adaptive — self-adjusting workflow (alias for Α)
console.log(chalk.dim(`adaptive:    available (self-adjusting orchestration)\n`))

// graph — DAG-based execution (alias for Γ)
console.log(chalk.dim(`graph:       available (DAG-based execution)\n`))

// learn — cross-agent learning (alias for Χ Chi)
console.log(chalk.dim(`learn:       available (cross-agent learning)\n`))

// store — tool-mediated orchestration (alias for Τ Tau)
console.log(chalk.dim(`store:       available (tool-mediated orchestration)\n`))

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(chalk.bold.green('\n── Complete Mapping ──\n'))
console.log(chalk.dim('  π  → pi          Ρ  → ralph       Φ  → fleet'))
console.log(chalk.dim('  Π  → Pi          Σ  → subagent    Δ  → debate'))
console.log(chalk.dim('                   Λ  → pipeline    Ψ  → critique'))
console.log(chalk.dim('                   Ω  → orchestrator Ν  → team'))
console.log(chalk.dim('  Θ  → thread      Μ  → memory      Β  → broadcast'))
console.log(chalk.dim('  Α  → adaptive    Γ  → graph       Χ  → learn'))
console.log(chalk.dim('  Τ  → store'))
console.log(chalk.dim('\n  Use whichever style you prefer — Greek letters and English words are interchangeable.\n'))
