/**
 * Γ (Gamma) — Graph: DAG-based task execution
 *
 * Executes tasks defined as a directed acyclic graph. Each node is a task,
 * edges define dependencies. Tasks with all dependencies met run in parallel.
 * The final output is the result of the graph's sink node.
 *
 * Usage:
 *   await Γ`market-research → competitor-analysis → strategy-doc`
 *   await Γ({ graph: { nodes: [...], edges: [...] } })`execute this workflow`
 *   await Γ.quiet`research & analyze & document`
 *
 * Orchestration pattern: DAG-Based workflow
 * Topology: Directed Acyclic Graph
 */

import type { ThinkingLevel } from '@earendil-works/pi-ai'
import {
  build,
  createPatternTag,
  executeTask,
  mergeSystem,
  type PatternOptions,
  PatternOutput,
  type QualityReviewResult,
  runQualityReview,
} from './types.ts'

// ── Options ─────────────────────────────────────────────────────────────────

/** A node in the DAG — represents a single task */
export interface GraphNode {
  /** Unique node id */
  id: string
  /** Task description */
  task: string
}

/** A directed edge in the DAG */
export interface GraphEdge {
  /** Source node id (dependency) */
  from: string
  /** Target node id (depends on source) */
  to: string
}

export interface GraphOptions extends PatternOptions {
  /** Explicit graph definition. When provided, template is ignored. */
  graph?: { nodes: GraphNode[]; edges: GraphEdge[] }
  /** Separator for parsing graph from template. Default: "→" */
  separator?: string
  /** Run a quality review on the final graph output. Default: false */
  qualityCheck?: boolean
}

const defaults: GraphOptions = {
  maxTokens: 4096,
  thinkingLevel: 'medium' as ThinkingLevel,
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export class GraphNodeResult {
  constructor(
    public readonly nodeId: string,
    public readonly task: string,
    public readonly output: string,
    public readonly success: boolean
  ) {}
}

export class GraphOutput extends PatternOutput {
  constructor(
    text: string,
    public readonly finalOutput: string,
    public readonly nodeResults: GraphNodeResult[],
    startTime: number,
    endTime: number,
    /** Quality review, if qualityCheck was enabled */
    public readonly qualityReview?: QualityReviewResult
  ) {
    super(text, startTime, endTime)
  }
}

// ── Graph parsing ───────────────────────────────────────────────────────────

function parseGraph(
  template: string,
  separator?: string
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const sep = separator ?? '→'
  const parts = template
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length <= 1) {
    // Single task — one node
    return {
      nodes: [{ id: 'root', task: template.trim() }],
      edges: [],
    }
  }

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (let i = 0; i < parts.length; i++) {
    const id = `step_${i + 1}`
    nodes.push({ id, task: parts[i] })
    if (i > 0) {
      edges.push({ from: nodes[i - 1].id, to: id })
    }
  }

  return { nodes, edges }
}

// ── Execute ─────────────────────────────────────────────────────────────────

const NODE_SYSTEM = `You are a task specialist. Execute the assigned task and output your result. Be thorough but concise. Output only the result — no meta-commentary.`

/** Topological sort with parallel-ready batches. Returns batches of node ids. */
export function topoBatches(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
    adj.get(edge.from)?.push(edge.to)
  }

  const batches: string[][] = []
  const ready: string[] = []

  for (const [id, deg] of inDegree) {
    if (deg === 0) ready.push(id)
  }

  while (ready.length > 0) {
    batches.push([...ready])
    const nextBatch: string[] = []

    for (const node of ready) {
      for (const neighbor of adj.get(node) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) nextBatch.push(neighbor)
      }
    }

    ready.length = 0
    ready.push(...nextBatch)
  }

  return batches
}

async function execute(
  pieces: TemplateStringsArray,
  args: unknown[],
  opts: GraphOptions
): Promise<GraphOutput> {
  const template = build(pieces, args)
  const t0 = Date.now()

  const { nodes, edges } = opts.graph ?? parseGraph(template, opts.separator)

  const workerModel = opts.workerModel ?? opts.model

  if (!opts.quiet) {
    process.stderr.write(`Γ: DAG Graph — ${nodes.length} node(s), ${edges.length} edge(s)\n`)
    for (const n of nodes) {
      process.stderr.write(`  [${n.id}] ${n.task.slice(0, 60)}${n.task.length > 60 ? '...' : ''}\n`)
    }
  }

  const batches = topoBatches(nodes, edges)
  const results = new Map<string, string>()
  const nodeResults: GraphNodeResult[] = []

  // Execute batch by batch
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]
    if (!opts.quiet)
      process.stderr.write(`  → Batch ${bi + 1}/${batches.length}: ${batch.join(', ')}\n`)

    // Run all nodes in this batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async (nodeId) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (!node) return { nodeId, task: '', text: '', success: false }

        // Build context from dependencies' results
        const deps = edges.filter((e) => e.to === nodeId)
        let context = node.task
        if (deps.length > 0) {
          const depResults = deps
            .map((d) => {
              const depResult = results.get(d.from)
              return depResult ? `[${d.from} output]: ${depResult}` : ''
            })
            .filter(Boolean)
            .join('\n\n')
          if (depResults) {
            context = `Previous results:\n${depResults}\n\nYour task: ${node.task}`
          }
        }

        const text = await executeTask(context, {
          ...opts,
          model: workerModel,
          system: mergeSystem(opts.system, NODE_SYSTEM),
        })

        return { nodeId, task: node.task, text, success: true }
      })
    )

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.set(r.value.nodeId, r.value.text)
        nodeResults.push(
          new GraphNodeResult(r.value.nodeId, r.value.task, r.value.text, r.value.success)
        )
      }
    }
  }

  const t1 = Date.now()

  // Final output is the result of the last node(s) in the final batch
  const lastBatch = batches[batches.length - 1] ?? []
  const finalNodeResults = lastBatch.map((id) => results.get(id)).filter(Boolean)
  const finalOutput = finalNodeResults.length > 0 ? finalNodeResults.join('\n\n') : ''

  // Quality review (optional)
  if (!opts.quiet && opts.qualityCheck) process.stderr.write('  → Quality review...\n')
  const qualityReview = await runQualityReview(template, finalOutput, opts)

  const summary = nodeResults
    .map(
      (nr) =>
        `[${nr.nodeId}] ${nr.task.slice(0, 80)}...\n  ${nr.output.slice(0, 200)}${nr.output.length > 200 ? '...' : ''}`
    )
    .join('\n\n')

  return new GraphOutput(summary, finalOutput, nodeResults, t0, t1, qualityReview)
}

/** Γ tag — Graph: DAG-based task execution */
export const Γ = createPatternTag(defaults, execute)
