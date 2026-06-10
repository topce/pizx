#!/usr/bin/env pizx
/**
 * ─── new-features.mjs — All New pizx Features in One Example ──────────────
 *
 * Demonstrates the five major improvements added to pizx:
 *
 *   1. qualityCheck    — LLM-based quality scoring on pattern output
 *   2. system          — user-provided system prompt merged with pattern defaults
 *   3. phaseLog        — structured audit trail of execution phases
 *   4. confirm         — human-in-the-loop approval before execution
 *   5. TaskDescriptor  — composing patterns as sub-tasks in Fleet and Pipeline
 *
 * Run:
 *   pizx examples/new-features.mjs
 *
 * Note: set `confirm: true` to pause and review before execution.
 *       When qualityCheck is enabled, output includes a quality score.
 */

import { chalk } from 'zx'

// ── Config ──────────────────────────────────────────────────────────────────
const PLANNER = 'deepseek/deepseek-v4-pro'
const WORKER   = 'deepseek/deepseek-v4-flash'

// ── 1. SYSTEM PROMPT + QUALITY CHECK + PHASE LOG ────────────────────────────
//    The `system` option augments whatever system prompt the pattern
//    normally uses. `qualityCheck` adds a post-execution quality review.
//    `phaseLog` is always available on the result — no opt-in needed.

console.log(chalk.bold.cyan('\n═══ 1. system + qualityCheck + phaseLog ═══\n'))

const result1 = await Ω({
  plannerModel: PLANNER,
  workerModel: WORKER,
  workers: 2,
  system: 'You are an expert software architect with 20 years of experience.',
  qualityCheck: true,          // ← new: scores the output 0.0–1.0
})`
Outline a 3-tier architecture for a real-time collaboration app.
Keep it concise — 3 paragraphs max.
`

console.log(chalk.green(`✓ Result: ${result1.synthesis.slice(0, 100)}...\n`))

// qualityCheck result
if (result1.qualityReview) {
  const { score, assessment, recommendation } = result1.qualityReview
  console.log(chalk.bold.yellow('Quality Review:'))
  console.log(`  Score:        ${'★'.repeat(Math.round(score * 5))}${'☆'.repeat(5 - Math.round(score * 5))} ${(score * 100).toFixed(0)}%`)
  console.log(`  Assessment:   ${assessment}`)
  console.log(`  Recommendation: ${recommendation}`)
  console.log()
}

// phaseLog — structured execution phases
console.log(chalk.bold.magenta('Phase Log (structured audit trail):'))
for (const phase of result1.phaseLog) {
  const icon = phase.phase === 'plan'       ? '📋'
             : phase.phase === 'dispatch'   ? '🚀'
             : phase.phase === 'synthesize' ? '🧩'
             : phase.phase === 'quality-review' ? '⭐'
             : '·'
  console.log(`  ${icon} ${chalk.bold(phase.phase.padEnd(14))} ${phase.durationMs.toString().padStart(5)}ms  ${phase.description.slice(0, 60)}`)
}
console.log(chalk.dim(`  ── Total: ${result1.phaseLog.reduce((s, p) => s + p.durationMs, 0)}ms across ${result1.phaseLog.length} phases\n`))

// Access phaseLog programmatically
console.log(chalk.bold('Programmatic phaseLog usage:'))
console.log(`  Plan phase duration:     ${result1.phaseLog.find(p => p.phase === 'plan')?.durationMs ?? 'N/A'}ms`)
console.log(`  Synthesize model used:   ${result1.phaseLog.find(p => p.phase === 'synthesize')?.modelUsed ?? 'N/A'}`)
console.log(`  Quality score:           ${result1.qualityReview?.score.toFixed(2) ?? 'N/A'}`)
console.log()


// ── 2. CONFIRM GATE ─────────────────────────────────────────────────────────
//    Set confirm: true to pause before execution and review the plan.

console.log(chalk.bold.cyan('\n═══ 2. confirm — Human-in-the-loop ═══\n'))
console.log(chalk.dim('  Set confirm: true to see a prompt like this before execution:'))
console.log(chalk.dim(''))
console.log(chalk.dim('    ── Confirm ──'))
console.log(chalk.dim('    Execute 2 sub-task(s) as planned?'))
console.log(chalk.dim('      1. Analyze authentication requirements'))
console.log(chalk.dim('      2. Design the auth flow diagram'))
console.log(chalk.dim('    Proceed? [Y/n]'))
console.log(chalk.dim(''))
console.log(chalk.dim('  (Skipping actual execution — set confirm: true to try it)'))
console.log()


// ── 3. PATTERN COMPOSITION — Fleet with TaskDescriptor ────────────────────
//    Fleet tasks can now be either plain strings (LLM calls) or functions
//    that invoke other patterns. The function receives the previous stage
//    output for Pipeline, or empty string for Fleet.

console.log(chalk.bold.cyan('\n═══ 3. TaskDescriptor — Pattern Composition ═══\n'))
console.log(chalk.dim('  Compose patterns as sub-tasks inside Fleet and Pipeline.\n'))

// Fleet with mixed tasks: strings + pattern calls
const result3 = await Φ({
  plannerModel: PLANNER,
  workerModel: WORKER,
  tasks: [
    'List 3 key performance metrics for a web app',   // plain string → LLM call
    () => Σ({ quiet: true })`                           // Subagents pattern as a task
      Propose 3 caching strategies for Node.js APIs.
      Cover: Redis, CDN, in-memory. Keep each under 50 words.
    `,
    () => Ψ({ quiet: true })`                           // Critique pattern as a task
      Review this statement: "Microservices are always better than monoliths."
      Provide a balanced analysis.
    `,
  ],
  quiet: true,   // suppress individual task output — we handle display
})`gather expert opinions`

console.log(chalk.green(`✓ Fleet completed ${result3.members.length} tasks (${result3.successCount} succeeded)\n`))

for (const member of result3.members) {
  const icon = member.success ? '✓' : '✗'
  if (member.success) {
    const firstLine = member.text.split('\n')[0]
    console.log(`  ${icon} ${firstLine.slice(0, 100)}`)
  }
}
console.log()


// ── 4. PIPELINE WITH TASK DESCRIPTOR ───────────────────────────────────────
//    Pipeline stages can receive the previous stage's output as context.

console.log(chalk.bold.cyan('\n═══ 4. Pipeline with composed stages ═══\n'))

const result4 = await Λ({
  plannerModel: PLANNER,
  workerModel: WORKER,
  quiet: true,
  stages: [
    // Stage 1: plain LLM call — generate raw content
    'Generate a short product description for a task management app called "PiTask". 2-3 sentences.',

    // Stage 2: pattern call — receive previous stage output and critique it
    (prev) => Ψ({ quiet: true })`
      Critique this product description:
      ---
      ${prev}
      ---
      Suggest 2 specific improvements for clarity and persuasion.
    `,
  ],
})`generate → improve`

console.log(chalk.bold('Stage 1 — Generated Product Description:'))
console.log(chalk.white(`  ${result4.stages[0].output.slice(0, 200)}`))
console.log()
console.log(chalk.bold('Stage 2 — Critique & Improvements:'))
console.log(chalk.white(`  ${result4.stages[1].output.slice(0, 300)}`))
console.log()


// ── 5. ALL FEATURES TOGETHER ────────────────────────────────────────────────
console.log(chalk.bold.cyan('\n═══ 5. All Features Combined ═══\n'))

const combined = await Ω({
  plannerModel: PLANNER,
  workerModel: WORKER,
  workers: 2,
  qualityCheck: true,
  system: 'You are a clear, concise technical writer.',
  quiet: true,
})`
Write a 2-paragraph README summary for an open-source CLI tool
called "pizx" — a zx fork with native agent patterns.
Focus on: what it is, why it's useful, and the 3 most important patterns.
`

console.log(chalk.green('✓ Final output generated with quality review\n'))

// Show all available metadata
console.log(chalk.bold('Available result metadata:'))
console.log(`  .text              ${(combined.text.length + ' chars').padStart(20)}`)
console.log(`  .synthesis         ${(combined.synthesis.length + ' chars').padStart(20)}`)
console.log(`  .totalTokens       ${String(combined.totalTokens).padStart(20)}`)
console.log(`  .totalCost         $${combined.totalCost.toFixed(6).padStart(16)}`)
console.log(`  .callCount         ${String(combined.callCount).padStart(20)}`)
console.log(`  .duration          ${(combined.duration + 'ms').padStart(20)}`)
console.log(`  .trace.length      ${String(combined.trace.length).padStart(20)}`)
console.log(`  .phaseLog.length   ${String(combined.phaseLog.length).padStart(20)}`)
console.log(`  .qualityReview     ${combined.qualityReview ? `score ${combined.qualityReview.score.toFixed(2)}` : 'N/A'.padStart(20)}`)

if (combined.qualityReview) {
  console.log(`  .qualityReview.assessment  ${combined.qualityReview.assessment.slice(0, 80)}`)
}

console.log(chalk.dim('\n─── Done ───\n'))
