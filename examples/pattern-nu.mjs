#!/usr/bin/env pizx
/**
 * Ν (Nu) — Self-Organizing Teams example.
 *
 * Demonstrates how the Ν tag auto-negotiates agent roles and workflow
 * for a given task, then executes and synthesizes.
 *
 * Usage: pizx examples/pattern-nu.mjs
 */

// Auto-negotiate roles for a security audit
console.log('=== Auto-negotiated security audit ===')
const audit = await Ν`audit this project for security vulnerabilities, code quality issues, and performance bottlenecks`
console.log(`\nNegotiated ${audit.negotiatedRoles.length} roles:`)
audit.negotiatedRoles.forEach(r => console.log(`  - ${r.name}: ${r.goal}`))
console.log(`Workflow: ${audit.workflow} (${audit.workflowReasoning})`)
console.log(`\n${audit.synthesis.slice(0, 500)}...`)

// With explicit min/max agent counts
console.log('\n=== With agent count bounds ===')
const plan = await Ν({ minAgents: 2, maxAgents: 4 })`design a real-time notification system`
console.log(`\nNegotiated ${plan.negotiatedRoles.length} roles`)
console.log(`Workflow: ${plan.workflow}`)
