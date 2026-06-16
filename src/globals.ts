/**
 * pizx globals — injects π, Π, and all agent pattern tags into global scope.
 *
 * This module mirrors `zx/globals` pattern: it attaches all tags and helpers
 * to `globalThis`. User scripts can then reference them without explicit imports.
 *
 * Usage in CLI:
 *   await import('pizx/globals')
 *   // now π, Π, Ρ, Φ, Σ, Δ, Λ, Ψ, Ω are available
 */

import {
  adaptive,
  broadcast,
  critique,
  debate,
  fleet,
  graph,
  learn,
  memory,
  orchestrator,
  pipeline,
  ralph,
  store,
  subagent,
  team,
  thread,
  Α,
  Β,
  Γ,
  Δ,
  Θ,
  Λ,
  Μ,
  Ν,
  Ρ,
  Σ,
  Τ,
  Φ,
  Χ,
  Ψ,
  Ω,
} from './patterns/index.ts'
import { configurePi, π } from './pi.ts'
import { closeAgent, configureAgent, Π } from './pi-agent.ts'

const g = globalThis as Record<string, unknown>

// Core tags
g.π = π
g.Π = Π

// Agent patterns
g.Ρ = Ρ // Rho — Ralph Loop
g.Φ = Φ // Phi — Fleet
g.Σ = Σ // Sigma — Subagents
g.Δ = Δ // Delta — Debate
g.Λ = Λ // Lambda — Pipeline
g.Ψ = Ψ // Psi — Critique
g.Ω = Ω // Omega — Orchestrator

// Agent patterns (cont.)
g.Ν = Ν // Nu — Self-Organizing Teams

// Communication patterns
g.Θ = Θ // Theta — Thread
g.Μ = Μ // Mu — Memory
g.Β = Β // Beta — Broadcast

// Orchestration topologies
g.Α = Α // Alpha — Adaptive
g.Γ = Γ // Gamma — Graph
g.Χ = Χ // Chi — Cross-Agent Learning
g.Τ = Τ // Tau — Tool-Mediated Orchestration

// English word aliases (also exported as named bindings)
// NOTE: pi (lowercase) = π (text generation), Pi (capital) = Π (coding agent).
// Use `piAgent` for an unambiguous alias for Π.
const pi = π
const ai = π
const Pi = Π
const codingAgent = Π
g.pi = pi
g.ai = ai
g.Pi = Pi
g.codingAgent = codingAgent
g.ralph = ralph
g.fleet = fleet
g.subagent = subagent
g.debate = debate
g.pipeline = pipeline
g.critique = critique
g.orchestrator = orchestrator
g.thread = thread
g.memory = memory
g.broadcast = broadcast
g.adaptive = adaptive
g.graph = graph
g.team = team
g.learn = learn
g.store = store

// Helpers
g.configurePi = configurePi
g.configureAgent = configureAgent
g.closeAgent = closeAgent

// Named exports for explicit import
export {
  adaptive,
  // English word aliases
  ai,
  broadcast,
  closeAgent,
  codingAgent,
  configureAgent,
  configurePi,
  critique,
  debate,
  fleet,
  graph,
  learn,
  memory,
  orchestrator,
  pipeline,
  ralph,
  store,
  subagent,
  team,
  thread,
  Α,
  Β,
  Γ,
  Δ,
  Θ,
  Λ,
  Μ,
  Ν,
  Π,
  Ρ,
  Σ,
  Τ,
  Φ,
  Χ,
  Ψ,
  Ω,
  π,
}
