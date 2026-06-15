#!/usr/bin/env pizx
/**
 * ─── hunt-bugs.mjs — Bug Category Scanner ────────────────────────────────
 *
 * Runs 6 parallel Fleet agents, each hunting a specific bug category
 * across the entire codebase:
 *   1. Null/Undefined risks
 *   2. Race conditions
 *   3. Resource leaks
 *   4. Swallowed errors
 *   5. Type safety violations
 *   6. Error propagation gaps
 *
 * Each agent produces findings with file:line, severity, and suggested fix.
 * Findings are written as .patch files, one per category.
 *
 * Output: .patch files in self-improve-examples/patches/hunt-bugs/
 *
 * Run:
 *   pizx self-improve-examples/hunt-bugs.mjs
 *   TARGET=src/patterns/ pizx self-improve-examples/hunt-bugs.mjs
 */

import { chalk } from 'zx'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'
const PATCHES_DIR = join(import.meta.dirname, 'patches', 'hunt-bugs')
const TARGET = process.env.TARGET || 'src/'

// ════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.red('\n 🐛 Bug Hunt — 6-Category Parallel Scan\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))
console.log(chalk.dim(` Target: ${TARGET}\n`))

await mkdir(PATCHES_DIR, { recursive: true })

// ─── Fleet: 6 parallel bug-hunting agents ────────────────────────────────

console.log(chalk.yellow(' Launching 6 parallel bug-hunting agents...\n'))

const result = await fleet({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  concurrency: 6,
  mode: 'agent',
})`
You are a bug-hunting agent analyzing the ${TARGET} directory of the pizx project. Hunt for bugs in your assigned category. For each finding, output:

ISSUE:
  file: <path>
  line: <number>
  category: <your category name>
  pattern: <what pattern you detected>
  severity: <HIGH|MEDIUM|LOW>
  confidence: <0.0-1.0>
  summary: <one-line description>
FIX:
<exact code fix>

DO NOT wrap in markdown fences. Use the ISSUE:/FIX: format exactly.

---

1. NULL/UNDEFINED RISKS: Scan ${TARGET} for:
- Optional chaining (?.) used inconsistently (some accesses use it, others don't on same object)
- Function returns that are nullable but callers don't check
- Destructuring from possibly-undefined values
- Array access without bounds checking
- Default values that mask real undefined bugs
For each finding: show the file, line, the nullable value, and how to add a guard.

2. RACE CONDITIONS: Scan ${TARGET} for:
- Shared mutable state accessed in async functions without synchronization
- Promise.all where individual promises mutate shared state
- let variables reassigned in async callbacks that could interleave
- Read-modify-write patterns across await boundaries
- Event listeners or timers that could fire during state transitions
For each finding: show the file, line, the race window, and how to fix it.

3. RESOURCE LEAKS: Scan ${TARGET} for:
- File handles or streams opened without close/finally
- setInterval/setTimeout without clearInterval/clearTimeout
- Event listeners added without corresponding removeListener
- Promises that are created but never awaited (floating promises)
- Large data structures held in closures that could be garbage collected
For each finding: show the file, line, the leaked resource, and the cleanup to add.

4. SWALLOWED ERRORS: Scan ${TARGET} for:
- Empty catch blocks: catch {} or catch(e) {}
- .catch(() => {}) with no body
- catch blocks that only console.error without re-throwing when appropriate
- try/finally without catch where errors are silently ignored
- Promise chains without error handling
For each finding: show the file, line, what error is swallowed, and how to handle it properly.

5. TYPE SAFETY VIOLATIONS: Scan ${TARGET} for:
- \\\`as\\\` type assertions at module boundaries (unsafe casts)
- \\\`any\\\` type usage where a specific type would work
- \\\`!\\\` non-null assertions (postfix ! operator)
- \\\`@ts-ignore\\\` or \\\`@ts-expect-error\\\` comments
- Implicit any from untyped function parameters
For each finding: show the file, line, the unsafe construct, and how to make it type-safe.

6. ERROR PROPAGATION GAPS: Scan ${TARGET} for:
- Async functions that can throw but don't have try/catch at call sites
- Functions that return Result-like objects but callers ignore the error case
- throw inside callbacks that won't propagate to the caller
- Error messages that lose context (e.g., "failed" without what failed)
- Nested try/catch where inner errors are masked by outer catch
For each finding: show the file, line, the propagation gap, and how to fix it.
`

// ─── Process results and generate .patch files per category ──────────────

console.log(chalk.yellow(' Processing findings and generating .patch files...\n'))

const categories = [
  'null-undefined',
  'race-conditions',
  'resource-leaks',
  'swallowed-errors',
  'type-safety',
  'error-propagation',
]

let totalPatches = 0
const categoryCounts = {}

for (let i = 0; i < result.members.length; i++) {
  const member = result.members[i]
  const category = categories[i] || `category-${i}`
  categoryCounts[category] = 0

  if (!member.success) {
    console.log(chalk.red(`   ✗ ${category} — ${member.error}`))
    continue
  }

  const blocks = (member.text || '').split(/^ISSUE:/m).filter(b => b.trim())

  for (const block of blocks) {
    const fixMatch = block.match(/^FIX:\n([\s\S]*?)(?=^ISSUE:|$)/m)
    if (!fixMatch) continue

    const fix = fixMatch[1].trim()
    if (!fix) continue

    const fileMatch = block.match(/file:\s*(.+)/)
    const lineMatch = block.match(/line:\s*(\d+)/)
    const severityMatch = block.match(/severity:\s*(.+)/)
    const confidenceMatch = block.match(/confidence:\s*([\d.]+)/)
    const summaryMatch = block.match(/summary:\s*(.+)/)
    const patternMatch = block.match(/pattern:\s*(.+)/)

    const filename = fileMatch ? fileMatch[1].trim() : 'unknown'
    const line = lineMatch ? parseInt(lineMatch[1]) : 0
    const severity = severityMatch ? severityMatch[1].trim() : 'MEDIUM'
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5
    const summary = summaryMatch ? summaryMatch[1].trim() : 'No summary'
    const pattern = patternMatch ? patternMatch[1].trim() : 'N/A'

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const safeSummary = summary.slice(0, 50).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    const patchName = `${timestamp}-${safeSummary}.patch`

    const patchContent = [
      `# Generated by: hunt-bugs.mjs`,
      `# Date: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      `# Category: ${category}`,
      `# Pattern: ${pattern}`,
      `# Summary: ${summary}`,
      `# Severity: ${severity}`,
      `# Confidence: ${confidence.toFixed(2)}`,
      `# Target: ${filename}:${line}`,
      ``,
      `# ─── Fix ───`,
      fix,
      ``,
    ].join('\n')

    await writeFile(join(PATCHES_DIR, patchName), patchContent, 'utf-8')
    categoryCounts[category]++
    totalPatches++
  }
}

// ─── Report ──────────────────────────────────────────────────────────────

console.log(chalk.bold.green(`\n ✓ Bug hunt complete\n`))
console.log(chalk.dim(`   ${result.successCount}/${result.members.length} categories scanned\n`))

if (totalPatches === 0) {
  console.log(chalk.green('\n 🎉 No bugs found across any category! Clean codebase.\n'))
} else {
  console.log(chalk.yellow(`\n 📊 Findings by category:`))
  for (const [cat, count] of Object.entries(categoryCounts)) {
    if (count > 0) {
      const icon = count >= 5 ? chalk.red : count >= 2 ? chalk.yellow : chalk.green
      console.log(`   ${icon(`● ${count}`)} ${chalk.dim(cat)}`)
    }
  }
  console.log(chalk.white(`\n   ${totalPatches} total patch(es) in ${PATCHES_DIR}/`))
  console.log(chalk.dim('   Review and apply with: git apply') + chalk.white(` ${PATCHES_DIR}/*.patch\n`))
}

console.log(chalk.dim(' ─── Bugs are cheapest to fix the moment you find them ───\n'))
