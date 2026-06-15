#!/usr/bin/env pizx
/**
 * pattern-execution-modes.mjs — hitl / semi / auto execution modes
 *
 * Demonstrates the three execution modes across all 7 supported patterns:
 *
 *   auto  — no gates, runs to completion (default, same as confirm: false)
 *   semi  — gates at major decision points (same as confirm: true)
 *   hitl  — gates before EVERY phase, human approves each step
 *
 * Patterns covered: π, Π, Ω, Σ, Φ, Λ, Ρ, Δ, Ψ
 *
 * Run:
 *   pizx examples/pattern-execution-modes.mjs
 *
 * Set MODE=hitl|semi|auto|all and WHICH=π|Π|Ω|Σ|Φ|Λ|Ρ|Δ|Ψ|all to filter.
 *
 *   MODE=semi WHICH=Ρ pizx examples/pattern-execution-modes.mjs   # Ralph in semi mode
 *   MODE=auto WHICH=all pizx examples/pattern-execution-modes.mjs # all patterns, no gates
 */

const MODE = process.env.MODE || 'all'
const WHICH = process.env.WHICH || 'all'
const run = (name) => WHICH === name || WHICH === 'all'
const useMode = (m) => MODE === m || MODE === 'all'

// ── Resolve confirm option from mode ───────────────────────────────────────

function confirmFor(mode) {
  switch (mode) {
    case 'hitl': return { hitl: true }
    case 'semi': return true       // backward-compatible shorthand
    case 'auto': return false      // or omit entirely
    default:    return undefined   // skip (default = auto)
  }
}

const label = (mode) => mode === 'hitl' ? 'hitl (gate every phase)' :
                      mode === 'semi' ? 'semi (gate major phases)' :
                      'auto (no gates)'

// ═══════════════════════════════════════════════════════════════════════════
// π — Text generation
// ═══════════════════════════════════════════════════════════════════════════

if (run('π')) {
  if (useMode('auto')) {
    console.log(`\n=== π (auto) ===`)
    try {
      const a = await π({ confirm: false })`What is 2+2? Reply with just the number.`
      console.log(`  ✓ ${a.text}`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
  if (useMode('semi')) {
    console.log(`\n=== π (semi) ===`)
    try {
      const a = await π({ confirm: true })`What is 2+2? Reply with just the number.`
      console.log(`  ✓ ${a.text}`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
  if (useMode('hitl')) {
    console.log(`\n=== π (hitl) ===`)
    try {
      const a = await π({ confirm: { hitl: true } })`What is 2+2? Reply with just the number.`
      console.log(`  ✓ ${a.text}`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Π — Coding agent
// ═══════════════════════════════════════════════════════════════════════════

if (run('Π')) {
  if (useMode('auto')) {
    console.log(`\n=== Π (auto) ===`)
    try {
      const a = await Π({ confirm: false, maxTurns: 2 })`list files in current directory`
      console.log(`  ✓ ${a.text.slice(0, 150)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
  if (useMode('semi')) {
    console.log(`\n=== Π (semi) ===`)
    try {
      const a = await Π({ confirm: true, maxTurns: 2 })`list files in current directory`
      console.log(`  ✓ ${a.text.slice(0, 150)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
  if (useMode('hitl')) {
    console.log(`\n=== Π (hitl) ===`)
    try {
      const a = await Π({ confirm: { hitl: true }, maxTurns: 2 })`list files`
      console.log(`  ✓ ${a.text.slice(0, 150)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Ω — Orchestrator: plan → dispatch → synthesize
//   hitl gates: plan, dispatch, synthesize
//   semi gates: plan, dispatch (backward compat — existing confirm behavior)
// ═══════════════════════════════════════════════════════════════════════════

if (run('Ω')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Ω Orchestrator — ${label(mode)} ===`)
    try {
      const r = await Ω({
        confirm: confirmFor(mode),
        workers: 2,
      })`Compare REST vs GraphQL in 2 sentences per approach`
      const ok = r.workerResults.filter(w => w.success).length
      console.log(`  ✓ ${ok}/${r.workerResults.length} workers, synthesis: ${r.synthesis.slice(0, 100)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Σ — Subagents: decompose → execute
//   hitl gates: decompose, execute (per-subdomain)
//   semi gates: decompose
// ═══════════════════════════════════════════════════════════════════════════

if (run('Σ')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Σ Subagents — ${label(mode)} ===`)
    try {
      const r = await Σ({
        confirm: confirmFor(mode),
        subdomains: ['Frontend state management options', 'Backend API framework options'],
      })`List 2 options per subdomain`
      console.log(`  ✓ ${r.subResults.length} sub-tasks, synthesis: ${r.synthesis.slice(0, 100)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Φ — Fleet: parallel execution
//   hitl gates: plan, per-task execute
//   semi gates: plan
// ═══════════════════════════════════════════════════════════════════════════

if (run('Φ')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Φ Fleet — ${label(mode)} ===`)
    try {
      const r = await Φ({
        confirm: confirmFor(mode),
        tasks: ['Name 3 statically-typed languages', 'Name 3 dynamically-typed languages'],
      })`Compare language types`
      const ok = r.members.filter(m => m.success).length
      console.log(`  ✓ ${ok}/${r.members.length} tasks, result: ${r.text.slice(0, 100)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Λ — Pipeline: sequential stages
//   hitl gates: plan, per-stage
//   semi gates: plan (before first stage)
// ═══════════════════════════════════════════════════════════════════════════

if (run('Λ')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Λ Pipeline — ${label(mode)} ===`)
    try {
      const r = await Λ({
        confirm: confirmFor(mode),
        stages: ['Write a one-sentence pitch for a note-taking app', 'Make it more compelling'],
      })`Create a pitch`
      console.log(`  ✓ ${r.stageResults.length} stages, output: ${r.text.slice(0, 100)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Ρ — Ralph Loop: iterative self-correcting
//   hitl gates: per-iteration
//   semi gates: per-iteration (all phases are major)
// ═══════════════════════════════════════════════════════════════════════════

if (run('Ρ')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Ρ Ralph Loop — ${label(mode)} ===`)
    try {
      const r = await Ρ({
        confirm: confirmFor(mode),
        maxIterations: 2,
        useTools: false,
      })`Write a one-sentence tagline for a CLI tool called "pizx"`
      console.log(`  ✓ ${r.iterationCount} iteration(s), completed: ${r.completed}`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Δ — Debate: multiple perspectives converge
//   hitl gates: per-round
//   semi gates: before first round only
// ═══════════════════════════════════════════════════════════════════════════

if (run('Δ')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Δ Debate — ${label(mode)} ===`)
    try {
      const r = await Δ({
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
// Ψ — Critique: generate → critique → improve
//   hitl gates: generate, review (per-round)
//   semi gates: generate only (first round)
// ═══════════════════════════════════════════════════════════════════════════

if (run('Ψ')) {
  for (const mode of ['auto', 'semi', 'hitl']) {
    if (!useMode(mode)) continue
    console.log(`\n=== Ψ Critique — ${label(mode)} ===`)
    try {
      const r = await Ψ({
        confirm: confirmFor(mode),
        rounds: 1,
      })`Write a short elevator pitch for a developer productivity tool`
      console.log(`  ✓ ${r.rounds.length} round(s), final: ${r.finalContent.slice(0, 100)}...`)
    } catch (e) { console.log(`  ✗ ${e.message}`) }
  }
}

console.log('\n── All execution mode examples complete ──\n')
