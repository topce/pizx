#!/usr/bin/env pizx
/**
 * Τ (Tau) — Tool-Mediated Orchestration example.
 *
 * Demonstrates agents coordinating through a shared structured key-value store
 * with explicit read/write operations, no direct agent-to-agent messaging.
 *
 * Usage: pizx examples/pattern-tau.mjs
 */

// Single-round tool-mediated research
console.log('=== Tool-Mediated competitive research ===')
const research = await Τ`research the competitive landscape for a new project management SaaS tool`
console.log(`\nEntries: ${research.entries.length} operations across the shared store`)
console.log(`Keys in final state: ${Object.keys(research.finalState).join(', ')}`)
console.log(`\nSynthesis:\n${research.synthesis.slice(0, 500)}...`)

// Multi-round with more agents
console.log('\n=== Multi-round tool-mediated audit ===')
const audit = await Τ({ agents: 4, rounds: 2 })`audit the project for security, performance, accessibility, and code quality`
console.log(`\nEntries: ${audit.entries.length} (across ${audit.entries.filter(e => e.round === 1).length} writes and ${audit.entries.filter(e => e.round === 2).length} updates)`)
console.log(`Keys in final state: ${Object.keys(audit.finalState).join(', ')}`)
