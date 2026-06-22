#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-classify-act.mjs — Classify-And-Act ───────────────────
 *
 * Workflow Pattern 1 of 6 (from Claude Code dynamic workflows):
 *
 *   Task → Classifier → Agent A | Agent B | Agent C
 *
 * The classifier inspects the input and routes to the appropriate specialized
 * agent. In pizx, we compose π (text analysis for classification) with
 * Φ (Fleet) to dispatch to the right worker.
 *
 * Run:
 *   pizx examples/pattern-workflow-classify-act.mjs
 *
 * Real-world use: support ticket routing, content moderation, code review triage.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.magenta('\n ⚡ Classify-And-Act Workflow\n'))
console.log(chalk.dim(' Task → π Classifier → Route to Specialized Agent\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

// ── Step 1: Define the task ─────────────────────────────────────────────────
const TASK = `
A user has submitted the following GitHub issue to the pizx project:

"I'm trying to use the Fleet pattern but when I pass more than 10 tasks,
only the first 5 seem to execute. The rest are silently dropped.
Node.js v22, pizx latest."
`

console.log(chalk.cyan('📥 Incoming Task:'))
console.log(chalk.dim(TASK.trim()))
console.log()

// ── Step 2: Classify the task ───────────────────────────────────────────────
console.log(chalk.yellow('🔍 Classifying...\n'))

const classification = await π({
  model: PLANNER_MODEL,
  quiet: true,
})`
Classify this GitHub issue into EXACTLY ONE category. Reply with ONLY the category name.

Categories:
- BUG — a runtime error, incorrect behavior, or broken functionality
- FEATURE_REQUEST — a request for new capability
- QUESTION — a how-to or usage question
- DOCS — documentation gap or improvement
- PERFORMANCE — slowness or resource usage

Issue:
${TASK}

Category:
`

const category = classification.text.trim().toUpperCase()
console.log(chalk.green(`   Classified as: ${chalk.bold(category)}\n`))

// ── Step 3: Route to the appropriate specialized agent ─────────────────────
const WORKERS = {
  BUG: {
    role: 'Bug Triage Agent',
    prompt: `You are a senior bug triage engineer. For this bug report, provide:
1. Severity assessment (critical/high/medium/low)
2. Likely root cause area (specific module or file)
3. Recommended first step for the developer who picks this up
Be concise and actionable.

Bug report:
${TASK}`,
  },
  FEATURE_REQUEST: {
    role: 'Product Manager Agent',
    prompt: `You are a product manager. For this feature request, provide:
1. User value assessment
2. Implementation complexity estimate (simple/medium/complex)
3. Whether it aligns with pizx's roadmap of multi-agent orchestration
Be concise.

Feature request:
${TASK}`,
  },
  QUESTION: {
    role: 'Developer Advocate Agent',
    prompt: `You are a developer advocate. For this usage question, provide:
1. A clear, direct answer
2. A code snippet if applicable
3. A pointer to the relevant docs file in the pizx project
Be helpful and concise.

Question:
${TASK}`,
  },
  DOCS: {
    role: 'Technical Writer Agent',
    prompt: `You are a technical writer. For this documentation gap, provide:
1. What specific docs file needs updating
2. A draft of the new section (2-3 paragraphs)
3. Any cross-references to other docs

Docs issue:
${TASK}`,
  },
  PERFORMANCE: {
    role: 'Performance Engineer Agent',
    prompt: `You are a performance engineer. For this performance issue, provide:
1. Profiling approach recommendation
2. Likely bottleneck
3. Optimization suggestion with expected impact

Performance issue:
${TASK}`,
  },
}

const agent = WORKERS[category] ?? WORKERS.QUESTION
console.log(chalk.cyan(`🎯 Routing to: ${chalk.bold(agent.role)}\n`))

const result = await π({
  model: WORKER_MODEL,
})`${agent.prompt}`

console.log(chalk.bold.green('\n═══ Agent Response ═══'))
console.log(chalk.white(result.text))
console.log()

console.log(chalk.dim(`✓ Classify-And-Act complete — ${category} → ${agent.role}\n`))
