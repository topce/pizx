/**
 * Ν (Nu) — Self-Organizing Teams: auto-negotiate roles and workflow
 *
 * A meta-pattern where agents autonomously propose their own roles,
 * determine the optimal workflow structure, then execute and synthesize.
 *
 * Usage:
 *   await Ν`analyze the full codebase for security vulnerabilities`
 *   await Ν({ minAgents: 2, maxAgents: 5 })`design a real-time chat architecture`
 *   await Ν.quiet`plan the project roadmap`
 *
 * Flow:
 *   1. Analyze task → propose candidate roles (planner)
 *   2. Determine best workflow: sequential | parallel | mixed (planner)
 *   3. Execute roles according to the chosen workflow (worker)
 *   4. Synthesize all role outputs into final answer (planner)
 *
 * Pattern: Self-Organizing Teams (Advanced Technique)
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import {
  ask,
  build,
  type PatternFn,
  type PatternOptions,
  PatternOutput,
  PatternPromise,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface NuOptions extends PatternOptions {
  /** Minimum number of agents to propose. Default: 2 */
  minAgents?: number
  /** Maximum number of agents to propose. Default: 5 */
  maxAgents?: number
  /** Explicit roles (skip negotiation when provided). */
  roles?: NuRole[]
}

const defaults: NuOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  minAgents: 2,
  maxAgents: 5,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class NuRole {
  constructor(
    /** Role name, e.g. "Security Analyst" */
    public readonly name: string,
    /** Self-described domain expertise */
    public readonly expertise: string,
    /** What this role should accomplish for this task */
    public readonly goal: string
  ) {}
}

export class NuOutput extends PatternOutput {
  constructor(
    text: string,
    /** The auto-negotiated roles */
    public readonly negotiatedRoles: NuRole[],
    /** Chosen workflow: 'sequential' | 'parallel' | 'mixed' */
    public readonly workflow: 'sequential' | 'parallel' | 'mixed',
    /** Why this workflow was chosen */
    public readonly workflowReasoning: string,
    /** Results from each role execution */
    public readonly roleResults: { role: string; output: string }[],
    /** Synthesized final answer */
    public readonly synthesis: string,
    startTime: number,
    endTime: number
  ) {
    super(text, startTime, endTime)
  }
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const NEGOTIATE_SYSTEM = `You are a team architect. Given a task, propose a team of specialized agents. Each role must have a distinct name, expertise, and goal.

Output format — one role per block, exactly as shown:

ROLE:
NAME: Security Analyst
EXPERTISE: (1 sentence describing domain knowledge)
GOAL: (1 sentence describing what this role must accomplish)

ROLE:
NAME: Performance Engineer
EXPERTISE: (1 sentence)
GOAL: (1 sentence)

Propose between {min} and {max} roles. Each role must be clearly distinct.
Output only the role blocks — no preamble, no summary.`

const WORKFLOW_SYSTEM = `You are a workflow designer. Given a set of agent roles, determine the best execution strategy.

Rules:
- sequential: roles depend on each other's outputs (output of A is input to B)
- parallel: roles can work independently on different aspects
- mixed: some roles are independent, some depend on others' outputs

Output exactly:
WORKFLOW: (sequential | parallel | mixed)
REASONING: (1-2 sentences explaining why)`

const EXECUTE_SYSTEM = (role: NuRole) =>
  `You are a ${role.name}. Expertise: ${role.expertise}. Goal: ${role.goal}. Complete your assigned task thoroughly and concisely. Output your findings directly — no meta-commentary.`

const SYNTHESIS_SYSTEM = `You are a delivery manager. Synthesize the contributions from all team members into a coherent, comprehensive final answer. Combine overlapping insights, resolve conflicts, and prioritize the most impactful findings.`

// ── Phase 1: Negotiate roles ────────────────────────────────────────────────

async function negotiateRoles(task: string, opts: NuOptions): Promise<NuRole[]> {
  if (opts.roles && opts.roles.length > 0) return opts.roles

  const min = opts.minAgents ?? 2
  const max = opts.maxAgents ?? 5

  const prompt = NEGOTIATE_SYSTEM.replace('{min}', String(min)).replace('{max}', String(max))

  const response = await ask(`Task: ${task}\n\n${prompt}`, {
    model: opts.plannerModel ?? opts.model,
    maxTokens: 2048,
    thinkingLevel: 'high' as ThinkingLevel,
  })

  const roles: NuRole[] = []
  // Parse role blocks with regex
  const roleBlocks = response.split(/ROLE\s*:/i).filter((b) => b.trim())

  for (const block of roleBlocks) {
    const nameMatch = block.match(/NAME\s*:\s*(.+)/i)
    const expertiseMatch = block.match(/EXPERTISE\s*:\s*(.+)/i)
    const goalMatch = block.match(/GOAL\s*:\s*(.+)/i)

    if (nameMatch && expertiseMatch && goalMatch) {
      roles.push(new NuRole(nameMatch[1].trim(), expertiseMatch[1].trim(), goalMatch[1].trim()))
    }
  }

  if (roles.length === 0) {
    // Fallback: split response into lines and create generic roles
    const lines = response
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const fallbackRoles = lines.slice(0, max).map((line, i) => {
      const clean = line.replace(/^[-*\d]+[.)\s]*/, '').slice(0, 60)
      return new NuRole(`Agent ${i + 1}`, clean, `Execute sub-task: ${clean}`)
    })
    return fallbackRoles.length > 0
      ? fallbackRoles
      : [new NuRole('Generalist', 'Broad domain knowledge', task)]
  }

  return roles.slice(0, max)
}

// ── Phase 2: Decide workflow ────────────────────────────────────────────────

async function decideWorkflow(
  roles: NuRole[],
  task: string,
  opts: NuOptions
): Promise<{ workflow: 'sequential' | 'parallel' | 'mixed'; reasoning: string }> {
  if (roles.length <= 1)
    return { workflow: 'parallel', reasoning: 'Single role — no dependencies.' }

  const rolesText = roles.map((r, i) => `${i + 1}. ${r.name}: ${r.goal}`).join('\n')

  const response = await ask(
    `Task: ${task}\n\nRoles:\n${rolesText}\n\nDetermine the best execution strategy.`,
    {
      model: opts.plannerModel ?? opts.model,
      maxTokens: 512,
      thinkingLevel: 'high' as ThinkingLevel,
      system: WORKFLOW_SYSTEM,
    }
  )

  const wfMatch = response.match(/WORKFLOW\s*:\s*(.+)/i)
  const reasonMatch = response.match(/REASONING\s*:\s*(.+)/i)

  const workflowRaw = (wfMatch?.[1] ?? 'parallel').trim().toLowerCase()
  const workflow: 'sequential' | 'parallel' | 'mixed' = workflowRaw.startsWith('seq')
    ? 'sequential'
    : workflowRaw.startsWith('mix')
      ? 'mixed'
      : 'parallel'

  return {
    workflow,
    reasoning: reasonMatch?.[1]?.trim() ?? 'Auto-determined based on role dependencies.',
  }
}

// ── Phase 3: Execute ────────────────────────────────────────────────────────

async function executeRoles(
  roles: NuRole[],
  task: string,
  workflow: 'sequential' | 'parallel' | 'mixed',
  opts: NuOptions
): Promise<{ role: string; output: string }[]> {
  const workerModel = opts.workerModel ?? opts.model
  const results: { role: string; output: string }[] = []

  if (workflow === 'sequential') {
    // Chain: each role gets previous output as context
    let context = task
    for (const role of roles) {
      const output = await ask(context, {
        model: workerModel,
        maxTokens: opts.maxTokens,
        thinkingLevel: opts.thinkingLevel,
        system: EXECUTE_SYSTEM(role),
      })
      results.push({ role: role.name, output })
      context = `Previous output from ${role.name}:\n${output}\n\nContinue with: ${task}`
    }
  } else {
    // parallel or mixed: run all in parallel (v1 simplification)
    const parallelResults = await Promise.allSettled(
      roles.map((role) =>
        ask(task, {
          model: workerModel,
          maxTokens: opts.maxTokens,
          thinkingLevel: opts.thinkingLevel,
          system: EXECUTE_SYSTEM(role),
        })
          .then((text) => ({ role: role.name, output: text }))
          .catch((err) => ({ role: role.name, output: `(failed: ${String(err)})` }))
      )
    )
    for (const r of parallelResults) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
  }

  return results
}

// ── Phase 4: Synthesize ─────────────────────────────────────────────────────

async function synthesize(
  task: string,
  results: { role: string; output: string }[],
  opts: NuOptions
): Promise<string> {
  const resultsText = results.map((r) => `--- ${r.role} ---\n${r.output}`).join('\n\n')

  return ask(
    `Original task:\n${task}\n\nTeam member outputs:\n${resultsText}\n\nSynthesize a comprehensive final answer.`,
    {
      model: opts.plannerModel ?? opts.model,
      maxTokens: opts.maxTokens,
      thinkingLevel: 'high' as ThinkingLevel,
      system: SYNTHESIS_SYSTEM,
    }
  )
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: NuOptions
): Promise<NuOutput> {
  const task = build(pieces, args)
  const t0 = Date.now()

  const plannerModel = opts.plannerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(
      `Ν: Self-Organizing Teams — "${task.slice(0, 80)}${task.length > 80 ? '...' : ''}"\n`
    )
  }

  // Phase 1: Negotiate roles
  if (!opts.quiet) process.stderr.write('  → Negotiating roles...\n')
  const roles = await negotiateRoles(task, { ...opts, plannerModel })

  if (!opts.quiet) {
    process.stderr.write(`  → ${roles.length} role(s) proposed:\n`)
    roles.forEach((r) =>
      process.stderr.write(
        `      ${r.name}: ${r.goal.slice(0, 60)}${r.goal.length > 60 ? '...' : ''}\n`
      )
    )
  }

  // Phase 2: Decide workflow
  if (!opts.quiet) process.stderr.write('  → Deciding workflow...\n')
  const { workflow, reasoning } = await decideWorkflow(roles, task, { ...opts, plannerModel })

  if (!opts.quiet) {
    process.stderr.write(`  → Workflow: ${workflow}\n`)
    process.stderr.write(
      `  → Reasoning: ${reasoning.slice(0, 80)}${reasoning.length > 80 ? '...' : ''}\n`
    )
  }

  // Phase 3: Execute
  if (!opts.quiet) process.stderr.write(`  → Executing (${workflow})...\n`)
  const roleResults = await executeRoles(roles, task, workflow, opts)

  // Phase 4: Synthesize
  if (!opts.quiet) process.stderr.write('  → Synthesizing...\n')
  const synthesis = await synthesize(task, roleResults, { ...opts, plannerModel })

  const t1 = Date.now()

  const summary = [
    `Roles: ${roles.map((r) => r.name).join(', ')}`,
    `Workflow: ${workflow} (${reasoning})`,
    `Results: ${roleResults.length}/${roles.length} succeeded`,
    `Synthesis: ${synthesis}`,
  ].join('\n\n')

  return new NuOutput(summary, roles, workflow, reasoning, roleResults, synthesis, t0, t1)
}

// ── Tag factory ─────────────────────────────────────────────────────────────

interface NuFn {
  (pieces: TemplateStringsArray, ...args: unknown[]): PatternPromise<NuOutput>
  (opts: Partial<NuOptions>): NuFn
  quiet: NuFn
}

function makeNu(opts: Partial<NuOptions> = {}): NuFn {
  const merged = { ...defaults, ...opts }

  const fn = ((
    pieces: TemplateStringsArray | Partial<NuOptions>,
    ...args: unknown[]
  ): PatternPromise<NuOutput> | NuFn => {
    if (!Array.isArray(pieces)) {
      return makeNu({ ...merged, ...(pieces as Partial<NuOptions>) })
    }
    return new PatternPromise((resolve, reject) => {
      execute(pieces as TemplateStringsArray, args, merged).then(resolve, reject)
    })
  }) as unknown as NuFn

  let _quiet: NuFn | undefined
  Object.defineProperty(fn, 'quiet', {
    get(): NuFn {
      if (!_quiet) _quiet = makeNu({ ...merged, quiet: true })
      return _quiet
    },
    enumerable: true,
    configurable: true,
  })

  return fn
}

/** Ν tag — Self-Organizing Teams: auto-negotiate roles and workflow */
export const Ν: NuFn = makeNu()
