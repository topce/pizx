/**
 * pizx — zx fork with native Pi AI integration
 *
 * @example
 * ```js
 * #!/usr/bin/env pizx
 * const branch = (await $`git branch --show-current`).stdout.trim()
 * const explanation = await π`explain this code in simple terms: ${code}`
 * await Π`fix the TypeScript errors in src/ and run tests`
 *
 * // Agent patterns
 * await Ρ`iteratively improve the error handling`
 * await Φ`review all files in src/`
 * await Σ`analyze security across the codebase`
 * const debate = await Δ`what architecture should we use?`
 * const doc = await Λ`analyze → document → review`
 * const polished = await Ψ`write a README`
 * await Ω`build a complete auth system`
 *
 * // Communication patterns
 * await Θ`collaborate on the architecture`
 * await Μ`brainstorm features for the project`
 * await Β`gather expert feedback on the design`
 *
 * // Orchestration topologies
 * await Α`iterate on this algorithm until optimal`
 * await Γ`research → analyze → validate → document`
 * ```
 *
 * API:
 *   $   — shell commands (unchanged from zx)
 *   π   — pi-ai text generation (small pi)
 *   Π   — pi-coding-agent with tools (capital pi)
 *
 *   Ρ   — Ralph Loop (iterative improvement)
 *   Φ   — Fleet (parallel agents)
 *   Σ   — Subagents (hierarchical delegation)
 *   Δ   — Debate (multi-perspective convergence)
 *   Λ   — Pipeline (sequential chain)
 *   Ψ   — Critique (generate → critique → improve)
 *   Ω   — Orchestrator (plan → dispatch → synthesize)
 *
 *   Θ   — Thread (multi-agent conversation)
 *   Μ   — Memory (shared blackboard)
 *   Β   — Broadcast (one-to-many messaging)
 *
 *   Α   — Adaptive (self-adjusting orchestration)
 *   Γ   — Graph (DAG-based execution)
 */

// ── Re-export all of zx ─────────────────────────────────────────────────────
// All standard zx APIs pass through unchanged.
export * from 'zx'

// ── pizx additions ─────────────────────────────────────────────────────────

export {
  type AdaptiveOptions,
  AdaptiveOutput,
  AdaptiveStep,
  // English word aliases
  adaptive,
  type BroadcastOptions,
  BroadcastOutput,
  BroadcastResponse,
  broadcast,
  type CallTrace,
  type CritiqueOptions,
  CritiqueOutput,
  CritiqueRound,
  createPatternTag,
  critique,
  type DebateOptions,
  DebateOutput,
  DebatePerspective,
  debate,
  FleetMemberOutput,
  type FleetOptions,
  FleetOutput,
  fleet,
  type GraphEdge,
  type GraphNode,
  GraphNodeResult,
  type GraphOptions,
  GraphOutput,
  graph,
  learn,
  MemoryEntry,
  type MemoryOptions,
  MemoryOutput,
  memory,
  type OrchestratorOptions,
  OrchestratorOutput,
  OrchestratorWorkerResult,
  orchestrator,
  type PatternFn,
  type PatternOptions,
  PatternOutput,
  PatternPromise,
  type PhaseEntry,
  type PipelineOptions,
  PipelineOutput,
  PipelineStageResult,
  pipeline,
  type QualityReviewResult,
  type RalphIterationSummary,
  type RalphOptions,
  RalphOutput,
  ralph,
  type SubagentOptions,
  SubagentOutput,
  SubagentResult,
  store,
  subagent,
  type TaskDescriptor,
  ThreadMessage,
  type ThreadOptions,
  ThreadOutput,
  team,
  thread,
  // Orchestration topologies
  Α,
  Β,
  Γ,
  Δ,
  // Communication patterns
  Θ,
  Λ,
  Μ,
  // Agent patterns
  Ρ,
  Σ,
  Φ,
  Ψ,
  Ω,
} from './patterns/index.ts'

import { π } from './pi.ts'

export { configurePi, type PiOptions, PiOutput, type PiPromise } from './pi.ts'
export {
  type AgentOptions,
  AgentOutput,
  AgentPromise,
  closeAgent,
  configureAgent,
  Π,
  Π as Pi,
} from './pi-agent.ts'
export { loadSkillContent, loadSkillContents, SKILL_PATHS } from './skill-loader.ts'
export { π, π as pi }
