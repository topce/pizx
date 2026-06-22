/**
 * Unit tests for pizx — π tag, Π tag, PiOutput, AgentOutput, CLI parsing.
 *
 * These tests do NOT require configured Pi models (no network calls).
 */

import { describe, expect, it } from 'vitest'
import { AgentOutput } from './pi-agent.ts'
import { PiOutput } from './pi-output.ts'

// ── PiOutput ────────────────────────────────────────────────────────────────

describe('PiOutput', () => {
  it('stores text and model info', () => {
    const out = new PiOutput('hello world', 'anthropic/claude-sonnet-4-5', [], 1000, 1200)
    expect(out.text).toBe('hello world')
    expect(out.modelUsed).toBe('anthropic/claude-sonnet-4-5')
    expect(out.duration).toBe(200)
  })

  it('toString returns text', () => {
    const out = new PiOutput('result', 'model-id')
    expect(out.toString()).toBe('result')
    expect(String(out)).toBe('result')
  })

  it('valueOf returns text', () => {
    const out = new PiOutput('  trimmed  ', 'm')
    expect(out.valueOf()).toBe('  trimmed  ')
  })

  it('length returns character count', () => {
    expect(new PiOutput('abc', 'm').length).toBe(3)
    expect(new PiOutput('', 'm').length).toBe(0)
  })

  it('lines returns line count', () => {
    expect(new PiOutput('one\ntwo\nthree', 'm').lines).toBe(3)
    expect(new PiOutput('single', 'm').lines).toBe(1)
  })

  it('default timestamps set to now', () => {
    const out = new PiOutput('x', 'm')
    expect(out.duration).toBeGreaterThanOrEqual(0)
  })
})

// ── AgentOutput ─────────────────────────────────────────────────────────────

describe('AgentOutput', () => {
  it('stores text and turn count', () => {
    const out = new AgentOutput('done', 3, 1000, 1500)
    expect(out.text).toBe('done')
    expect(out.turnCount).toBe(3)
    expect(out.duration).toBe(500)
  })

  it('toString and valueOf work', () => {
    const out = new AgentOutput('agent result', 1)
    expect(out.toString()).toBe('agent result')
    expect(out.valueOf()).toBe('agent result')
    expect(`${out}`).toBe('agent result')
  })
})

// ── π tag chaining (no network calls) ──────────────────────────────────────

describe('π tag', () => {
  it('is a function', async () => {
    const { π } = await import('./pi.ts')
    expect(typeof π).toBe('function')
  })

  it('has quiet property', async () => {
    const { π } = await import('./pi.ts')
    expect(typeof (π as any).quiet).toBe('function')
  })

  it('has stream property', async () => {
    const { π } = await import('./pi.ts')
    expect(typeof (π as any).stream).toBe('function')
  })

  it('call with options returns a new function', async () => {
    const { π } = await import('./pi.ts')
    const tag = π({ model: 'anthropic/claude-sonnet-4-5' })
    expect(typeof tag).toBe('function')
  })
})

// ── Π tag chaining (no network calls) ──────────────────────────────────────

describe('Π tag', () => {
  it('is a function', async () => {
    const { Π } = await import('./pi-agent.ts')
    expect(typeof Π).toBe('function')
  })

  it('has quiet property', async () => {
    const { Π } = await import('./pi-agent.ts')
    expect(typeof (Π as any).quiet).toBe('function')
  })
})

// ── CLI parseArgs (unit) ────────────────────────────────────────────────────

describe('CLI arg parsing', () => {
  // Cannot test directly (internal function), but we can test behavior via exec
  it('--version flag works', async () => {
    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execP = promisify(exec)

    const { stdout } = await execP('node dist/cli.js --version', { cwd: process.cwd() })
    expect(stdout.trim()).toMatch(/pizx\/\d+\.\d+\.\d+/)
  })

  it('--help flag works', async () => {
    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execP = promisify(exec)

    const { stdout } = await execP('node dist/cli.js --help', { cwd: process.cwd() })
    expect(stdout).toContain('Usage')
    expect(stdout).toContain('Pi AI')
    expect(stdout).toContain('π')
    expect(stdout).toContain('Π')
  })

  it('no args shows help', async () => {
    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execP = promisify(exec)

    const { stdout } = await execP('node dist/cli.js', { cwd: process.cwd() })
    expect(stdout).toContain('Usage')
  })
})

// ── PiOptions / AgentOptions interfaces ─────────────────────────────────────

describe('Option interfaces', () => {
  it('PiOptions has expected fields', () => {
    const opts: import('./pi.ts').PiOptions = {
      model: 'test/model',
      thinkingLevel: 'high',
      quiet: true,
      system: 'You are helpful',
      maxTokens: 1000,
    }
    expect(opts.model).toBe('test/model')
    expect(opts.thinkingLevel).toBe('high')
    expect(opts.quiet).toBe(true)
  })

  it('AgentOptions has expected fields', () => {
    const opts: import('./pi-agent.ts').AgentOptions = {
      cwd: '/tmp',
      quiet: false,
      maxTurns: 5,
    }
    expect(opts.quiet).toBe(false)
    expect(opts.maxTurns).toBe(5)
  })
})

// ── Pi settings loading ────────────────────────────────────────────────────

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPiSettings } from './load-pi-settings.ts'

const _settingsDir = mkdtempSync(join(tmpdir(), 'pizx-settings-'))

describe('loadPiSettings', () => {
  it('returns empty object when settings.json does not exist', () => {
    const result = loadPiSettings(_settingsDir)
    expect(result).toEqual({})
  })

  it('returns empty object for empty settings.json', () => {
    writeFileSync(join(_settingsDir, 'settings.json'), '{}')
    expect(loadPiSettings(_settingsDir)).toEqual({})
  })

  it('parses defaultModel from settings.json', () => {
    writeFileSync(
      join(_settingsDir, 'settings.json'),
      JSON.stringify({ defaultModel: 'claude-sonnet-4-5' })
    )
    expect(loadPiSettings(_settingsDir).defaultModel).toBe('claude-sonnet-4-5')
  })

  it('parses defaultProvider and defaultThinkingLevel', () => {
    writeFileSync(
      join(_settingsDir, 'settings.json'),
      JSON.stringify({ defaultProvider: 'anthropic', defaultThinkingLevel: 'high' })
    )
    const result = loadPiSettings(_settingsDir)
    expect(result.defaultProvider).toBe('anthropic')
    expect(result.defaultThinkingLevel).toBe('high')
  })

  it('returns empty object for corrupt JSON', () => {
    writeFileSync(join(_settingsDir, 'settings.json'), 'not valid json')
    expect(loadPiSettings(_settingsDir)).toEqual({})
  })

  it('reads all three fields together', () => {
    writeFileSync(
      join(_settingsDir, 'settings.json'),
      JSON.stringify({
        defaultModel: 'gpt-4o',
        defaultProvider: 'openai',
        defaultThinkingLevel: 'medium',
      })
    )
    expect(loadPiSettings(_settingsDir)).toEqual({
      defaultModel: 'gpt-4o',
      defaultProvider: 'openai',
      defaultThinkingLevel: 'medium',
    })
  })
})

// ── Pi installation detection ──────────────────────────────────────────────

import { homedir } from 'node:os'
import { getPiAgentDir, isPiInstalled } from './load-pi-settings.ts'

describe('Pi detection', () => {
  it('getPiAgentDir uses PI_CODING_AGENT_DIR env var', () => {
    const previous = process.env.PI_CODING_AGENT_DIR
    process.env.PI_CODING_AGENT_DIR = '/custom/pi/agent'
    expect(getPiAgentDir()).toBe('/custom/pi/agent')
    if (previous) process.env.PI_CODING_AGENT_DIR = previous
    else delete process.env.PI_CODING_AGENT_DIR
  })

  it('getPiAgentDir defaults to ~/.pi/agent', () => {
    expect(getPiAgentDir()).toBe(join(homedir(), '.pi', 'agent'))
  })

  it('isPiInstalled is a function', () => {
    expect(typeof isPiInstalled).toBe('function')
  })
})

// ── Pattern Outputs ─────────────────────────────────────────────────────────

import {
  CritiqueOutput,
  CritiqueRound,
  DebateOutput,
  DebatePerspective,
  FleetMemberOutput,
  FleetOutput,
  OrchestratorOutput,
  OrchestratorWorkerResult,
  PatternOutput,
  type PhaseEntry,
  PipelineOutput,
  PipelineStageResult,
  type QualityReviewResult,
  RalphOutput,
  SubagentOutput,
  SubagentResult,
  type TaskDescriptor,
} from './patterns/index.ts'

describe('PatternOutput', () => {
  it('stores text and duration', () => {
    const out = new PatternOutput('result', 1000, 1200)
    expect(out.text).toBe('result')
    expect(out.duration).toBe(200)
  })

  it('toString returns text', () => {
    const out = new PatternOutput('hello')
    expect(out.toString()).toBe('hello')
    expect(String(out)).toBe('hello')
  })

  it('valueOf returns text', () => {
    const out = new PatternOutput('world')
    expect(out.valueOf()).toBe('world')
  })

  it('default timestamps set to now', () => {
    const out = new PatternOutput('x')
    expect(out.duration).toBeGreaterThanOrEqual(0)
  })

  it('stores phase log entries', () => {
    const out = new PatternOutput('result', 1000, 1200)
    expect(out.phaseLog).toEqual([])
    const phase: PhaseEntry = {
      phase: 'plan',
      durationMs: 200,
      description: 'Generated plan',
      modelUsed: 'test-model',
    }
    out.phaseLog.push(phase)
    expect(out.phaseLog.length).toBe(1)
    expect(out.phaseLog[0].phase).toBe('plan')
    expect(out.phaseLog[0].durationMs).toBe(200)
  })
})

describe('RalphOutput', () => {
  it('stores iteration info', () => {
    const out = new RalphOutput('summary', 3, true, [], undefined, 1000, 1500)
    expect(out.text).toBe('summary')
    expect(out.iterationCount).toBe(3)
    expect(out.completed).toBe(true)
    expect(out.duration).toBe(500)
  })
})

describe('FleetOutput', () => {
  it('stores member results and tracks success/failure', () => {
    const m1 = new FleetMemberOutput('task1', 'done', true)
    const m2 = new FleetMemberOutput('task2', '', false, 'error')
    const out = new FleetOutput('summary', [m1, m2], 1000, 1200)
    expect(out.members.length).toBe(2)
    expect(out.successCount).toBe(1)
    expect(out.failureCount).toBe(1)
    expect(m1.task).toBe('task1')
    expect(m1.success).toBe(true)
    expect(m2.error).toBe('error')
  })
  it('stores quality review when provided', () => {
    const out = new FleetOutput('summary', [], 1000, 1200, {
      score: 0.75,
      assessment: 'Mixed results',
      recommendation: 'Retry failed tasks',
    })
    expect(out.qualityReview?.score).toBe(0.75)
  })
})

describe('SubagentOutput', () => {
  it('stores sub-results and synthesis', () => {
    const sr = new SubagentResult('subtask', 'result', true)
    const out = new SubagentOutput('synthesis', 'synthesis', [sr], 1000, 1200)
    expect(out.synthesis).toBe('synthesis')
    expect(out.subResults.length).toBe(1)
    expect(sr.subTask).toBe('subtask')
    expect(sr.success).toBe(true)
  })
  it('stores quality review when provided', () => {
    const out = new SubagentOutput('synth', 'synth', [], 1000, 1200, {
      score: 0.88,
      assessment: 'Good coverage',
      recommendation: 'Consider edge cases',
    })
    expect(out.qualityReview?.score).toBe(0.88)
    expect(out.qualityReview?.recommendation).toBe('Consider edge cases')
  })
})

describe('DebateOutput', () => {
  it('stores perspectives and conclusion', () => {
    const p = new DebatePerspective('Optimist', 'good')
    const out = new DebateOutput('conclusion', 'conclusion', [p], 1, 1000, 1200)
    expect(out.conclusion).toBe('conclusion')
    expect(out.perspectives.length).toBe(1)
    expect(out.rounds).toBe(1)
    expect(p.role).toBe('Optimist')
  })

  it('supports multi-round perspectives', () => {
    const p1 = new DebatePerspective('Optimist', 'initial', 1)
    const p2 = new DebatePerspective('Optimist', 'rebuttal', 2)
    const out = new DebateOutput('conclusion', 'conclusion', [p1, p2], 2, 1000, 1500)
    expect(out.rounds).toBe(2)
    expect(out.perspectives.length).toBe(2)
    expect(p1.round).toBe(1)
    expect(p2.round).toBe(2)
    expect(p1.argument).toBe('initial')
    expect(p2.argument).toBe('rebuttal')
  })

  it('stores quality review when provided', () => {
    const qr: QualityReviewResult = {
      score: 0.91,
      assessment: 'Well-reasoned',
      recommendation: 'Add data',
    }
    const out = new DebateOutput('conclusion', 'conclusion', [], 1, 1000, 1200, qr)
    expect(out.qualityReview?.score).toBe(0.91)
    expect(out.qualityReview?.assessment).toBe('Well-reasoned')
  })

  it('DebatePerspective round defaults to 1', () => {
    const p = new DebatePerspective('Pragmatist', 'analysis')
    expect(p.round).toBe(1)
  })
})

describe('PipelineOutput', () => {
  it('stores stage results and final output', () => {
    const sr = new PipelineStageResult('analyze', 'analysis', 0)
    const out = new PipelineOutput('summary', 'final', [sr], 1000, 1200)
    expect(out.finalOutput).toBe('final')
    expect(out.stages.length).toBe(1)
    expect(sr.stage).toBe('analyze')
    expect(sr.index).toBe(0)
  })
  it('stores quality review when provided', () => {
    const out = new PipelineOutput('summary', 'final', [], 1000, 1200, {
      score: 0.86,
      assessment: 'Pipeline output is clear',
      recommendation: 'Add more stages',
    })
    expect(out.qualityReview?.score).toBe(0.86)
  })
})

describe('CritiqueOutput', () => {
  it('stores critique rounds and final content', () => {
    const cr = new CritiqueRound('content', 'critique', 0)
    const out = new CritiqueOutput('summary', 'final', [cr], 1000, 1200)
    expect(out.finalContent).toBe('final')
    expect(out.rounds.length).toBe(1)
    expect(cr.round).toBe(0)
  })
})

describe('OrchestratorOutput', () => {
  it('stores plan, synthesis, and worker results', () => {
    const wr = new OrchestratorWorkerResult('task', 'output', true)
    const out = new OrchestratorOutput('summary', 'plan', 'synthesis', [wr], 1000, 1200)
    expect(out.plan).toBe('plan')
    expect(out.synthesis).toBe('synthesis')
    expect(out.workerResults.length).toBe(1)
    expect(wr.success).toBe(true)
  })
  it('stores quality review when provided', () => {
    const out = new OrchestratorOutput('summary', 'plan', 'synth', [], 1000, 1200, {
      score: 0.92,
      assessment: 'Complete and actionable',
      recommendation: 'Add more examples',
    })
    expect(out.qualityReview?.score).toBe(0.92)
    expect(out.qualityReview?.assessment).toBe('Complete and actionable')
  })
})

// ── Self-Organizing Teams (Ν) Outputs ──────────────────────────────────────

import { NuOutput, NuRole } from './patterns/nu.ts'

describe('NuOutput', () => {
  it('stores negotiated roles, workflow, and synthesis', () => {
    const role = new NuRole('Analyst', 'data analysis', 'analyze the data')
    const out = new NuOutput(
      'summary',
      [role],
      'parallel',
      'roles are independent',
      [{ role: 'Analyst', output: 'result' }],
      'synthesis',
      1000,
      1200
    )
    expect(out.negotiatedRoles.length).toBe(1)
    expect(out.workflow).toBe('parallel')
    expect(out.workflowReasoning).toBe('roles are independent')
    expect(out.synthesis).toBe('synthesis')
    expect(out.roleResults.length).toBe(1)
    expect(role.name).toBe('Analyst')
    expect(role.expertise).toBe('data analysis')
  })
  it('stores quality review when provided', () => {
    const out = new NuOutput('summary', [], 'parallel', 'no deps', [], 'synth', 1000, 1200, {
      score: 0.84,
      assessment: 'Team organized well',
      recommendation: 'Add more roles',
    })
    expect(out.qualityReview?.score).toBe(0.84)
  })
})

// ── Cross-Agent Learning (Χ) Outputs ───────────────────────────────────────

import { ChiOutput, LearningInsight } from './patterns/chi.ts'

describe('ChiOutput', () => {
  it('stores insights, summary, and suggested changes', () => {
    const ins = new LearningInsight(
      'communication',
      'agents repeated info',
      'share context once',
      0.85
    )
    const out = new ChiOutput('text', [ins], 'summary', 'use shared memory', 1000, 1200)
    expect(out.insights.length).toBe(1)
    expect(out.summary).toBe('summary')
    expect(out.suggestedChanges).toBe('use shared memory')
    expect(ins.category).toBe('communication')
    expect(ins.pattern).toBe('agents repeated info')
    expect(ins.confidence).toBe(0.85)
  })
  it('stores quality review when provided', () => {
    const out = new ChiOutput('text', [], 'summary', 'changes', 1000, 1200, {
      score: 0.9,
      assessment: 'Insights are actionable',
      recommendation: 'Prioritize top 3',
    })
    expect(out.qualityReview?.score).toBe(0.9)
  })
})

// ── Tool-Mediated Orchestration (Τ) Outputs ─────────────────────────────────

import { TauOutput, ToolMediatedEntry } from './patterns/tau.ts'

describe('TauOutput', () => {
  it('stores entries, finalState, and synthesis', () => {
    const entry = new ToolMediatedEntry('Analyst', 1, 'write', 'Market', 'market analysis')
    const finalState = { Market: 'market analysis', Risks: 'risk assessment' }
    const out = new TauOutput('summary', [entry], finalState, 'synthesis', 1000, 1200)
    expect(out.entries.length).toBe(1)
    expect(out.finalState).toEqual(finalState)
    expect(out.synthesis).toBe('synthesis')
    expect(entry.agent).toBe('Analyst')
    expect(entry.operation).toBe('write')
    expect(entry.key).toBe('Market')
    expect(entry.round).toBe(1)
  })
  it('stores quality review when provided', () => {
    const out = new TauOutput('summary', [], {}, 'synth', 1000, 1200, {
      score: 0.87,
      assessment: 'Store well-structured',
      recommendation: 'Add cross-references',
    })
    expect(out.qualityReview?.score).toBe(0.87)
  })
})

// ── Communication Pattern Outputs ───────────────────────────────────────────

import {
  AdaptiveOutput,
  AdaptiveStep,
  BroadcastOutput,
  BroadcastResponse,
  GraphNodeResult,
  GraphOutput,
  MemoryEntry,
  MemoryOutput,
  ThreadMessage,
  ThreadOutput,
} from './patterns/index.ts'

describe('ThreadOutput', () => {
  it('stores messages and conclusion', () => {
    const msg = new ThreadMessage('Proposer', 1, 'my argument')
    const out = new ThreadOutput('summary', 'conclusion', [msg], 1000, 1500)
    expect(out.conclusion).toBe('conclusion')
    expect(out.messages.length).toBe(1)
    expect(msg.role).toBe('Proposer')
    expect(msg.turn).toBe(1)
  })
  it('stores quality review when provided', () => {
    const out = new ThreadOutput('summary', 'conclusion', [], 1000, 1200, {
      score: 0.82,
      assessment: 'Good synthesis',
      recommendation: 'Add citations',
    })
    expect(out.qualityReview?.score).toBe(0.82)
  })
})

describe('MemoryOutput', () => {
  it('stores entries and synthesis', () => {
    const entry = new MemoryEntry('Analyst', 1, 'findings')
    const out = new MemoryOutput('summary', 'synthesis', [entry], 1000, 1500)
    expect(out.synthesis).toBe('synthesis')
    expect(out.entries.length).toBe(1)
    expect(entry.round).toBe(1)
  })
  it('stores quality review when provided', () => {
    const out = new MemoryOutput('summary', 'synth', [], 1000, 1200, {
      score: 0.79,
      assessment: 'Adequate coverage',
      recommendation: 'Deepen analysis',
    })
    expect(out.qualityReview?.score).toBe(0.79)
  })
})

describe('BroadcastOutput', () => {
  it('stores responses and synthesis', () => {
    const resp = new BroadcastResponse('Expert', 'answer', true)
    const out = new BroadcastOutput('summary', 'synthesis', [resp], 1000, 1500)
    expect(out.synthesis).toBe('synthesis')
    expect(out.responses.length).toBe(1)
    expect(resp.success).toBe(true)
  })
  it('stores quality review when provided', () => {
    const out = new BroadcastOutput('summary', 'synth', [], 1000, 1200, {
      score: 0.93,
      assessment: 'Excellent synthesis',
      recommendation: 'None',
    })
    expect(out.qualityReview?.score).toBe(0.93)
  })
})

describe('AdaptiveOutput', () => {
  it('stores steps with quality and adaptation', () => {
    const step = new AdaptiveStep(1, 'task', 'result', 0.85, 'CONTINUE')
    const out = new AdaptiveOutput('summary', 'final', [step], 2, 1000, 1500)
    expect(out.finalResult).toBe('final')
    expect(out.totalSteps).toBe(2)
    expect(step.quality).toBe(0.85)
    expect(step.adaptation).toBe('CONTINUE')
  })
})

describe('GraphOutput', () => {
  it('stores node results and final output', () => {
    const nr = new GraphNodeResult('step_1', 'task', 'output', true)
    const out = new GraphOutput('summary', 'final', [nr], 1000, 1500)
    expect(out.finalOutput).toBe('final')
    expect(out.nodeResults.length).toBe(1)
    expect(nr.nodeId).toBe('step_1')
  })
  it('stores quality review when provided', () => {
    const out = new GraphOutput('summary', 'final', [], 1000, 1200, {
      score: 0.81,
      assessment: 'Graph executed well',
      recommendation: 'Add error handling',
    })
    expect(out.qualityReview?.score).toBe(0.81)
  })
})

// ── Pattern Tag Factories (no network calls) ───────────────────────────────

describe('Ρ tag', () => {
  it('is a function', async () => {
    const { Ρ } = await import('./patterns/ralph.ts')
    expect(typeof Ρ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Ρ } = await import('./patterns/ralph.ts')
    expect(typeof (Ρ as any).quiet).toBe('function')
  })

  it('call with options returns a function', async () => {
    const { Ρ } = await import('./patterns/ralph.ts')
    const tag = Ρ({ maxIterations: 3 })
    expect(typeof tag).toBe('function')
  })
})

describe('Φ tag', () => {
  it('is a function', async () => {
    const { Φ } = await import('./patterns/fleet.ts')
    expect(typeof Φ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Φ } = await import('./patterns/fleet.ts')
    expect(typeof (Φ as any).quiet).toBe('function')
  })
})

describe('Σ tag', () => {
  it('is a function', async () => {
    const { Σ } = await import('./patterns/subagent.ts')
    expect(typeof Σ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Σ } = await import('./patterns/subagent.ts')
    expect(typeof (Σ as any).quiet).toBe('function')
  })
})

describe('Δ tag', () => {
  it('is a function', async () => {
    const { Δ } = await import('./patterns/debate.ts')
    expect(typeof Δ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Δ } = await import('./patterns/debate.ts')
    expect(typeof (Δ as any).quiet).toBe('function')
  })
})

describe('Λ tag', () => {
  it('is a function', async () => {
    const { Λ } = await import('./patterns/pipeline.ts')
    expect(typeof Λ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Λ } = await import('./patterns/pipeline.ts')
    expect(typeof (Λ as any).quiet).toBe('function')
  })
})

describe('Ψ tag', () => {
  it('is a function', async () => {
    const { Ψ } = await import('./patterns/critique.ts')
    expect(typeof Ψ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Ψ } = await import('./patterns/critique.ts')
    expect(typeof (Ψ as any).quiet).toBe('function')
  })
})

describe('Ω tag', () => {
  it('is a function', async () => {
    const { Ω } = await import('./patterns/orchestrator.ts')
    expect(typeof Ω).toBe('function')
  })

  it('has quiet property', async () => {
    const { Ω } = await import('./patterns/orchestrator.ts')
    expect(typeof (Ω as any).quiet).toBe('function')
  })
})

describe('Ν tag', () => {
  it('is a function', async () => {
    const { Ν } = await import('./patterns/nu.ts')
    expect(typeof Ν).toBe('function')
  })

  it('has quiet property', async () => {
    const { Ν } = await import('./patterns/nu.ts')
    expect(typeof (Ν as any).quiet).toBe('function')
  })

  it('call with options returns a function', async () => {
    const { Ν } = await import('./patterns/nu.ts')
    const tag = Ν({ minAgents: 2, maxAgents: 4 })
    expect(typeof tag).toBe('function')
  })
})

describe('Χ tag', () => {
  it('is a function', async () => {
    const { Χ } = await import('./patterns/chi.ts')
    expect(typeof Χ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Χ } = await import('./patterns/chi.ts')
    expect(typeof (Χ as any).quiet).toBe('function')
  })

  it('call with options returns a function', async () => {
    const { Χ } = await import('./patterns/chi.ts')
    const tag = Χ({ trace: 'test trace' })
    expect(typeof tag).toBe('function')
  })
})

describe('Τ tag', () => {
  it('is a function', async () => {
    const { Τ } = await import('./patterns/tau.ts')
    expect(typeof Τ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Τ } = await import('./patterns/tau.ts')
    expect(typeof (Τ as any).quiet).toBe('function')
  })

  it('call with options returns a function', async () => {
    const { Τ } = await import('./patterns/tau.ts')
    const tag = Τ({ agents: 4, rounds: 2 })
    expect(typeof tag).toBe('function')
  })
})

describe('Θ tag', () => {
  it('is a function', async () => {
    const { Θ } = await import('./patterns/thread.ts')
    expect(typeof Θ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Θ } = await import('./patterns/thread.ts')
    expect(typeof (Θ as any).quiet).toBe('function')
  })

  it('call with options returns a function', async () => {
    const { Θ } = await import('./patterns/thread.ts')
    const tag = Θ({ agents: 3, turns: 2 })
    expect(typeof tag).toBe('function')
  })
})

describe('Μ tag', () => {
  it('is a function', async () => {
    const { Μ } = await import('./patterns/memory.ts')
    expect(typeof Μ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Μ } = await import('./patterns/memory.ts')
    expect(typeof (Μ as any).quiet).toBe('function')
  })
})

describe('Β tag', () => {
  it('is a function', async () => {
    const { Β } = await import('./patterns/broadcast.ts')
    expect(typeof Β).toBe('function')
  })

  it('has quiet property', async () => {
    const { Β } = await import('./patterns/broadcast.ts')
    expect(typeof (Β as any).quiet).toBe('function')
  })
})

describe('Α tag', () => {
  it('is a function', async () => {
    const { Α } = await import('./patterns/adaptive.ts')
    expect(typeof Α).toBe('function')
  })

  it('has quiet property', async () => {
    const { Α } = await import('./patterns/adaptive.ts')
    expect(typeof (Α as any).quiet).toBe('function')
  })

  it('call with options returns a function', async () => {
    const { Α } = await import('./patterns/adaptive.ts')
    const tag = Α({ maxSteps: 3 })
    expect(typeof tag).toBe('function')
  })
})

describe('Γ tag', () => {
  it('is a function', async () => {
    const { Γ } = await import('./patterns/graph.ts')
    expect(typeof Γ).toBe('function')
  })

  it('has quiet property', async () => {
    const { Γ } = await import('./patterns/graph.ts')
    expect(typeof (Γ as any).quiet).toBe('function')
  })
})

// ── Patterns index re-exports ──────────────────────────────────────────────

describe('patterns/index', () => {
  it('re-exports all pattern tags', async () => {
    const patterns = await import('./patterns/index.ts')
    expect(typeof patterns.Ρ).toBe('function')
    expect(typeof patterns.Φ).toBe('function')
    expect(typeof patterns.Σ).toBe('function')
    expect(typeof patterns.Δ).toBe('function')
    expect(typeof patterns.Λ).toBe('function')
    expect(typeof patterns.Ψ).toBe('function')
    expect(typeof patterns.Ω).toBe('function')
    expect(typeof patterns.Θ).toBe('function')
    expect(typeof patterns.Μ).toBe('function')
    expect(typeof patterns.Β).toBe('function')
    expect(typeof patterns.Α).toBe('function')
    expect(typeof patterns.Γ).toBe('function')
    expect(typeof patterns.Ν).toBe('function')
    expect(typeof patterns.Χ).toBe('function')
    expect(typeof patterns.Τ).toBe('function')
    expect(typeof patterns.PatternOutput).toBe('function')
    expect(typeof patterns.PatternPromise).toBe('function')
  })
})

// ── Re-exports from load-pi-auth ───────────────────────────────────────────

import {
  getPiAgentDir as reExportedGetPiAgentDir,
  isPiInstalled as reExportedIsPiInstalled,
  loadPiSettings as reExportedLoadPiSettings,
} from './load-pi-auth.ts'

describe('load-pi-auth re-exports', () => {
  it('re-exports loadPiSettings', () => {
    expect(typeof reExportedLoadPiSettings).toBe('function')
  })

  it('re-exports isPiInstalled', () => {
    expect(typeof reExportedIsPiInstalled).toBe('function')
  })

  it('re-exports getPiAgentDir', () => {
    expect(typeof reExportedGetPiAgentDir).toBe('function')
  })
})

// ── Graph topoBatches (pure logic) ─────────────────────────────────────────

import { type GraphEdge, type GraphNode, topoBatches } from './patterns/graph.ts'

describe('TaskDescriptor', () => {
  it('accepts both strings and functions', () => {
    const tasks: TaskDescriptor[] = [
      'analyze the code',
      (prev: string) => Promise.resolve(`review: ${prev}`),
    ]
    expect(typeof tasks[0]).toBe('string')
    expect(typeof tasks[1]).toBe('function')
  })
  it('function can produce a string', async () => {
    const task: TaskDescriptor = (prev: string) => Promise.resolve(`processed: ${prev}`)
    const result = await task('input data')
    expect(result).toBe('processed: input data')
  })
})

describe('topoBatches', () => {
  it('empty nodes returns empty array', () => {
    expect(topoBatches([], [])).toEqual([])
  })

  it('single node returns one batch', () => {
    const nodes: GraphNode[] = [{ id: 'a', task: 'Task A' }]
    const edges: GraphEdge[] = []
    expect(topoBatches(nodes, edges)).toEqual([['a']])
  })

  it('two independent nodes run in same batch', () => {
    const nodes: GraphNode[] = [
      { id: 'a', task: 'A' },
      { id: 'b', task: 'B' },
    ]
    const edges: GraphEdge[] = []
    expect(topoBatches(nodes, edges)).toEqual([['a', 'b']])
  })

  it('chain A→B→C produces three sequential batches', () => {
    const nodes: GraphNode[] = [
      { id: 'a', task: 'A' },
      { id: 'b', task: 'B' },
      { id: 'c', task: 'C' },
    ]
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]
    expect(topoBatches(nodes, edges)).toEqual([['a'], ['b'], ['c']])
  })

  it('diamond A→B, A→C, B→D, C→D produces three batches', () => {
    const nodes: GraphNode[] = [
      { id: 'a', task: 'A' },
      { id: 'b', task: 'B' },
      { id: 'c', task: 'C' },
      { id: 'd', task: 'D' },
    ]
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ]
    expect(topoBatches(nodes, edges)).toEqual([['a'], ['b', 'c'], ['d']])
  })

  it('ignores edges referencing unknown nodes', () => {
    const nodes: GraphNode[] = [
      { id: 'a', task: 'A' },
      { id: 'b', task: 'B' },
    ]
    const edges: GraphEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'x', to: 'y' }, // unknown nodes
    ]
    expect(topoBatches(nodes, edges)).toEqual([['a'], ['b']])
  })
})
