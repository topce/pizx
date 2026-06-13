/**
 * Patterns index — re-exports all agent pattern tags.
 *
 * Available tags:
 *   Ρ (Rho)   — Ralph Loop: iterative self-correcting loop
 *   Φ (Phi)   — Fleet: parallel agent execution
 *   Σ (Sigma) — Subagents: hierarchical task delegation
 *   Δ (Delta) — Debate: multiple perspectives converge
 *   Λ (Lambda) — Pipeline: sequential agent chain
 *   Ψ (Psi)   — Critique: generate → critique → improve
 *   Ω (Omega) — Orchestrator: plan → dispatch → synthesize
 *   Θ (Theta) — Thread: multi-agent conversation
 *   Μ (Mu)    — Memory: shared blackboard pattern
 *   Β (Beta)  — Broadcast: one-to-many messaging
 *   Α (Alpha) — Adaptive: self-adjusting orchestration
 *   Γ (Gamma) — Graph: DAG-based task execution
 *   Ν (Nu)    — Self-Organizing Teams: auto-negotiate roles and workflow
 *   Χ (Chi)   — Cross-Agent Learning: extract patterns from execution traces
 *   Τ (Tau)   — Tool-Mediated Orchestration: shared structured key-value store
 */

export { type AdaptiveOptions, AdaptiveOutput, AdaptiveStep, Α } from './adaptive.ts'
export { type BroadcastOptions, BroadcastOutput, BroadcastResponse, Β } from './broadcast.ts'
export { type ChiOptions, ChiOutput, LearningInsight, Χ } from './chi.ts'
export { type CritiqueOptions, CritiqueOutput, CritiqueRound, Ψ } from './critique.ts'
export { type DebateOptions, DebateOutput, DebatePerspective, Δ } from './debate.ts'
export { FleetMemberOutput, type FleetOptions, FleetOutput, Φ } from './fleet.ts'
export {
  type GraphEdge,
  type GraphNode,
  GraphNodeResult,
  type GraphOptions,
  GraphOutput,
  Γ,
} from './graph.ts'
export { MemoryEntry, type MemoryOptions, MemoryOutput, Μ } from './memory.ts'
export { type NuOptions, NuOutput, NuRole, Ν } from './nu.ts'
export {
  type OrchestratorOptions,
  OrchestratorOutput,
  OrchestratorWorkerResult,
  Ω,
} from './orchestrator.ts'
export { type PipelineOptions, PipelineOutput, PipelineStageResult, Λ } from './pipeline.ts'
export { type RalphIterationSummary, type RalphOptions, RalphOutput, Ρ } from './ralph.ts'
export { type SubagentOptions, SubagentOutput, SubagentResult, Σ } from './subagent.ts'
export { type TauOptions, TauOutput, ToolMediatedEntry, Τ } from './tau.ts'
export { ThreadMessage, type ThreadOptions, ThreadOutput, Θ } from './thread.ts'

export {
  type CallTrace,
  confirmPhase,
  createPatternTag,
  mergeSystem,
  type PatternFn,
  type PatternOptions,
  PatternOutput,
  PatternPromise,
  type PhaseEntry,
  type QualityReviewResult,
  runQualityReview,
  type TaskDescriptor,
} from './types.ts'

// ── English word aliases ────────────────────────────────────────────────────
// Use these instead of Greek letters for improved readability and accessibility.
//   ralph       → Ρ (Ralph Loop)
//   fleet       → Φ (Fleet)
//   subagent    → Σ (Subagents)
//   debate      → Δ (Debate)
//   pipeline    → Λ (Pipeline)
//   critique    → Ψ (Critique)
//   orchestrator→ Ω (Orchestrator)
//   thread      → Θ (Thread)
//   memory      → Μ (Memory)
//   broadcast   → Β (Broadcast)
//   adaptive    → Α (Adaptive)
//   graph       → Γ (Graph)
//   team        → Ν (Nu — Self-Organizing Teams)
//   learn       → Χ (Chi — Cross-Agent Learning)
//   store       → Τ (Tau — Tool-Mediated Orchestration)

import { Α as _Α } from './adaptive.ts'
import { Β as _Β } from './broadcast.ts'
import { Χ as _Χ } from './chi.ts'
import { Ψ as _Ψ } from './critique.ts'
import { Δ as _Δ } from './debate.ts'
import { Φ as _Φ } from './fleet.ts'
import { Γ as _Γ } from './graph.ts'
import { Μ as _Μ } from './memory.ts'
import { Ν as _Ν } from './nu.ts'
import { Ω as _Ω } from './orchestrator.ts'
import { Λ as _Λ } from './pipeline.ts'
import { Ρ as _Ρ } from './ralph.ts'
import { Σ as _Σ } from './subagent.ts'
import { Τ as _Τ } from './tau.ts'
import { Θ as _Θ } from './thread.ts'

export const ralph = _Ρ
export const fleet = _Φ
export const subagent = _Σ
export const debate = _Δ
export const pipeline = _Λ
export const critique = _Ψ
export const orchestrator = _Ω
export const thread = _Θ
export const memory = _Μ
export const broadcast = _Β
export const adaptive = _Α
export const graph = _Γ
export const team = _Ν
export const learn = _Χ
export const store = _Τ
