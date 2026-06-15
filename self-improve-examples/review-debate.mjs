#!/usr/bin/env pizx
/**
 * ─── review-debate.mjs — Multi-Perspective Code Review via Debate ────────
 *
 * Runs a 4-perspective AI debate on your staged/unstaged changes, then
 * converges on a synthesis with concrete .patch files for confirmed issues.
 *
 * Perspectives:
 *   🔒 Security — injection risks, exposed secrets, auth bypasses, input validation
 *   ⚡ Performance — N+1 queries, unnecessary allocations, blocking I/O, bundle size
 *   📖 Readability — unclear names, missing comments, deep nesting, inconsistent style
 *   ✅ Correctness — edge cases, null handling, error propagation, contract violations
 *
 * Output: .patch files in self-improve-examples/patches/review-debate/
 * Apply with: git apply patches/review-debate/*.patch
 *
 * Run:
 *   pizx self-improve-examples/review-debate.mjs
 *   TARGET=src/patterns/ pizx self-improve-examples/review-debate.mjs
 */

import { chalk } from 'zx'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const PATCHES_DIR = join(import.meta.dirname, 'patches', 'review-debate')
const TARGET = process.env.TARGET || ''

// ════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.cyan('\n 🔍 Review Debate — Multi-Perspective Code Review\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

await mkdir(PATCHES_DIR, { recursive: true })

// ─── Gather diff ────────────────────────────────────────────────────────

console.log(chalk.yellow(' Gathering changes for review...\n'))

let diffContent = ''
try {
  const targetArg = TARGET ? `-- ${TARGET}` : ''
  diffContent = (await $`git diff HEAD ${targetArg} 2>&1 || echo ""`).stdout.trim()
  if (!diffContent) {
    diffContent = (await $`git diff --cached ${targetArg} 2>&1 || echo ""`).stdout.trim()
  }
} catch {
  diffContent = ''
}

if (!diffContent) {
  console.log(chalk.yellow(' ⚠ No changes detected. Reviewing changed files from last commit instead.\n'))
  try {
    diffContent = (await $`git diff HEAD~1..HEAD ${TARGET} 2>&1 || echo ""`).stdout.trim()
  } catch {
    diffContent = ''
  }
}

if (!diffContent) {
  console.log(chalk.red(' ✗ No diff available. Nothing to review.'))
  process.exit(0)
}

const changedFiles = (await $`git diff --name-only HEAD ${TARGET} 2>&1 || echo ""`).stdout.trim()
console.log(chalk.dim(`   Changed files: ${changedFiles.split('\n').filter(Boolean).length || 'N/A'}\n`))

// ─── Phase 1: Debate ────────────────────────────────────────────────────

console.log(chalk.yellow(' Running 4-perspective debate...\n'))

const debateResult = await debate({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  perspectives: 4,
  rounds: 2,
  mode: 'agent',
  qualityCheck: true,
  roles: [
    'Security Reviewer: find injection risks, exposed secrets, auth bypasses, missing input validation, unsafe dependencies',
    'Performance Reviewer: find N+1 queries, unnecessary allocations, blocking I/O, bundle size regressions, memory leaks',
    'Readability Reviewer: find unclear names, missing JSDoc, deep nesting, inconsistent patterns, magic numbers',
    'Correctness Reviewer: find edge cases, null/undefined risks, error propagation gaps, contract violations, race conditions',
  ],
})`
Review these code changes for a project called pizx (a zx fork with AI agent pattern tags).
Focus ONLY on the changed code, not the whole codebase.

Changes to review (git diff):
${diffContent.slice(0, 12000)}

Changed files:
${changedFiles.slice(0, 2000)}

Debate these changes from your assigned perspective. After 2 rounds, converge on:
1. Which issues are real and confirmed?
2. Which issues are likely false positives?
3. For each confirmed issue, provide a specific code fix

For each confirmed issue, output in this machine-parseable format:

ISSUE:
  file: <path>
  line: <number>
  severity: <HIGH|MEDIUM|LOW>
  confidence: <0.0-1.0>
  risk: <rationale>
  perspectives: <which reviewers flagged this>
  summary: <one-line description>
  review_note: <what to especially check before applying>
FIX:
<exact code fix>

DO NOT wrap in markdown fences. Use the ISSUE:/FIX: format exactly.
`

// ─── Phase 2: Extract issues and generate .patch files ──────────────────

console.log(chalk.yellow(' Generating .patch files from debate synthesis...\n'))

const synthesis = debateResult.synthesis || ''
const issueBlocks = synthesis.split(/^ISSUE:/m).filter(b => b.trim())

let patchCount = 0

for (const block of issueBlocks) {
  const fixMatch = block.match(/^FIX:\n([\s\S]*?)(?=^ISSUE:|$)/m)
  if (!fixMatch) continue

  const fix = fixMatch[1].trim()
  if (!fix) continue

  // Parse metadata
  const fileMatch = block.match(/file:\s*(.+)/)
  const lineMatch = block.match(/line:\s*(\d+)/)
  const severityMatch = block.match(/severity:\s*(.+)/)
  const confidenceMatch = block.match(/confidence:\s*([\d.]+)/)
  const riskMatch = block.match(/risk:\s*(.+)/)
  const summaryMatch = block.match(/summary:\s*(.+)/)
  const reviewMatch = block.match(/review_note:\s*(.+)/)

  const filename = fileMatch ? fileMatch[1].trim() : 'unknown'
  const line = lineMatch ? parseInt(lineMatch[1]) : 0
  const severity = severityMatch ? severityMatch[1].trim() : 'MEDIUM'
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5
  const risk = riskMatch ? riskMatch[1].trim() : 'N/A'
  const summary = summaryMatch ? summaryMatch[1].trim() : 'No summary'
  const reviewNote = reviewMatch ? reviewMatch[1].trim() : 'Review before applying'

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeSummary = summary.slice(0, 60).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  const patchName = `${timestamp}-${safeSummary}.patch`

  // Build .patch file with metadata header
  const patchContent = [
    `# Generated by: review-debate.mjs`,
    `# Date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    `# Summary: ${summary}`,
    `# Severity: ${severity}`,
    `# Confidence: ${confidence.toFixed(2)}`,
    `# Risk: ${risk}`,
    `# Target: ${filename}:${line}`,
    `# Review: ${reviewNote}`,
    `# Perspectives: ${block.match(/perspectives:\s*(.+)/)?.[1]?.trim() || 'unknown'}`,
    ``,
    `# ─── Fix ───`,
    fix,
    ``,
  ].join('\n')

  await writeFile(join(PATCHES_DIR, patchName), patchContent, 'utf-8')
  patchCount++
}

// ─── Report ──────────────────────────────────────────────────────────────

console.log(chalk.bold.green(`\n ✓ Review debate complete\n`))
console.log(chalk.dim(`   Quality score: ${(debateResult.qualityReview?.score ?? 0).toFixed(2)}\n`))

if (patchCount === 0) {
  console.log(chalk.green(' 🎉 No issues found! Your code looks solid.\n'))
} else {
  console.log(chalk.yellow(` 📝 ${patchCount} patch(es) generated in:`))
  console.log(chalk.white(`   ${PATCHES_DIR}/\n`))
  console.log(chalk.dim('   Review each .patch, then apply with:'))
  console.log(chalk.white(`   git apply ${PATCHES_DIR}/*.patch\n`))
}

if (debateResult.qualityReview?.recommendation) {
  console.log(chalk.cyan(' Quality assessment:'))
  console.log(chalk.dim(`   ${debateResult.qualityReview.recommendation}\n`))
}

console.log(chalk.dim(' ─── Review perspectives: security, performance, readability, correctness ───\n'))
