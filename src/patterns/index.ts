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
  createPatternTag,
  type PatternFn,
  type PatternOptions,
  PatternOutput,
  PatternPromise,
  type QualityReviewResult,
  runQualityReview,
  mergeSystem,
} from './types.ts'
