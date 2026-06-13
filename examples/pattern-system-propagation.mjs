#!/usr/bin/env pizx
/**
 * ─── pattern-system-propagation.mjs — System Prompt Propagation ─────────────
 *
 * Demonstrates how the `system` option is propagated through all patterns
 * and π calls. Your prompt is NEVER silently discarded — it is prepended
 * to the pattern's own system prompt with a blank line separator.
 *
 * Merge logic (see mergeSystem() in src/patterns/types.ts):
 *   Your prompt + "\n\n" + Pattern's default prompt
 *
 * This means your context (persona, domain, constraints) is always included
 * alongside the pattern's task-specific instructions.
 *
 * Run:
 *   pizx examples/pattern-system-propagation.mjs
 */

import { chalk } from 'zx'

const MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold('\n ── System Prompt Propagation Demo ──\n'))

// ═════════════════════════════════════════════════════════════════════════════
// 1. π with system prompt
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 1. π — System prompt sets persona\n'))

const persona = await π({
  model: MODEL,
  system: 'You are a strict Unix sysadmin. Be terse and authoritative.',
})`
What is the best way to find large files on a Linux server?
`

console.log(`   ${chalk.cyan(persona)}`)
console.log(chalk.dim(`   Model: ${persona.modelUsed}  |  Duration: ${persona.duration}ms\n`))

// ═════════════════════════════════════════════════════════════════════════════
// 2. π — System prompt for structured output
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 2. π — Domain constraint via system\n'))

const jsonOnly = await π.quiet({
  model: MODEL,
  system: 'You output ONLY valid JSON. No explanations, no markdown, no extra text.',
})`
Generate a JSON array of 3 programming languages.
Each object must have: name, yearCreated, and paradigm.
`

console.log(`   ${chalk.green(jsonOnly)}`)
console.log()

// ═════════════════════════════════════════════════════════════════════════════
// 3. Pattern with system prompt
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 3. Ω Orchestrator — Persona + constraints\n'))

const archResult = await Ω({
  plannerModel: MODEL,
  workerModel: MODEL,
  workers: 2,
  quiet: true,
  system: `You are a senior Rust developer who values simplicity over abstraction.
Always prefer the simplest possible solution. Avoid unnecessary generics or macros.
Your output must be practical and immediately usable.`,
})`
Design a simple command-line argument parser in Rust.
It should support flags, options with values, and positional arguments.
Describe the API briefly — no full implementation, just the struct design and key functions.
`

console.log(chalk.green(`   Output:\n${chalk.cyan(archResult.text)}`))
console.log(chalk.dim(`   Calls: ${archResult.callCount}  |  Total tokens: ${archResult.totalTokens}\n`))

// ═════════════════════════════════════════════════════════════════════════════
// 4. Φ Fleet with system prompt
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 4. Φ Fleet — Team of experts\n'))

const fleetResult = await Φ({
  model: MODEL,
  quiet: true,
  system: 'You are a startup advisor. Give concise, actionable advice. No fluff.',
  tasks: [
    'Suggest one way to validate a product idea before building it. One sentence.',
    'Suggest one pricing strategy for a SaaS product. One sentence.',
  ],
})`Startup advice`
console.log(chalk.green(`   ${fleetResult.text}`))
console.log(chalk.dim(`   Calls: ${fleetResult.callCount}\n`))

// ═════════════════════════════════════════════════════════════════════════════
// 5. Without system (default behavior)
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 5. Without system — Uses pattern default\n'))

const defaultResult = await Φ({
  model: MODEL,
  quiet: true,
  tasks: ['List one programming principle you follow. One sentence.'],
})`Best practice`

console.log(chalk.green(`   ${defaultResult.text}`))
console.log(chalk.dim('\n   No system prompt → pattern uses its built-in default.\n'))

// ═════════════════════════════════════════════════════════════════════════════
// 6. Chaining: system + quiet together
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.blue(' 6. Option chaining with system\n'))

const chained = await π.quiet({
  model: MODEL,
  system: 'You are a database expert. Be precise.',
})`
What is a database index in one sentence?
`

console.log(`   ${chalk.cyan(chained)}`)
console.log(chalk.dim(`   Model: ${chained.modelUsed}\n`))

// ═════════════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════════════
console.log(chalk.bold(' ── How Propagation Works ──\n'))
console.log(chalk.dim('   Your system prompt is PREPENDED to the pattern\'s default:'))
console.log(chalk.dim('   ┌──────────────────────────────────────┐'))
console.log(chalk.dim('   │  Your custom system prompt            │'))
console.log(chalk.dim('   │                                      │'))
console.log(chalk.dim('   │  [pattern\'s default system prompt]   │'))
console.log(chalk.dim('   └──────────────────────────────────────┘'))
console.log(chalk.dim('\n   Available on: π, Π, and all 15 patterns (Ω Σ Δ Φ Λ Ψ Ρ Θ Μ Β Α Γ Ν Χ Τ)\n'))
