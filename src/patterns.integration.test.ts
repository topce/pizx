/**
 * Integration tests for all agent patterns using a real local model.
 *
 * These tests call the local omlx/gemma-4 model running on a Mac Mini.
 * They verify that each pattern actually executes end-to-end with a real LLM.
 *
 * Only runs when PIZX_INTEGRATION=1 environment variable is set:
 *   PIZX_INTEGRATION=1 npx vitest --run src/patterns.integration.test.ts
 *
 * Requires:
 *   - omlx provider configured in pi (~/.pi/agent/models.json)
 *   - gemma-4-26B-A4B-it-MLX-4bit model available via omlx at
 *     http://Slobodans-Mac-mini.local:8000/v1
 *
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Local model configuration ────────────────────────────────────────────

const LOCAL_MODEL = 'omlx/gemma-4-26B-A4B-it-MLX-4bit'

/** The omlx model object to inject via pickModel mock */
function omlxModel(): any {
  return {
    id: 'gemma-4-26B-A4B-it-MLX-4bit',
    name: 'Gemma 4 26B (oMLX)',
    provider: 'omlx',
    api: 'openai-completions',
    baseUrl: 'http://Slobodans-Mac-mini.local:8000/v1',
    reasoning: true,
    input: ['text'],
    contextWindow: 128000,
    maxTokens: 16384,
  }
}

// Mock pickModel to return our local omlx model
vi.mock('./model-picker.ts', () => ({
  pickModel: vi.fn(() => omlxModel()),
}))

// ── Imports ──────────────────────────────────────────────────────────────

/** Check if integration mode is enabled */
function isIntegrationEnabled(): boolean {
  return process.env.PIZX_INTEGRATION === '1'
}

/** Skip helper for integration-only tests */
function integrationTest(name: string, fn: () => Promise<void>, timeoutMs = 120_000) {
  it.skipIf(!isIntegrationEnabled())(
    name,
    async () => {
      await fn()
    },
    timeoutMs
  )
}

// Spy on stdout/stderr to suppress noise
let stdoutSpy: ReturnType<typeof vi.spyOn>
let stderrSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
})

// ═══════════════════════════════════════════════════════════════════════════
// π — Basic LLM (baseline)
// ═══════════════════════════════════════════════════════════════════════════

describe('π — Basic LLM (local model)', () => {
  integrationTest('generates a short response', async () => {
    const { π } = await import('./pi.ts')
    const result = await π({
      model: LOCAL_MODEL,
      quiet: true,
      apiKey: 'gaga',
    })`Say "hello" and nothing else.`
    expect(result.text).toBeTruthy()
    expect(result.text.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Δ (Delta) — Debate
// ═══════════════════════════════════════════════════════════════════════════

describe('Δ — Debate (local model)', () => {
  integrationTest(
    'executes a 2-perspective single-round debate',
    async () => {
      const { Δ } = await import('./patterns/debate.ts')
      const result = await Δ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        perspectives: 2,
      })`What are the pros of TypeScript? Keep answers brief (under 50 words).`

      expect(result.perspectives.length).toBe(2)
      expect(result.conclusion).toBeTruthy()
      expect(result.conclusion.length).toBeGreaterThan(5)
      expect(result.trace.length).toBeGreaterThanOrEqual(3)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Φ (Phi) — Fleet
// ═══════════════════════════════════════════════════════════════════════════

describe('Φ — Fleet (local model)', () => {
  integrationTest(
    'executes 2 tasks in parallel',
    async () => {
      const { Φ } = await import('./patterns/fleet.ts')
      const result = await Φ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        tasks: [
          'List 1 benefit of testing. Keep under 20 words.',
          'List 1 benefit of documentation. Keep under 20 words.',
        ],
      })`ignored`

      expect(result.members.length).toBe(2)
      expect(result.successCount).toBe(2)
      expect(result.members[0].text.length).toBeGreaterThan(0)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Σ (Sigma) — Subagents
// ═══════════════════════════════════════════════════════════════════════════

describe('Σ — Subagents (local model)', () => {
  integrationTest(
    'decomposes, executes sub-tasks, and synthesizes',
    async () => {
      const { Σ } = await import('./patterns/subagent.ts')
      const result = await Σ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        subdomains: [
          'List 1 benefit of TypeScript. Keep brief.',
          'List 1 drawback of TypeScript. Keep brief.',
        ],
      })`Analyze TypeScript.`

      expect(result.subResults.length).toBe(2)
      expect(result.synthesis).toBeTruthy()
      expect(result.synthesis.length).toBeGreaterThan(5)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Λ (Lambda) — Pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('Λ — Pipeline (local model)', () => {
  integrationTest(
    'runs 2 sequential stages',
    async () => {
      const { Λ } = await import('./patterns/pipeline.ts')
      const result = await Λ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        stages: ['Write 1 sentence about testing.', 'Summarize that sentence in 3 words.'],
      })`ignored`

      expect(result.stages.length).toBe(2)
      expect(result.finalOutput.length).toBeGreaterThan(0)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Ψ (Psi) — Critique
// ═══════════════════════════════════════════════════════════════════════════

describe('Ψ — Critique (local model)', () => {
  integrationTest(
    'generates, critiques, and improves',
    async () => {
      const { Ψ } = await import('./patterns/critique.ts')
      const result = await Ψ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        rounds: 1,
      })`Write a short sentence about programming. Keep it under 20 words.`

      expect(result.rounds.length).toBe(1)
      expect(result.finalContent).toBeTruthy()
      expect(result.rounds[0].content).toBeTruthy()
      expect(result.rounds[0].critique).toBeTruthy()
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Ω (Omega) — Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

describe('Ω — Orchestrator (local model)', () => {
  integrationTest(
    'plans, dispatches workers, and synthesizes',
    async () => {
      const { Ω } = await import('./patterns/orchestrator.ts')
      const result = await Ω.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        workers: 2,
      })`List 2 benefits of code reviews. Keep brief.`

      expect(result.plan).toBeTruthy()
      expect(result.plan.length).toBeGreaterThan(5)
      expect(result.workerResults.length).toBeGreaterThanOrEqual(1)
      expect(result.synthesis).toBeTruthy()
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Θ (Theta) — Thread
// ═══════════════════════════════════════════════════════════════════════════

describe('Θ — Thread (local model)', () => {
  integrationTest(
    'runs a 2-agent conversation',
    async () => {
      const { Θ } = await import('./patterns/thread.ts')
      const result = await Θ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        agents: 2,
        turns: 1,
      })`What is a good programming practice? Keep responses under 30 words.`

      expect(result.messages.length).toBe(2)
      expect(result.conclusion).toBeTruthy()
      expect(result.conclusion.length).toBeGreaterThan(5)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Μ (Mu) — Memory / Shared Blackboard
// ═══════════════════════════════════════════════════════════════════════════

describe('Μ — Memory (local model)', () => {
  integrationTest(
    'writes to shared blackboard and consolidates',
    async () => {
      const { Μ } = await import('./patterns/memory.ts')
      const result = await Μ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        agents: 2,
        rounds: 1,
      })`What makes code readable? Keep brief.`

      expect(result.entries.length).toBe(2)
      expect(result.synthesis).toBeTruthy()
      expect(result.synthesis.length).toBeGreaterThan(5)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Β (Beta) — Broadcast
// ═══════════════════════════════════════════════════════════════════════════

describe('Β — Broadcast (local model)', () => {
  integrationTest(
    'broadcasts and synthesizes responses',
    async () => {
      const { Β } = await import('./patterns/broadcast.ts')
      const result = await Β.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        workers: 2,
      })`What is one benefit of automated testing? Keep under 20 words.`

      expect(result.responses.length).toBe(2)
      expect(result.synthesis).toBeTruthy()
      expect(result.synthesis.length).toBeGreaterThan(5)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Γ (Gamma) — Graph / DAG
// ═══════════════════════════════════════════════════════════════════════════

describe('Γ — Graph (local model)', () => {
  integrationTest(
    'executes a simple 2-node DAG',
    async () => {
      const { Γ } = await import('./patterns/graph.ts')
      const result = await Γ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        graph: {
          nodes: [
            { id: 'a', task: 'Write 1 short sentence about JavaScript. Under 15 words.' },
            { id: 'b', task: 'Restate the above in 2 words.' },
          ],
          edges: [{ from: 'a', to: 'b' }],
        },
      })`ignored`

      expect(result.nodeResults.length).toBe(2)
      expect(result.finalOutput).toBeTruthy()
      expect(result.finalOutput.length).toBeGreaterThan(0)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Α (Alpha) — Adaptive
// ═══════════════════════════════════════════════════════════════════════════

describe('Α — Adaptive (local model)', () => {
  integrationTest(
    'plans, executes one step, and evaluates',
    async () => {
      const { Α } = await import('./patterns/adaptive.ts')
      const result = await Α.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        maxSteps: 1,
        qualityThreshold: 0.95, // high threshold so it doesn't stop too early
      })`Describe the benefits of TypeScript in 1 sentence.`

      expect(result.steps.length).toBeGreaterThanOrEqual(1)
      expect(result.finalResult).toBeTruthy()
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Χ (Chi) — Cross-Agent Learning
// ═══════════════════════════════════════════════════════════════════════════

describe('Χ — Cross-Agent Learning (local model)', () => {
  integrationTest(
    'extracts insights from a described execution',
    async () => {
      const { Χ } = await import('./patterns/chi.ts')
      const result = await Χ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
      })`
Three agents worked together on a code review:
- Agent A analyzed the code
- Agent B reviewed for bugs
- Agent C wrote the documentation

Each worked sequentially and sometimes duplicated effort.

Extract learning insights from this setup.
`

      expect(result.insights.length).toBeGreaterThanOrEqual(1)
      expect(result.summary).toBeTruthy()
      expect(result.suggestedChanges).toBeTruthy()
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Ν (Nu) — Self-Organizing Teams
// ═══════════════════════════════════════════════════════════════════════════

describe('Ν — Self-Organizing Teams (local model)', () => {
  integrationTest(
    'negotiates roles and executes',
    async () => {
      const { Ν } = await import('./patterns/nu.ts')
      const result = await Ν.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        minAgents: 2,
        maxAgents: 2,
      })`List 1 benefit of pair programming. Keep brief.`

      expect(result.negotiatedRoles.length).toBeGreaterThanOrEqual(1)
      expect(result.workflow).toBeTruthy()
      expect(result.synthesis).toBeTruthy()
      expect(result.synthesis.length).toBeGreaterThan(5)
    },
    300_000
  )
})

// ═══════════════════════════════════════════════════════════════════════════
// Τ (Tau) — Tool-Mediated Orchestration
// ═══════════════════════════════════════════════════════════════════════════

describe('Τ — Tool-Mediated Orchestration (local model)', () => {
  integrationTest(
    'executes shared store pattern',
    async () => {
      const { Τ } = await import('./patterns/tau.ts')
      const result = await Τ.quiet({
        model: LOCAL_MODEL,
        apiKey: 'gaga',
        agents: 2,
        rounds: 1,
      })`What are the key features of TypeScript? Briefly describe.`

      expect(result.entries.length).toBeGreaterThanOrEqual(1)
      expect(result.finalState).toBeDefined()
      expect(Object.keys(result.finalState).length).toBeGreaterThanOrEqual(1)
      expect(result.synthesis).toBeTruthy()
      expect(result.synthesis.length).toBeGreaterThan(5)
    },
    300_000
  )
})
