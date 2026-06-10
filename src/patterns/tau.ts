/**
 * Τ (Tau) — Tool-Mediated Orchestration: shared structured key-value store
 *
 * Agents coordinate through a shared structured context (key-value store)
 * with explicit CRUD-like operations. No agent-to-agent messaging — all
 * coordination happens through reads and writes to the shared store.
 *
 * Usage:
 *   await Τ`research the competitive landscape for this product`
 *   await Τ({ agents: 5, rounds: 2 })`audit the codebase for security issues`
 *   await Τ.quiet`gather requirements from multiple stakeholder perspectives`
 *
 * Flow:
 *   1. Planner defines the shared context schema (keys) and agent roles
 *   2. Round 1: agents write initial findings to their assigned keys (parallel)
 *   3. Round 2+: agents read current store and update/refine entries (parallel)
 *   4. Consolidator reads final store state and synthesizes final answer
 *
 * Pattern: Tool-Mediated Orchestration (Pattern #5)
 * Communication: Tool-Mediated (via shared structured context)
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import {
  ask,
  build,
  createPatternTag,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
  type QualityReviewResult,
  runQualityReview,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

export interface TauOptions extends PatternOptions {
  /** Number of worker agents. Default: 3 */
  agents?: number
  /** Number of read/write rounds. Default: 1 */
  rounds?: number
  /** Custom agent roles. Auto-generated if not provided. */
  roles?: string[]
  /** Run a quality review on the final synthesis. Default: false */
  qualityCheck?: boolean
}

const defaults: TauOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
  agents: 3,
  rounds: 1,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class ToolMediatedEntry {
  constructor(
    /** Agent role name */
    public readonly agent: string,
    /** Round number */
    public readonly round: number,
    /** Operation: initial write or refinement update */
    public readonly operation: 'write' | 'update',
    /** Key name in the shared store */
    public readonly key: string,
    /** Content written to the key */
    public readonly content: string
  ) {}
}

export class TauOutput extends PatternOutput {
  constructor(
    text: string,
    /** All read/write operations across all rounds */
    public readonly entries: ToolMediatedEntry[],
    /** Final key-value store state */
    public readonly finalState: Record<string, string>,
    /** Consolidated synthesis */
    public readonly synthesis: string,
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const SCHEMA_SYSTEM = `You are a coordination architect. Given a task, design a shared structured context for agent collaboration.

Output format exactly:
KEYS: key1, key2, key3, key4

AGENT 1:
ROLE: (one-word role name)
ASSIGNED_KEYS: key1, key2

AGENT 2:
ROLE: (one-word role name)
ASSIGNED_KEYS: key3

Define exactly {agentCount} agents with distinct roles. Each agent is assigned 1-2 keys.
Keys should be named categories relevant to the task (e.g., "Market_Size", "Competitors", "Risks").`

const WRITE_SYSTEM = (role: string, keys: string) =>
  `You are a ${role}. Write your initial findings to your assigned keys in the shared context.

SHARED CONTEXT (current state — may be empty):
{store}

Your assigned keys: ${keys}

Write initial, thorough findings to each of your keys. Output ONLY in this format:

KEY: key_name
VALUE: your findings for this key

KEY: key_name
VALUE: your findings for this key`

const UPDATE_SYSTEM = (role: string, keys: string) =>
  `You are a ${role}. Review the current shared context and refine/update your entries.

SHARED CONTEXT (current state from all agents):
{store}

Your assigned keys: ${keys}

Review what other agents wrote. Update your entries to:
- Fill gaps others haven't covered
- Add depth and specific details
- Challenge or validate others' findings where relevant
- Avoid repeating what's already well-covered

Output ONLY in this format:

KEY: key_name
VALUE: your updated findings for this key`

const CONSOLIDATE_SYSTEM = `You are a research director. Consolidate the structured findings from all specialists into a comprehensive, well-organized synthesis. Combine overlapping insights, resolve contradictions, and prioritize the most impactful findings. Structure your output clearly.`

// ── Phase 1: Define schema ──────────────────────────────────────────────────

async function defineSchema(
  task: string,
  opts: TauOptions
): Promise<{ keys: string[]; roles: string[]; assignments: Map<string, string[]> }> {
  const agentCount = opts.agents ?? 3

  const prompt = SCHEMA_SYSTEM.replace('{agentCount}', String(agentCount))

  const response = await ask(`Task: ${task}\n\n${prompt}`, {
    ...opts,
    model: opts.plannerModel ?? opts.model,
    maxTokens: 1024,
    thinkingLevel: 'high' as ThinkingLevel,
  })

  // Parse keys
  const keysMatch = response.match(/KEYS\s*:\s*(.+)/i)
  const keys = keysMatch?.[1]
    ?.split(',')
    .map((k) => k.trim())
    .filter(Boolean) ?? ['Findings', 'Risks', 'Recommendations']

  // Parse agents and their assigned keys
  const agentRegex = /AGENT\s+\d+\s*:\s*\nROLE\s*:\s*(.+?)\nASSIGNED_KEYS\s*:\s*(.+?)(?:\n|$)/gi
  const roles: string[] = []
  const assignments = new Map<string, string[]>()

  let match: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
  while ((match = agentRegex.exec(response)) !== null) {
    const role = match[1].trim()
    const agentKeys = match[2]
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    roles.push(role)
    assignments.set(role, agentKeys.length > 0 ? agentKeys : [keys[0] ?? 'General'])
  }

  // Fallback: if parsing failed, create generic roles
  if (roles.length === 0) {
    for (let i = 0; i < agentCount; i++) {
      const role = `Specialist ${i + 1}`
      roles.push(role)
      const assignedKey = keys[i % keys.length] ?? `Key_${i + 1}`
      assignments.set(role, [assignedKey])
    }
  }

  return { keys, roles: roles.slice(0, agentCount), assignments }
}

// ── Phase 2–3: Agent execution ──────────────────────────────────────────────

function formatStore(store: Record<string, string>): string {
  const entries = Object.entries(store).filter(([, v]) => v)
  if (entries.length === 0) return '(empty — you are the first contributor)'
  return entries.map(([k, v]) => `[${k}]: ${v}`).join('\n\n')
}

function mergeEntry(store: Record<string, string>, key: string, content: string): void {
  if (store[key]) {
    store[key] += `\n\n${content}`
  } else {
    store[key] = content
  }
}

async function executeRound(
  roles: string[],
  assignments: Map<string, string[]>,
  store: Record<string, string>,
  round: number,
  opts: TauOptions
): Promise<{ entries: ToolMediatedEntry[]; store: Record<string, string> }> {
  const workerModel = opts.workerModel ?? opts.model
  const isWrite = round === 1
  const operation: 'write' | 'update' = isWrite ? 'write' : 'update'

  const roundResults = await Promise.allSettled(
    roles.map(async (role) => {
      const assignedKeys = assignments.get(role) ?? ['General']
      const keysStr = assignedKeys.join(', ')
      const storeText = formatStore(store)

      const systemPrompt = isWrite
        ? WRITE_SYSTEM(role, keysStr).replace('{store}', storeText)
        : UPDATE_SYSTEM(role, keysStr).replace('{store}', storeText)

      const task = isWrite
        ? `Write your initial findings to your assigned keys: ${keysStr}`
        : `Review the shared context and update your entries for keys: ${keysStr}`

      const response = await ask(task, {
        ...opts,
        model: workerModel,
        system: mergeSystem(opts.system, systemPrompt),
      })

      return { role, response }
    })
  )

  const entries: ToolMediatedEntry[] = []
  const newStore = { ...store }

  for (const r of roundResults) {
    if (r.status !== 'fulfilled') continue
    const { role, response } = r.value

    // Parse KEY: ... VALUE: ... pairs
    const kvRegex = /KEY\s*:\s*(.+?)\nVALUE\s*:\s*([\s\S]*?)(?=\nKEY\s*:|\n*$)/gi
    let kvMatch: RegExpExecArray | null
    let found = false

    // biome-ignore lint/suspicious/noAssignInExpressions: regex exec pattern
    while ((kvMatch = kvRegex.exec(response)) !== null) {
      const key = kvMatch[1].trim()
      const value = kvMatch[2].trim()
      entries.push(new ToolMediatedEntry(role, round, operation, key, value))
      mergeEntry(newStore, key, value)
      found = true
    }

    // Fallback: if no KEY/VALUE pairs found, write entire response to first assigned key
    if (!found) {
      const fallbackKey = assignments.get(role)?.[0] ?? 'General'
      const content = response.trim()
      entries.push(new ToolMediatedEntry(role, round, operation, fallbackKey, content))
      mergeEntry(newStore, fallbackKey, content)
    }
  }

  return { entries, store: newStore }
}

// ── Phase 4: Consolidate ────────────────────────────────────────────────────

async function consolidateStore(
  task: string,
  store: Record<string, string>,
  opts: TauOptions
): Promise<string> {
  const storeText = formatStore(store)

  return ask(
    `Original task: ${task}\n\nStructured findings from all specialists:\n\n${storeText}\n\nConsolidate into a comprehensive, well-structured synthesis.`,
    {
      ...opts,
      model: opts.plannerModel ?? opts.model,
      thinkingLevel: 'high' as ThinkingLevel,
      system: mergeSystem(opts.system, CONSOLIDATE_SYSTEM),
    }
  )
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: TauOptions
): Promise<TauOutput> {
  const task = build(pieces, args)
  const t0 = Date.now()
  const totalRounds = opts.rounds ?? 1

  const plannerModel = opts.plannerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(
      `Τ: Tool-Mediated Orchestration — "${task.slice(0, 80)}${task.length > 80 ? '...' : ''}"\n`
    )
  }

  // Phase 1: Define schema
  if (!opts.quiet) process.stderr.write('  → Defining shared context schema...\n')
  const { keys, roles, assignments } = await defineSchema(task, { ...opts, plannerModel })

  if (!opts.quiet) {
    process.stderr.write(`  → Schema: ${keys.join(', ')}\n`)
    process.stderr.write(`  → ${roles.length} agent(s): ${roles.join(', ')}\n`)
    for (const [role, assignedKeys] of assignments) {
      process.stderr.write(`      ${role} → ${assignedKeys.join(', ')}\n`)
    }
  }

  // Phases 2–3: Execute rounds
  const allEntries: ToolMediatedEntry[] = []
  let store: Record<string, string> = {}

  for (let round = 1; round <= totalRounds; round++) {
    const label = round === 1 ? 'Writing' : 'Updating'
    if (!opts.quiet) process.stderr.write(`  → Round ${round}/${totalRounds}: ${label}...\n`)

    const { entries, store: updatedStore } = await executeRound(
      roles,
      assignments,
      store,
      round,
      opts
    )
    allEntries.push(...entries)
    store = updatedStore
  }

  // Phase 4: Consolidate
  if (!opts.quiet) process.stderr.write('  → Consolidating store...\n')
  const synthesis = await consolidateStore(task, store, { ...opts, plannerModel })

  // Quality review (optional)
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(task, synthesis, opts)

  const t1 = Date.now()

  const summary = [
    `Schema keys: ${keys.join(', ')}`,
    `Agents: ${roles.join(', ')}`,
    `Rounds: ${totalRounds}`,
    `Entries: ${allEntries.length}`,
    `Synthesis: ${synthesis}`,
  ].join('\n\n')

  return new TauOutput(summary, allEntries, store, synthesis, t0, t1, qualityReview)
}

/** Τ tag — Tool-Mediated Orchestration: shared structured key-value store */
export const Τ = createPatternTag(defaults, execute)
