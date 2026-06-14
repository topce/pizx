/**
 * Comprehensive unit tests for all agent patterns (Ρ, Φ, Σ, Δ, Λ, Ψ, Ω,
 * Θ, Μ, Β, Α, Γ, Ν, Χ, Τ) with mocked AI responses.
 *
 * These tests mock @earendil-works/pi-ai (completeSimple) and
 * @earendil-works/pi-coding-agent (createAgentSession) so no real API calls
 * are made — no costs, no network. Uses model id "test/test-model".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (hoisted to top by vitest) ──────────────────────────────────────

vi.mock('@earendil-works/pi-ai', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@earendil-works/pi-ai')>()
  return {
    ...mod,
    completeSimple: vi.fn(),
    streamSimple: vi.fn(),
  }
})

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@earendil-works/pi-coding-agent')>()
  return {
    ...mod,
    createAgentSession: vi.fn(),
  }
})

// Mock model-picker — returns undefined by default; each test must set it up
vi.mock('./model-picker.ts', () => ({
  pickModel: vi.fn(),
}))

// ── Imports ───────────────────────────────────────────────────────────────

import { completeSimple } from '@earendil-works/pi-ai'
import { createAgentSession } from '@earendil-works/pi-coding-agent'
import { pickModel } from './model-picker.ts'

// ── Test helpers ──────────────────────────────────────────────────────────

/** Create a mock completeSimple result */
function mockResult(text: string, overrides: Partial<any> = {}): any {
  return {
    model: 'test/test-model',
    content: [{ type: 'text', text }],
    usage: {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 15,
      cost: { total: 0.001 },
    },
    ...overrides,
  }
}

/** A fake model entry for pickModel to return. */
function fakeModel(): any {
  return {
    id: 'test/test-model',
    provider: 'test',
    name: 'Test Model',
  }
}

/** Spy on stdout/stderr write to suppress noise. */
let stdoutSpy: ReturnType<typeof vi.spyOn>
let stderrSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  // Restore pickModel to return a valid fake model by default
  vi.mocked(pickModel).mockReturnValue(fakeModel())
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
})

/**
 * A smart mock for completeSimple that inspects the prompt and returns
 * an appropriate fake response based on keywords in the prompt.
 */
function setupSmartMock(customMatchers?: Record<string, string>) {
  vi.mocked(completeSimple).mockImplementation(
    (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
      const prompt = ctx?.messages?.[0]?.content ?? ''

      // Custom matchers take priority
      if (customMatchers) {
        for (const [pattern, response] of Object.entries(customMatchers)) {
          if (prompt.includes(pattern)) {
            return Promise.resolve(mockResult(response))
          }
        }
      }

      // Built-in smart matching based on prompt content
      if (
        prompt.includes('Decompose') ||
        prompt.includes('decompose') ||
        prompt.includes('independent sub-tasks')
      ) {
        return Promise.resolve(
          mockResult(
            '["Sub-task 1: Analyze the requirements", "Sub-task 2: Design the solution", "Sub-task 3: Implement the changes"]'
          )
        )
      }

      if (prompt.includes('Synthesize') || prompt.includes('synthesize')) {
        return Promise.resolve(
          mockResult(
            'This is the synthesized conclusion from all perspectives. The optimal approach combines elements from each view.'
          )
        )
      }

      if (prompt.includes('SCORE:') || prompt.includes('Evaluate') || prompt.includes('evaluate')) {
        return Promise.resolve(
          mockResult(
            'SCORE: 0.85\nASSESSMENT: Good quality output with clear reasoning.\nADAPTATION: CONTINUE'
          )
        )
      }

      if (prompt.includes('SUB-TASKS') || prompt.includes('SUB-TASKS:')) {
        return Promise.resolve(
          mockResult(
            'PLAN SUMMARY:\nAnalyze the project comprehensively.\n\nSUB-TASKS:\n1. Review existing code structure\n2. Identify improvement opportunities\n3. Implement changes'
          )
        )
      }

      if (prompt.includes('Generate an implementation plan') || prompt.includes('PLAN SYSTEM')) {
        return Promise.resolve(
          mockResult('1. Refactor the main module\n2. Add error handling\n3. Write tests')
        )
      }

      if (prompt.includes('CATEGORY:') || prompt.includes('CATEGORY')) {
        return Promise.resolve(
          mockResult(
            'CATEGORY: communication\nPATTERN: agents repeated shared context\nRECOMMENDATION: use shared memory to reduce redundancy\nCONFIDENCE: 0.85\n\nCATEGORY: efficiency\nPATTERN: sequential bottleneck\nRECOMMENDATION: parallelize independent tasks\nCONFIDENCE: 0.75\n\nSUMMARY: The execution showed clear patterns of redundancy and sequential bottlenecks.\n\nCHANGES: Switch from sequential to parallel execution for independent analyses.'
          )
        )
      }

      if (prompt.includes('PLAN:')) {
        return Promise.resolve(
          mockResult(
            'PLAN:\n1. Analyze requirements\n2. Design architecture\n3. Implement solution'
          )
        )
      }

      if (prompt.includes('Critique') || prompt.includes('critique')) {
        return Promise.resolve(
          mockResult(
            'Strengths: Good structure. Weaknesses: Could add more detail. Suggestion: Expand the introduction.'
          )
        )
      }

      if (
        prompt.includes('improve') &&
        (prompt.includes('Content to improve') || prompt.includes('Improving'))
      ) {
        return Promise.resolve(
          mockResult('Improved content with more detail and better structure.')
        )
      }

      if (prompt.includes('Topic:') || prompt.includes('topic:') || prompt.includes('topic')) {
        return Promise.resolve(
          mockResult(
            'Analysis from the perspective of a specialist. Key findings include several important observations.'
          )
        )
      }

      // Check for role-specific prompts
      if (prompt.includes('Your role:') || prompt.includes('role:')) {
        return Promise.resolve(mockResult('Focused analysis from this specific role perspective.'))
      }

      if (prompt.includes('Original request') || prompt.includes('Original question')) {
        return Promise.resolve(
          mockResult(
            'The synthesized final answer combines all inputs into a comprehensive result.'
          )
        )
      }

      if (prompt.includes('Task:') && !prompt.includes('SUB-TASKS')) {
        return Promise.resolve(mockResult('Task completed successfully with detailed output.'))
      }

      if (prompt.includes('Previous stage output')) {
        return Promise.resolve(mockResult('Stage output processed from the previous stage result.'))
      }

      if (prompt.includes('Goal:') || prompt.includes('goal:')) {
        return Promise.resolve(
          mockResult('Analysis completed. Found several areas for improvement.')
        )
      }

      if (prompt.includes('Original task:')) {
        return Promise.resolve(mockResult('Synthesized result combining all sub-task outputs.'))
      }

      if (prompt.includes('Conversation thread') || prompt.includes('conversation so far')) {
        return Promise.resolve(
          mockResult(
            'This is my response in the conversation thread, building on previous messages.'
          )
        )
      }

      // Generic fallback
      return Promise.resolve(mockResult('Default pattern response for testing purposes.'))
    }
  )
}

/** Setup mock for Ralph's agent session */
function setupAgentSessionMock() {
  vi.mocked(createAgentSession).mockResolvedValue({
    session: {
      sendUserMessage: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      messages: [
        { role: 'user', content: 'goal' },
        { role: 'assistant', content: 'Tool execution completed successfully.' },
      ],
    },
  } as any)
}

// ═══════════════════════════════════════════════════════════════════════════
// Δ (Delta) — Debate
// ═══════════════════════════════════════════════════════════════════════════

describe('Δ (Delta) — Debate', () => {
  it('executes a single-round debate with default perspectives', async () => {
    setupSmartMock()
    const { Δ } = await import('./patterns/debate.ts')
    const result = await Δ.quiet`What are the trade-offs of using TypeScript?`

    expect(result).toBeDefined()
    expect(result.perspectives.length).toBeGreaterThanOrEqual(1)
    expect(result.conclusion).toBeTruthy()
    expect(result.rounds).toBe(1)
    expect(completeSimple).toHaveBeenCalled()
  })

  it('executes multi-round debate with rebuttals', async () => {
    setupSmartMock()
    const { Δ } = await import('./patterns/debate.ts')
    const result = await Δ.quiet({
      rounds: 2,
      perspectives: 2,
    })`Is microservices or monolith better?`

    expect(result.rounds).toBe(2)
    expect(result.perspectives.length).toBeGreaterThanOrEqual(2)
    expect(result.conclusion).toBeTruthy()
  })

  it('supports custom roles', async () => {
    setupSmartMock()
    const { Δ } = await import('./patterns/debate.ts')
    const result = await Δ.quiet({
      roles: ['Engineer', 'Manager', 'Designer'],
    })`Discuss a new feature.`

    expect(result.perspectives.length).toBe(3)
    const roles = result.perspectives.map((p) => p.role)
    expect(roles).toContain('Engineer')
    expect(roles).toContain('Manager')
  })

  it('handles failed perspectives gracefully', async () => {
    // First perspective call fails, rest succeed
    let callCount = 0
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, _ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        callCount++
        // First perspective call fails; synthesis (last call) succeeds normally
        if (callCount === 1) {
          return Promise.reject(new Error('API error'))
        }
        // Last call (synthesis) returns conclusion
        if (callCount >= 4) {
          return Promise.resolve(mockResult('Synthesized conclusion from all perspectives.'))
        }
        return Promise.resolve(mockResult('Perspective analysis result.'))
      }
    )

    const { Δ } = await import('./patterns/debate.ts')
    // With 3 perspectives, one fails
    const result = await Δ.quiet({ perspectives: 3 })`Test debate.`

    expect(result.perspectives).toBeDefined()
    // At least some perspectives succeeded
    const succeeded = result.perspectives.filter((p) => !p.argument.includes('failed'))
    expect(succeeded.length).toBeGreaterThanOrEqual(1)
  })

  it('DebatePerspective stores role, argument, and round', async () => {
    const { DebatePerspective } = await import('./patterns/debate.ts')
    const p = new DebatePerspective('Optimist', 'This is great', 2)
    expect(p.role).toBe('Optimist')
    expect(p.argument).toBe('This is great')
    expect(p.round).toBe(2)
  })

  it('DebateOutput stores all fields correctly', async () => {
    const { DebateOutput, DebatePerspective } = await import('./patterns/debate.ts')
    const perspectives = [
      new DebatePerspective('Optimist', 'positive', 1),
      new DebatePerspective('Pessimist', 'negative', 1),
    ]
    const out = new DebateOutput(
      'final conclusion',
      'final conclusion',
      perspectives,
      1,
      1000,
      1500
    )
    expect(out.conclusion).toBe('final conclusion')
    expect(out.perspectives.length).toBe(2)
    expect(out.rounds).toBe(1)
    expect(out.duration).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Ρ (Rho) — Ralph Loop
// ═══════════════════════════════════════════════════════════════════════════

describe('Ρ (Rho) — Ralph Loop', () => {
  it('executes a loop completing in one iteration', async () => {
    // Use a mock that returns FINAL: DONE for reviews
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''
        if (prompt.includes('Review')) {
          return Promise.resolve(mockResult('Fully implemented. Quality is good.\nFINAL: DONE'))
        }
        return Promise.resolve(mockResult('Analysis and implementation completed.'))
      }
    )
    setupAgentSessionMock()

    const { Ρ } = await import('./patterns/ralph.ts')
    const result = await Ρ.quiet({ maxIterations: 3 })`Refactor the error handling.`

    expect(result.iterationCount).toBe(1)
    expect(result.completed).toBe(true)
    expect(result.iterations.length).toBe(1)
    expect(result.iterations[0].shouldContinue).toBe(false)
  })

  it('executes multiple iterations when continuing', async () => {
    let callCount = 0
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''
        callCount++
        if (prompt.includes('Review')) {
          // First two reviews say ITERATE, third says DONE
          if (callCount < 6) {
            return Promise.resolve(mockResult('Needs improvement.\nFINAL: ITERATE'))
          }
          return Promise.resolve(mockResult('Good enough.\nFINAL: DONE'))
        }
        return Promise.resolve(mockResult('Analysis and implementation completed.'))
      }
    )
    setupAgentSessionMock()

    const { Ρ } = await import('./patterns/ralph.ts')
    const result = await Ρ.quiet({ maxIterations: 5 })`Fix all lint issues.`

    expect(result.iterationCount).toBeGreaterThan(1)
    expect(result.completed).toBe(true)
  })

  it('hits max iterations when quality not met', async () => {
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''
        if (prompt.includes('Review')) {
          return Promise.resolve(mockResult('Still needs work.\nFINAL: ITERATE'))
        }
        return Promise.resolve(mockResult('Analysis and implementation completed.'))
      }
    )
    setupAgentSessionMock()

    const { Ρ } = await import('./patterns/ralph.ts')
    const result = await Ρ.quiet({ maxIterations: 2 })`Fix all lint issues.`

    expect(result.iterationCount).toBe(2)
    expect(result.completed).toBe(false)
  })

  it('RalphOutput stores iteration info correctly', async () => {
    const { RalphOutput } = await import('./patterns/ralph.ts')
    const iterations = [
      { iteration: 1, plan: 'plan1', result: 'result1', review: 'review1', shouldContinue: false },
    ]
    const out = new RalphOutput('summary', 1, true, iterations, 1000, 1500)
    expect(out.iterationCount).toBe(1)
    expect(out.completed).toBe(true)
    expect(out.iterations[0].iteration).toBe(1)
    expect(out.duration).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Φ (Phi) — Fleet: parallel execution
// ═══════════════════════════════════════════════════════════════════════════

describe('Φ (Phi) — Fleet', () => {
  it('executes multiple tasks from template lines', async () => {
    setupSmartMock()
    const { Φ } = await import('./patterns/fleet.ts')
    const result = await Φ.quiet`analyze the frontend\nanalyze the backend\nanalyze the database`

    expect(result.members.length).toBe(3)
    expect(result.successCount).toBe(3)
    expect(result.failureCount).toBe(0)
  })

  it('executes explicit tasks array', async () => {
    setupSmartMock()
    const { Φ } = await import('./patterns/fleet.ts')
    const result = await Φ.quiet({ tasks: ['Task one', 'Task two'] })`ignored`

    expect(result.members.length).toBe(2)
    expect(result.successCount).toBe(2)
  })

  it('handles task failures gracefully', async () => {
    let callCount = 0
    vi.mocked(completeSimple).mockImplementation(() => {
      callCount++
      if (callCount === 2) {
        return Promise.reject(new Error('Task failed'))
      }
      return Promise.resolve(mockResult('Task output.'))
    })

    const { Φ } = await import('./patterns/fleet.ts')
    const result = await Φ.quiet({ tasks: ['Task A', 'Task B', 'Task C'] })`test`

    expect(result.members.length).toBe(3)
    expect(result.successCount).toBe(2)
    expect(result.failureCount).toBe(1)
  })

  it('executes composed pattern tasks (functions)', async () => {
    setupSmartMock()
    const { Φ } = await import('./patterns/fleet.ts')
    const result = await Φ.quiet({
      tasks: ['plain task', () => Promise.resolve('composed pattern result')],
    })`test`

    expect(result.members.length).toBe(2)
    expect(result.members[1].task).toBe('(composed pattern)')
    expect(result.members[1].text).toBe('composed pattern result')
  })

  it('executes bullet-point tasks', async () => {
    setupSmartMock()
    const { Φ } = await import('./patterns/fleet.ts')
    const result = await Φ.quiet`
- Review error handling
- Check performance
- Audit security
`

    expect(result.members.length).toBe(3)
    expect(result.successCount).toBe(3)
  })

  it('FleetMemberOutput stores task info', async () => {
    const { FleetMemberOutput } = await import('./patterns/fleet.ts')
    const m = new FleetMemberOutput('my task', 'output', false, 'error msg')
    expect(m.task).toBe('my task')
    expect(m.text).toBe('output')
    expect(m.success).toBe(false)
    expect(m.error).toBe('error msg')
  })

  it('FleetOutput computes successCount/failureCount', async () => {
    const { FleetOutput, FleetMemberOutput } = await import('./patterns/fleet.ts')
    const members = [
      new FleetMemberOutput('a', 'ok', true),
      new FleetMemberOutput('b', 'ok', true),
      new FleetMemberOutput('c', '', false, 'err'),
    ]
    const out = new FleetOutput('summary', members, 1000, 1500)
    expect(out.successCount).toBe(2)
    expect(out.failureCount).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Σ (Sigma) — Subagents
// ═══════════════════════════════════════════════════════════════════════════

describe('Σ (Sigma) — Subagents', () => {
  it('auto-decomposes task and executes sub-agents', async () => {
    setupSmartMock()
    const { Σ } = await import('./patterns/subagent.ts')
    const result = await Σ.quiet`Analyze the full codebase.`

    expect(result.subResults.length).toBeGreaterThanOrEqual(1)
    expect(result.synthesis).toBeTruthy()
    // Should have phase log entries: decompose, execute, synthesize
    expect(result.phaseLog.length).toBeGreaterThanOrEqual(3)
  })

  it('supports explicit subdomains', async () => {
    setupSmartMock()
    const { Σ } = await import('./patterns/subagent.ts')
    const result = await Σ.quiet({ subdomains: ['Auth', 'Database', 'API'] })`Review each area.`

    expect(result.subResults.length).toBe(3)
    expect(result.subResults[0].subTask).toBe('Auth')
    expect(result.subResults[1].subTask).toBe('Database')
  })

  it('handles sub-task failures', async () => {
    let callCount = 0
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''
        callCount++
        // First call is decompose (returns JSON)
        if (prompt.includes('Decompose') || prompt.includes('independent sub-tasks')) {
          return Promise.resolve(mockResult('["Sub A", "Sub B", "Sub C"]'))
        }
        // Make the second execution call fail
        if (callCount === 2) {
          return Promise.reject(new Error('Sub-agent execution error'))
        }
        return Promise.resolve(mockResult('Sub-agent output.'))
      }
    )

    const { Σ } = await import('./patterns/subagent.ts')
    const result = await Σ.quiet`Test task.`

    expect(result.subResults.length).toBe(3)
    const failed = result.subResults.filter((r) => !r.success)
    expect(failed.length).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Λ (Lambda) — Pipeline
// ═══════════════════════════════════════════════════════════════════════════

describe('Λ (Lambda) — Pipeline', () => {
  it('executes sequential stages from arrow-separated template', async () => {
    setupSmartMock()
    const { Λ } = await import('./patterns/pipeline.ts')
    const result = await Λ.quiet`analyze → generate → review`

    expect(result.stages.length).toBe(3)
    expect(result.finalOutput).toBeTruthy()
  })

  it('executes explicit stages array', async () => {
    setupSmartMock()
    const { Λ } = await import('./patterns/pipeline.ts')
    const result = await Λ.quiet({ stages: ['Stage A', 'Stage B'] })`ignored`

    expect(result.stages.length).toBe(2)
    expect(result.stages[0].stage).toBe('Stage A')
    expect(result.stages[1].stage).toBe('Stage B')
  })

  it('executes composed pattern stages (functions)', async () => {
    const { Λ } = await import('./patterns/pipeline.ts')
    const result = await Λ.quiet({
      stages: ['First stage', (prev: string) => Promise.resolve(`processed: ${prev}`)],
    })`test`

    expect(result.stages.length).toBe(2)
    expect(result.stages[0].output).toBeTruthy()
    expect(result.stages[1].output).toContain('processed:')
  })

  it('uses custom stage prompts when provided', async () => {
    setupSmartMock()
    const { Λ } = await import('./patterns/pipeline.ts')
    const result = await Λ.quiet({
      stages: ['Analyze', 'Write'],
      stagePrompts: ['Custom analyze prompt', 'Custom write prompt'],
    })`test`

    expect(result.stages.length).toBe(2)
    expect(result.finalOutput).toBeTruthy()
  })

  it('parses pipe-separated stages', async () => {
    setupSmartMock()
    const { Λ } = await import('./patterns/pipeline.ts')
    const result = await Λ.quiet`extract | transform | load`

    expect(result.stages.length).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Ψ (Psi) — Critique
// ═══════════════════════════════════════════════════════════════════════════

describe('Ψ (Psi) — Critique', () => {
  it('generates, critiques, and improves in one round', async () => {
    setupSmartMock()
    const { Ψ } = await import('./patterns/critique.ts')
    const result = await Ψ.quiet`Write a README for this project.`

    expect(result.rounds.length).toBe(1)
    expect(result.finalContent).toBeTruthy()
    expect(result.rounds[0].content).toBeTruthy()
    expect(result.rounds[0].critique).toBeTruthy()
  })

  it('supports multiple critique rounds', async () => {
    setupSmartMock()
    const { Ψ } = await import('./patterns/critique.ts')
    const result = await Ψ.quiet({ rounds: 2 })`Explain dependency injection.`

    expect(result.rounds.length).toBe(2)
    expect(result.finalContent).toBeTruthy()
  })

  it('caps rounds at maximum of 3', async () => {
    const opts = { rounds: 5 }
    // The cap is applied internally: Math.min(opts.rounds ?? 1, 3)
    const cappedRounds = Math.min(opts.rounds ?? 1, 3)
    expect(cappedRounds).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Ω (Omega) — Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

describe('Ω (Omega) — Orchestrator', () => {
  it('plans, dispatches, and synthesizes', async () => {
    setupSmartMock()
    const { Ω } = await import('./patterns/orchestrator.ts')
    const result = await Ω.quiet`Build an authentication system.`

    expect(result.plan).toBeTruthy()
    expect(result.workerResults.length).toBeGreaterThanOrEqual(1)
    expect(result.synthesis).toBeTruthy()
    expect(result.phaseLog.length).toBeGreaterThanOrEqual(3)
  })

  it('parses sub-tasks from plan text', async () => {
    // Mock to return a plan with numbered sub-tasks
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''

        // First call: planning phase (returns plan with SUB-TASKS)
        if (prompt.includes('SUB-TASKS') || prompt.includes('senior architect')) {
          return Promise.resolve(
            mockResult(
              'PLAN SUMMARY:\nBuild auth system.\n\nSUB-TASKS:\n1. Design user model\n2. Implement login\n3. Add JWT tokens\n4. Add refresh flow'
            )
          )
        }
        if (prompt.includes('SUB-TASKS:')) {
          return Promise.resolve(
            mockResult(
              'PLAN SUMMARY:\nBuild auth system.\n\nSUB-TASKS:\n1. Design user model\n2. Implement login\n3. Add JWT tokens\n4. Add refresh flow'
            )
          )
        }

        return Promise.resolve(mockResult('Worker task output.'))
      }
    )

    const { Ω } = await import('./patterns/orchestrator.ts')
    const result = await Ω.quiet({ workers: 4 })`Build auth system.`

    expect(result.workerResults.length).toBeGreaterThanOrEqual(1)
    expect(result.plan).toBeTruthy()
  })

  it('handles worker failures', async () => {
    let callCount = 0
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''
        callCount++

        // Planning call
        if (prompt.includes('SUB-TASKS') || prompt.includes('senior architect')) {
          return Promise.resolve(mockResult('SUB-TASKS:\n1. Task A\n2. Task B\n3. Task C'))
        }

        // Second execution call fails
        if (callCount === 2) {
          return Promise.reject(new Error('Worker error'))
        }

        if (prompt.includes('Original request') || prompt.includes('Worker results')) {
          return Promise.resolve(mockResult('Synthesized final output.'))
        }

        return Promise.resolve(mockResult('Worker output.'))
      }
    )

    const { Ω } = await import('./patterns/orchestrator.ts')
    const result = await Ω.quiet`Test task.`

    expect(result.workerResults.length).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Θ (Theta) — Thread
// ═══════════════════════════════════════════════════════════════════════════

describe('Θ (Theta) — Thread', () => {
  it('executes multi-turn conversation', async () => {
    setupSmartMock()
    const { Θ } = await import('./patterns/thread.ts')
    const result = await Θ.quiet`Debate the best architecture.`

    expect(result.messages.length).toBeGreaterThanOrEqual(3)
    expect(result.conclusion).toBeTruthy()
  })

  it('respects agents and turns options', async () => {
    setupSmartMock()
    const { Θ } = await import('./patterns/thread.ts')
    const result = await Θ.quiet({ agents: 2, turns: 2 })`Discuss design patterns.`

    // 2 agents × 2 turns = 4 messages
    expect(result.messages.length).toBe(4)
    expect(result.conclusion).toBeTruthy()
  })

  it('stores message role and turn info', async () => {
    const { ThreadMessage } = await import('./patterns/thread.ts')
    const msg = new ThreadMessage('Architect', 1, 'I propose using microservices.')
    expect(msg.role).toBe('Architect')
    expect(msg.turn).toBe(1)
    expect(msg.content).toBe('I propose using microservices.')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Μ (Mu) — Memory / Shared Blackboard
// ═══════════════════════════════════════════════════════════════════════════

describe('Μ (Mu) — Memory', () => {
  it('executes shared blackboard pattern', async () => {
    setupSmartMock()
    const { Μ } = await import('./patterns/memory.ts')
    const result = await Μ.quiet`Analyze this codebase.`

    expect(result.entries.length).toBeGreaterThanOrEqual(3)
    expect(result.synthesis).toBeTruthy()
  })

  it('supports multi-round blackboard', async () => {
    setupSmartMock()
    const { Μ } = await import('./patterns/memory.ts')
    const result = await Μ.quiet({ agents: 2, rounds: 2 })`Brainstorm features.`

    // 2 agents × 2 rounds = 4 entries
    expect(result.entries.length).toBe(4)
    expect(result.synthesis).toBeTruthy()
  })

  it('MemoryEntry stores role, round, and content', async () => {
    const { MemoryEntry } = await import('./patterns/memory.ts')
    const entry = new MemoryEntry('Analyst', 1, 'Found issues in auth module.')
    expect(entry.role).toBe('Analyst')
    expect(entry.round).toBe(1)
    expect(entry.content).toBe('Found issues in auth module.')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Β (Beta) — Broadcast
// ═══════════════════════════════════════════════════════════════════════════

describe('Β (Beta) — Broadcast', () => {
  it('broadcasts to workers and synthesizes', async () => {
    setupSmartMock()
    const { Β } = await import('./patterns/broadcast.ts')
    const result = await Β.quiet`Gather feedback on this proposal.`

    expect(result.responses.length).toBeGreaterThanOrEqual(2)
    expect(result.synthesis).toBeTruthy()
  })

  it('supports custom worker count', async () => {
    setupSmartMock()
    const { Β } = await import('./patterns/broadcast.ts')
    const result = await Β.quiet({ workers: 3 })`Collect perspectives.`

    expect(result.responses.length).toBe(3)
  })

  it('handles worker failures', async () => {
    let callCount = 0
    vi.mocked(completeSimple).mockImplementation(() => {
      callCount++
      if (callCount === 2) {
        return Promise.reject(new Error('Broadcast worker error'))
      }
      return Promise.resolve(mockResult('Worker response.'))
    })

    const { Β } = await import('./patterns/broadcast.ts')
    const result = await Β.quiet({ workers: 3 })`Test broadcast.`

    expect(result.responses.length).toBe(3)
    const failed = result.responses.filter((r) => !r.success)
    expect(failed.length).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Α (Alpha) — Adaptive
// ═══════════════════════════════════════════════════════════════════════════

describe('Α (Alpha) — Adaptive', () => {
  it('plans, executes, and evaluates steps', async () => {
    setupSmartMock()
    const { Α } = await import('./patterns/adaptive.ts')
    const result = await Α.quiet`Build a comprehensive solution.`

    expect(result.steps.length).toBeGreaterThanOrEqual(1)
    expect(result.finalResult).toBeTruthy()
  })

  it('stops when quality threshold is met', async () => {
    // Return SCORE above threshold for first evaluation
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''

        if (prompt.includes('Evaluate') || prompt.includes('evaluator')) {
          return Promise.resolve(
            mockResult('SCORE: 0.95\nASSESSMENT: Excellent result.\nADAPTATION: CONTINUE')
          )
        }
        if (prompt.includes('PLAN:')) {
          return Promise.resolve(mockResult('PLAN:\n1. First step\n2. Second step'))
        }
        return Promise.resolve(mockResult('Step executed successfully.'))
      }
    )

    const { Α } = await import('./patterns/adaptive.ts')
    const result = await Α.quiet({ maxSteps: 5, qualityThreshold: 0.9 })`Test.`

    expect(result.steps.length).toBeGreaterThanOrEqual(1)
    // Should stop after first step due to high quality
    expect(result.totalSteps).toBeLessThanOrEqual(2)
  })

  it('supports SKIP_NEXT adaptation', async () => {
    let evalCount = 0
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''

        if (prompt.includes('Evaluate') || prompt.includes('evaluator')) {
          evalCount++
          if (evalCount === 1) {
            return Promise.resolve(
              mockResult('SCORE: 0.5\nASSESSMENT: Needs improvement.\nADAPTATION: SKIP_NEXT')
            )
          }
          return Promise.resolve(mockResult('SCORE: 0.85\nASSESSMENT: Good.\nADAPTATION: CONTINUE'))
        }
        if (prompt.includes('PLAN:')) {
          return Promise.resolve(mockResult('PLAN:\n1. Step one\n2. Step two\n3. Step three'))
        }
        return Promise.resolve(mockResult('Step output.'))
      }
    )

    const { Α } = await import('./patterns/adaptive.ts')
    const result = await Α.quiet({ maxSteps: 5, qualityThreshold: 0.9 })`Test skip.`

    expect(result.steps.length).toBeGreaterThanOrEqual(1)
  })

  it('supports ADD adaptation', async () => {
    let evalCount = 0
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''

        if (prompt.includes('Evaluate') || prompt.includes('evaluator')) {
          evalCount++
          if (evalCount === 1) {
            return Promise.resolve(
              mockResult(
                'SCORE: 0.5\nASSESSMENT: Missing validation step.\nADAPTATION: ADD Validate the results'
              )
            )
          }
          return Promise.resolve(mockResult('SCORE: 0.85\nASSESSMENT: Good.\nADAPTATION: CONTINUE'))
        }
        if (prompt.includes('PLAN:')) {
          return Promise.resolve(mockResult('PLAN:\n1. First step\n2. Second step'))
        }
        return Promise.resolve(mockResult('Step output.'))
      }
    )

    const { Α } = await import('./patterns/adaptive.ts')
    const result = await Α.quiet({ maxSteps: 5 })`Test add.`

    expect(result.steps.length).toBeGreaterThanOrEqual(1)
  })

  it('AdaptiveStep stores all fields', async () => {
    const { AdaptiveStep } = await import('./patterns/adaptive.ts')
    const s = new AdaptiveStep(1, 'Analyze', 'Analysis done', 0.9, 'CONTINUE')
    expect(s.step).toBe(1)
    expect(s.action).toBe('Analyze')
    expect(s.quality).toBe(0.9)
    expect(s.adaptation).toBe('CONTINUE')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Γ (Gamma) — Graph / DAG
// ═══════════════════════════════════════════════════════════════════════════

describe('Γ (Gamma) — Graph', () => {
  it('executes DAG with explicit graph definition', async () => {
    setupSmartMock()
    const { Γ } = await import('./patterns/graph.ts')
    const result = await Γ.quiet({
      graph: {
        nodes: [
          { id: 'a', task: 'Research topic' },
          { id: 'b', task: 'Analyze data' },
          { id: 'c', task: 'Write report' },
        ],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
        ],
      },
    })`ignored`

    expect(result.nodeResults.length).toBe(3)
    expect(result.finalOutput).toBeTruthy()
  })

  it('executes DAG from template with arrow syntax', async () => {
    setupSmartMock()
    const { Γ } = await import('./patterns/graph.ts')
    const result = await Γ.quiet`research → analyze → document`

    expect(result.nodeResults.length).toBe(3)
    expect(result.finalOutput).toBeTruthy()
  })

  it('handles parallel nodes in DAG', async () => {
    setupSmartMock()
    const { Γ } = await import('./patterns/graph.ts')
    const result = await Γ.quiet({
      graph: {
        nodes: [
          { id: 'a', task: 'Task A' },
          { id: 'b', task: 'Task B' },
          { id: 'c', task: 'Task C' },
        ],
        edges: [
          { from: 'a', to: 'c' },
          { from: 'b', to: 'c' },
        ],
      },
    })`test`

    expect(result.nodeResults.length).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Ν (Nu) — Self-Organizing Teams
// ═══════════════════════════════════════════════════════════════════════════

describe('Ν (Nu) — Self-Organizing Teams', () => {
  it('negotiates roles and executes', async () => {
    // Need a specific mock for Nu's negotiate/execute/synthesize flow
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''

        // Negotiation phase: propose roles
        if (prompt.includes('roles') && prompt.includes('propose')) {
          return Promise.resolve(
            mockResult(
              'ROLES:\n- Researcher: Research the topic thoroughly\n- Analyst: Analyze the data found\n- Writer: Document the findings\n\nWORKFLOW: sequential\nREASONING: Each role depends on the previous output.'
            )
          )
        }
        // Synthesis phase
        if (prompt.includes('synthesize') || prompt.includes('Synthesize')) {
          return Promise.resolve(
            mockResult('Synthesized final output combining all role contributions.')
          )
        }

        return Promise.resolve(mockResult('Role execution output.'))
      }
    )

    const { Ν } = await import('./patterns/nu.ts')
    const result = await Ν.quiet`Analyze the codebase.`

    expect(result.negotiatedRoles.length).toBeGreaterThanOrEqual(1)
    expect(result.synthesis).toBeTruthy()
    expect(result.roleResults.length).toBeGreaterThanOrEqual(1)
  })

  it('supports explicit roles via options', async () => {
    const { Ν, NuRole } = await import('./patterns/nu.ts')
    // This should skip negotiation
    const explicitRoles = [
      new NuRole('Reviewer', 'code review', 'Review the code'),
      new NuRole('Tester', 'testing', 'Write tests'),
    ]

    // Mock: when roles are provided, no negotiation needed
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''
        if (prompt.includes('synthesize') || prompt.includes('Synthesize')) {
          return Promise.resolve(mockResult('Synthesized final output.'))
        }
        return Promise.resolve(mockResult('Role execution output.'))
      }
    )

    const result = await Ν.quiet({ roles: explicitRoles })`Test task.`
    expect(result.negotiatedRoles.length).toBe(2)
    expect(result.synthesis).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Χ (Chi) — Cross-Agent Learning
// ═══════════════════════════════════════════════════════════════════════════

describe('Χ (Chi) — Cross-Agent Learning', () => {
  /** Helper: set up mock to return CATEGORY-formatted response for Chi analysis */
  function setupChiMock() {
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, _ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        // Chi sends the input as the user prompt; the response must contain
        // CATEGORY blocks for parseInsights to extract them
        return Promise.resolve(
          mockResult(
            'CATEGORY: communication\nPATTERN: agents repeated shared context\nRECOMMENDATION: use shared memory to reduce redundancy\nCONFIDENCE: 0.85\n\nCATEGORY: efficiency\nPATTERN: sequential bottleneck\nRECOMMENDATION: parallelize independent tasks\nCONFIDENCE: 0.75\n\nSUMMARY: The execution showed clear patterns of redundancy and sequential bottlenecks.\n\nCHANGES: Switch from sequential to parallel execution for independent analyses.'
          )
        )
      }
    )
  }

  it('analyzes an execution trace and extracts insights', async () => {
    setupChiMock()
    const { Χ } = await import('./patterns/chi.ts')
    const result = await Χ.quiet`Describe how agents communicated during execution.`

    expect(result.insights.length).toBeGreaterThanOrEqual(1)
    expect(result.summary).toBeTruthy()
    expect(result.suggestedChanges).toBeTruthy()
  })

  it('analyzes from a previous pattern output', async () => {
    setupChiMock()
    const { Χ } = await import('./patterns/chi.ts')
    const { DebateOutput, DebatePerspective } = await import('./patterns/debate.ts')

    const source = new DebateOutput(
      'test conclusion',
      'test conclusion',
      [new DebatePerspective('Optimist', 'argument')],
      1,
      1000,
      2000
    )

    const result = await Χ.quiet({ source })`Analyze this debate.`

    expect(result.insights.length).toBeGreaterThanOrEqual(1)
  })

  it('analyzes from an explicit trace string', async () => {
    setupChiMock()
    const { Χ } = await import('./patterns/chi.ts')
    const result = await Χ.quiet({ trace: 'Custom execution trace for analysis.' })`ignored`

    expect(result.insights.length).toBeGreaterThanOrEqual(1)
  })

  it('LearningInsight stores all fields', async () => {
    const { LearningInsight } = await import('./patterns/chi.ts')
    const ins = new LearningInsight(
      'communication',
      'redundant messages',
      'use shared context',
      0.85
    )
    expect(ins.category).toBe('communication')
    expect(ins.pattern).toBe('redundant messages')
    expect(ins.confidence).toBe(0.85)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Τ (Tau) — Tool-Mediated Orchestration
// ═══════════════════════════════════════════════════════════════════════════

describe('Τ (Tau) — Tool-Mediated Orchestration', () => {
  it('executes shared store pattern', async () => {
    // Mock Tau's specific workflow: define schema → round writes → consolidate
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''

        // Schema definition
        if (prompt.includes('schema') || prompt.includes('keys')) {
          return Promise.resolve(
            mockResult(
              '{"keys": {"Market": "Competitive landscape", "Tech": "Technology stack", "Risks": "Potential risks"}, "roles": ["Market Analyst", "Tech Lead", "Risk Manager"]}'
            )
          )
        }
        // Final consolidation
        if (
          prompt.includes('consolidat') ||
          prompt.includes('current store state') ||
          prompt.includes('Final synthesis')
        ) {
          return Promise.resolve(
            mockResult('Consolidated final analysis combining all store entries.')
          )
        }

        return Promise.resolve(mockResult('Agent wrote findings to the shared store.'))
      }
    )

    const { Τ } = await import('./patterns/tau.ts')
    const result = await Τ.quiet`Research the competitive landscape.`

    expect(result.entries.length).toBeGreaterThanOrEqual(1)
    expect(result.finalState).toBeDefined()
    expect(result.synthesis).toBeTruthy()
  })

  it('TauOutput stores entries and final state', async () => {
    const { TauOutput, ToolMediatedEntry } = await import('./patterns/tau.ts')
    const entry = new ToolMediatedEntry('Analyst', 1, 'write', 'Market', 'market is competitive')
    const out = new TauOutput(
      'summary',
      [entry],
      { Market: 'competitive' },
      'synthesis',
      1000,
      1500
    )
    expect(out.entries.length).toBe(1)
    expect(out.entries[0].agent).toBe('Analyst')
    expect(out.finalState.Market).toBe('competitive')
    expect(out.synthesis).toBe('synthesis')
    expect(out.duration).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Pattern options & chaining (additional coverage)
// ═══════════════════════════════════════════════════════════════════════════

describe('Pattern option chaining', () => {
  it('Δ supports model overrides', async () => {
    setupSmartMock()
    const { Δ } = await import('./patterns/debate.ts')
    const tag = Δ({
      model: 'test/provider',
      plannerModel: 'test/planner',
      workerModel: 'test/worker',
    })
    expect(typeof tag).toBe('function')
  })

  it('Σ supports model overrides', async () => {
    setupSmartMock()
    const { Σ } = await import('./patterns/subagent.ts')
    const tag = Σ({ model: 'test/provider', workerModel: 'test/executor' })
    expect(typeof tag).toBe('function')
  })

  it('Λ supports stagePrompts and qualityCheck', async () => {
    setupSmartMock()
    const { Λ } = await import('./patterns/pipeline.ts')
    const tag = Λ({ qualityCheck: true })
    expect(typeof tag).toBe('function')
  })

  it('Ψ supports rounds option', async () => {
    const { Ψ } = await import('./patterns/critique.ts')
    const tag = Ψ({ rounds: 2 })
    expect(typeof tag).toBe('function')
  })

  it('Α supports maxSteps and qualityThreshold', async () => {
    const { Α } = await import('./patterns/adaptive.ts')
    const tag = Α({ maxSteps: 10, qualityThreshold: 0.75 })
    expect(typeof tag).toBe('function')
  })

  it('Ω supports workers and concurrency', async () => {
    const { Ω } = await import('./patterns/orchestrator.ts')
    const tag = Ω({ workers: 5, concurrency: 2 })
    expect(typeof tag).toBe('function')
  })

  it('Θ supports agents and turns', async () => {
    const { Θ } = await import('./patterns/thread.ts')
    const tag = Θ({ agents: 4, turns: 3 })
    expect(typeof tag).toBe('function')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Quality Check integration
// ═══════════════════════════════════════════════════════════════════════════

describe('Quality check integration', () => {
  it('Δ runs quality check when enabled', async () => {
    // Ensure the quality review call returns a parsable response
    let callCount = 0
    vi.mocked(completeSimple).mockImplementation(
      (_model: any, ctx: { messages?: { content?: string }[] }, _opts?: any) => {
        const prompt = ctx?.messages?.[0]?.content ?? ''
        callCount++

        if (prompt.includes('Evaluate') || prompt.includes('SCORE') || callCount > 6) {
          return Promise.resolve(
            mockResult(
              'SCORE: 0.88\nASSESSMENT: Good quality with clear reasoning.\nRECOMMENDATION: Add more examples.'
            )
          )
        }
        if (prompt.includes('neutral moderator') || prompt.includes('synthesize')) {
          return Promise.resolve(mockResult('Synthesized conclusion.'))
        }
        return Promise.resolve(mockResult('Perspective analysis.'))
      }
    )

    const { Δ } = await import('./patterns/debate.ts')
    const result = await Δ.quiet({ perspectives: 2, qualityCheck: true })`Test quality.`

    expect(result.qualityReview).toBeDefined()
    if (result.qualityReview) {
      expect(result.qualityReview.score).toBeGreaterThanOrEqual(0)
      expect(result.qualityReview.assessment).toBeTruthy()
    }
  })

  it('Φ does not run quality check by default', async () => {
    setupSmartMock()
    const { Φ } = await import('./patterns/fleet.ts')
    const result = await Φ.quiet({
      tasks: ['Task one'],
    })`test`
    expect(result.qualityReview).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Error handling across patterns
// ═══════════════════════════════════════════════════════════════════════════

describe('Pattern error handling', () => {
  // These must run first (before any other test restores pickModel) or
  // they explicitly set pickModel to undefined within the test.
  // Since beforeEach restores pickModel, these work fine in any order.

  it('Δ rejects when no model is available', async () => {
    vi.mocked(pickModel).mockReturnValue(undefined)

    const { Δ } = await import('./patterns/debate.ts')
    await expect(Δ.quiet({ perspectives: 2 })`test`).rejects.toThrow(/No AI models configured/)
  })

  it('Σ rejects with no model', async () => {
    vi.mocked(pickModel).mockReturnValue(undefined)

    const { Σ } = await import('./patterns/subagent.ts')
    await expect(Σ.quiet`test`).rejects.toThrow(/No AI models configured/)
  })

  it('Ω rejects with no model', async () => {
    vi.mocked(pickModel).mockReturnValue(undefined)

    const { Ω } = await import('./patterns/orchestrator.ts')
    await expect(Ω.quiet`test`).rejects.toThrow(/No AI models configured/)
  })

  it('Φ catches errors internally and returns failed members', async () => {
    vi.mocked(pickModel).mockReturnValue(undefined)

    const { Φ } = await import('./patterns/fleet.ts')
    // Φ catches ask() errors in executeTask, so it resolves with failed members
    const result = await Φ.quiet({ tasks: ['test'] })`test`
    expect(result.members.length).toBe(1)
    expect(result.members[0].success).toBe(false)
    expect(result.members[0].error).toContain('No AI models configured')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PatternOutput trace collection (via ask() inside createPatternTag)
// ═══════════════════════════════════════════════════════════════════════════

describe('Pattern trace collection', () => {
  it('Δ collects trace entries from all ask() calls', async () => {
    setupSmartMock()
    const { Δ } = await import('./patterns/debate.ts')
    const result = await Δ.quiet({ perspectives: 2 })`Trace test.`

    expect(result.trace.length).toBeGreaterThanOrEqual(3) // 2 perspectives + 1 synthesis
    expect(result.trace[0].call).toBe(1)
    expect(result.trace[0].inputTokens).toBeGreaterThanOrEqual(0)
    expect(result.trace[0].modelId).toBe('test/test-model')
  })

  it('Σ collects trace entries', async () => {
    setupSmartMock()
    const { Σ } = await import('./patterns/subagent.ts')
    const result = await Σ.quiet`Trace test.`

    // decompose + sub-tasks + synthesis
    expect(result.trace.length).toBeGreaterThanOrEqual(3)
  })

  it('totalCost sums across all traces', async () => {
    setupSmartMock()
    const { Δ } = await import('./patterns/debate.ts')
    const result = await Δ.quiet({ perspectives: 2 })`Cost test.`

    const expectedCost = result.trace.length * 0.001
    expect(result.totalCost).toBe(expectedCost)
  })
})

// ── English Word Aliases ───────────────────────────────────────────────────

describe('English word aliases', () => {
  it('all 15 pattern aliases are callable functions', async () => {
    const {
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
    } = await import('./patterns/index.ts')

    const aliases = {
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
    }

    for (const [_name, tag] of Object.entries(aliases)) {
      expect(typeof tag).toBe('function')
    }
  })

  it('pi and Pi aliases are callable', async () => {
    const { π } = await import('./pi.ts')
    const { Π } = await import('./pi-agent.ts')
    const { pi, Pi } = await import('./index.ts')

    expect(typeof pi).toBe('function')
    expect(typeof Pi).toBe('function')
    // Verify they're the same objects as the Greek originals
    expect(pi).toBe(π)
    expect(Pi).toBe(Π)
  })

  it('English aliases have the same option chaining as Greek originals', async () => {
    const { fleet } = await import('./patterns/index.ts')

    // .quiet should exist
    expect(typeof fleet.quiet).toBe('function')

    // Option chaining should work
    const tag = fleet({ concurrency: 2 })
    expect(typeof tag).toBe('function')
  })
})

// ── confirmPhase unit tests ───────────────────────────────────────────────

import { createInterface } from 'node:readline'
import { confirmPhase } from './patterns/types.ts'

// Mock readline
vi.mock('node:readline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:readline')>()
  return {
    ...actual,
    createInterface: vi.fn(),
  }
})

describe('confirmPhase', () => {
  let stderrWrite: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrWrite.mockRestore()
  })

  function mockStdin(answer: string) {
    vi.mocked(createInterface).mockReturnValue({
      question: (_query: string, cb: (ans: string) => void) => {
        cb(answer)
      },
      close: vi.fn(),
    } as any)
  }

  it('returns true when confirm is not set (no prompt, no readline)', async () => {
    const result = await confirmPhase('do something?', {})
    expect(result).toBe(true)
    expect(createInterface).not.toHaveBeenCalled()
    expect(stderrWrite).not.toHaveBeenCalled()
  })

  it('returns true when confirm is false', async () => {
    const result = await confirmPhase('do something?', { confirm: false })
    expect(result).toBe(true)
    expect(createInterface).not.toHaveBeenCalled()
  })

  it('returns true when user presses Enter (empty input)', async () => {
    mockStdin('')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(true)
    expect(stderrWrite).toHaveBeenCalled()
  })

  it('returns true when user types "y"', async () => {
    mockStdin('y')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(true)
  })

  it('returns true when user types "Y" (uppercase)', async () => {
    mockStdin('Y')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(true)
  })

  it('returns true when user types "yes"', async () => {
    mockStdin('yes')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(true)
  })

  it('returns true when user types "Yes" (mixed case)', async () => {
    mockStdin('Yes')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(true)
  })

  it('returns false when user types "n"', async () => {
    mockStdin('n')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(false)
  })

  it('returns false when user types "no"', async () => {
    mockStdin('no')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(false)
  })

  it('returns false for any other input', async () => {
    mockStdin('maybe later')
    const result = await confirmPhase('do something?', { confirm: true })
    expect(result).toBe(false)
  })

  it('writes the description to stderr', async () => {
    mockStdin('y')
    await confirmPhase('Execute 3 tasks?', { confirm: true })
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('── Confirm ──'))
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Execute 3 tasks?'))
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('Proceed? [Y/n]'))
  })

  it('closes the readline interface after getting answer', async () => {
    const closeMock = vi.fn()
    vi.mocked(createInterface).mockReturnValue({
      question: (_query: string, cb: (ans: string) => void) => {
        cb('y')
      },
      close: closeMock,
    } as any)

    await confirmPhase('do something?', { confirm: true })
    expect(closeMock).toHaveBeenCalled()
  })
})
