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
  Α as _Α,
  Β as _Β,
  Γ as _Γ,
  Δ as _Δ,
  Θ as _Θ,
  Λ as _Λ,
  Μ as _Μ,
  Ρ as _Ρ,
  Σ as _Σ,
  Φ as _Φ,
  Ψ as _Ψ,
  Ω as _Ω,
} from './patterns/index.ts'
import { π as _π, configurePi } from './pi.ts'
import { Π as _Π, closeAgent, configureAgent } from './pi-agent.ts'

const g = globalThis as Record<string, unknown>

// Core tags
g.π = _π
g.Π = _Π

// Agent patterns
g.Ρ = _Ρ // Rho — Ralph Loop
g.Φ = _Φ // Phi — Fleet
g.Σ = _Σ // Sigma — Subagents
g.Δ = _Δ // Delta — Debate
g.Λ = _Λ // Lambda — Pipeline
g.Ψ = _Ψ // Psi — Critique
g.Ω = _Ω // Omega — Orchestrator

// Communication patterns
g.Θ = _Θ // Theta — Thread
g.Μ = _Μ // Mu — Memory
g.Β = _Β // Beta — Broadcast

// Orchestration topologies
g.Α = _Α // Alpha — Adaptive
g.Γ = _Γ // Gamma — Graph

// Helpers
g.configurePi = configurePi
g.configureAgent = configureAgent
g.closeAgent = closeAgent

// Named exports for explicit import
export {
  _Α as Α,
  _Β as Β,
  _Γ as Γ,
  _Δ as Δ,
  _Θ as Θ,
  _Λ as Λ,
  _Μ as Μ,
  _Π as Π,
  _Ρ as Ρ,
  _Σ as Σ,
  _Φ as Φ,
  _Ψ as Ψ,
  _Ω as Ω,
  _π as π,
  closeAgent,
  configureAgent,
  configurePi,
}
