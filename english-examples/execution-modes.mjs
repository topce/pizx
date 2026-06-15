#!/usr/bin/env pizx
/**
 * execution-modes.mjs — hitl / semi / auto using English aliases
 *
 * Same as examples/pattern-execution-modes.mjs but uses English word aliases:
 *   pi (π), Pi (Π), orchestrator (Ω), subagent (Σ), fleet (Φ),
 *   pipeline (Λ), ralph (Ρ), debate (Δ), critique (Ψ)
 *
 * Run:
 *   pizx english-examples/execution-modes.mjs
 *
 * Set MODE=hitl|semi|auto|all and WHICH=pi|Pi|orchestrator|subagent|fleet|pipeline|ralph|debate|critique|all
 *
 *   MODE=semi WHICH=ralph pizx english-examples/execution-modes.mjs
 */

import {
  pi,
  Pi,
  orchestrator,
  subagent,
  fleet,
  pipeline,
  ralph,
  debate,
  critique,
} from '@topce/pizx'

const MODE = process.env.MODE || 'all'
const WHICH = process.env.WHICH || 'all'
const run = (name) => WHICH === name || WHICH === 'all'
const useMode = (m) => MODE === m || MODE === 'all'

// ── Resolve confirm option from mode ───────────────────────────────────────

function confirmFor(mode) {
  switch (mode) {
    case 'hitl': return { hitl: true }
    case 'semi': return true
    case 'auto': return false
    default:    return undefined
  }
}

const label = (mode) => mode === 'hitl' ? 'hitl (gate every phase)' :
                      mode === 'semi' ? 'semi (gate major phases)' :
                      'auto (no gates)'

// ═══════════════════════════════════════════════════════════════════════════
// pi — Text generation (English alias for π)
// ═══════════════════════════════════════════════════════════════════════════

if (run('pi')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== pi (English alias for π) — ${label(mode)} ===`)
    try {
      const a = await pi({ confirm: confirmFor(mode) })`What is 2+2? Reply with just the number.`
      console.log(`  ✓ ${a.text}`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pi — Coding agent (English alias for Π)
// ═══════════════════════════════════════════════════════════════════════════

if (run('Pi')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Pi (English alias for Π) — ${label(mode)} ===`)
    try {
      const a = await Pi({ confirm: confirmFor(mode), maxTurns: 2 })`list files in current directory`
      console.log(`  ✓ ${a.text.slice(0, 150)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// orchestrator — Plan → Dispatch → Synthesize (English alias for Ω)
//   hitl gates: plan, dispatch, synthesize
//   semi gates: plan, dispatch
// ═══════════════════════════════════════════════════════════════════════════

if (run('orchestrator')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== orchestrator (Ω) — ${label(mode)} ===`)
    try {
      const r = await orchestrator({
        confirm: confirmFor(mode),
        workers: 2,
      })`Compare REST vs GraphQL in 2 sentences per approach`
      const ok = r.workerResults.filter(w => w.success).length
      console.log(`  ✓ ${ok}/${r.workerResults.length} workers`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// subagent — Decompose → Execute (English alias for Σ)
//   hitl gates: decompose, execute (per-subdomain)
//   semi gates: decompose
// ═══════════════════════════════════════════════════════════════════════════

if (run('subagent')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== subagent (Σ) — ${label(mode)} ===`)
    try {
      const r = await subagent({
        confirm: confirmFor(mode),
        subdomains: ['Frontend state management options', 'Backend API framework options'],
      })`List 2 options per subdomain`
      console.log(`  ✓ ${r.subResults.length} sub-tasks`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// fleet — Parallel execution (English alias for Φ)
//   hitl gates: plan, per-task execute
//   semi gates: plan
// ═══════════════════════════════════════════════════════════════════════════

if (run('fleet')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== fleet (Φ) — ${label(mode)} ===`)
    try {
      const r = await fleet({
        confirm: confirmFor(mode),
        tasks: ['Name 3 statically-typed languages', 'Name 3 dynamically-typed languages'],
      })`Compare language types`
      const ok = r.members.filter(m => m.success).length
      console.log(`  ✓ ${ok}/${r.members.length} tasks`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// pipeline — Sequential stages (English alias for Λ)
//   hitl gates: plan, per-stage
//   semi gates: plan (before first stage)
// ═══════════════════════════════════════════════════════════════════════════

if (run('pipeline')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== pipeline (Λ) — ${label(mode)} ===`)
    try {
      const r = await pipeline({
        confirm: confirmFor(mode),
        stages: ['Write a one-sentence pitch for a note-taking app', 'Make it more compelling'],
      })`Create a pitch`
      console.log(`  ✓ ${r.stageResults.length} stages`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ralph — Iterative self-correcting loop (English alias for Ρ)
//   hitl gates: per-iteration
//   semi gates: per-iteration (all phases are major)
// ═══════════════════════════════════════════════════════════════════════════

if (run('ralph')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== ralph (Ρ) — ${label(mode)} ===`)
    try {
      const r = await ralph({
        confirm: confirmFor(mode),
        maxIterations: 2,
        useTools: false,
      })`Write a one-sentence tagline for a CLI tool called "pizx"`
      console.log(`  ✓ ${r.iterationCount} iteration(s), completed: ${r.completed}`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// debate — Multiple perspectives converge (English alias for Δ)
//   hitl gates: per-round
//   semi gates: before first round only
// ═══════════════════════════════════════════════════════════════════════════

if (run('debate')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== debate (Δ) — ${label(mode)} ===`)
    try {
      const r = await debate({
        confirm: confirmFor(mode),
        perspectives: 3,
        rounds: 2,
      })`Is TypeScript better than JavaScript? Give balanced arguments.`
      console.log(`  ✓ ${r.perspectives.length} perspectives, ${r.rounds} round(s)`)
      console.log(`    Conclusion: ${r.conclusion.slice(0, 100)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// critique — Generate → critique → improve (English alias for Ψ)
//   hitl gates: generate, review (per-round)
//   semi gates: generate only (first round)
// ═══════════════════════════════════════════════════════════════════════════

if (run('critique')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== critique (Ψ) — ${label(mode)} ===`)
    try {
      const r = await critique({
        confirm: confirmFor(mode),
        rounds: 1,
      })`Write a short elevator pitch for a developer productivity tool`
      console.log(`  ✓ ${r.rounds.length} round(s), final: ${r.finalContent.slice(0, 100)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

console.log('\n── All execution mode examples complete (English aliases) ──\n')
