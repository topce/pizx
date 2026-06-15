#!/usr/bin/env pizx
/**
 * ─── prune-why-is-this-here.mjs — Deletion Candidate Analysis ────────────
 *
 * Instead of suggesting additions, this script hunts for things to REMOVE.
 * It asks "why does this exist?" for every file, export, and dependency,
 * then produces a ranked list of deletion candidates with evidence.
 *
 * Checks (all parallel via Fleet):
 *   1. Zero-import exports — exported but never imported anywhere
 *   2. Dead code paths — functions/conditionals that are unreachable
 *   3. Orphan tests — tests for code that no longer exists
 *   4. Unused dependencies — npm packages that aren't imported
 *   5. Stale config — tsconfig/biome settings that have no effect
 *   6. Redundant abstractions — wrappers that don't add value
 *
 * Output: a confidence-ranked list of "safe to delete" candidates.
 * Nothing is deleted — you review and decide.
 *
 * Run:
 *   pizx self-improve-examples/prune-why-is-this-here.mjs
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.red('\n 🔪 Prune — "Why Is This Here?" Deletion Candidate Analysis\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))
console.log(chalk.dim(' Philosophy: every line of code is a liability until proven otherwise\n'))

// ─── Phase 1: Gather raw data ─────────────────────────────────────────

console.log(chalk.yellow(' Gathering import graphs and dependency data...\n'))

const [exportsList, depTree] = await Promise.allSettled([
  // Find all exports and their usage
  $`cd src/ && for f in $(find . -name '*.ts' -not -name '*.test.ts' -not -name 'globals.ts'); do echo "=== $f ===" && grep -n '^export' "$f" 2>/dev/null || true; done`,
  // Get dependency usage
  $`npx depcheck --json 2>&1 || true`,
])

// ─── Phase 2: Fleet of 6 parallel deletion-hunting agents ─────────────

console.log(chalk.yellow(' Hunting deletion candidates with 6 parallel agents...\n'))

const result = await fleet({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  mode: 'agent',
  concurrency: 6,
})`
1. ZERO-IMPORT EXPORTS: Read every .ts file in src/ (excluding tests and globals.ts). For each export statement, grep the ENTIRE codebase to see if it's imported anywhere. Flag exports with ZERO import matches. For each: show the file, line, export name, and evidence (the grep command you ran and its empty output). List them ranked by file size (bigger files with dead exports = bigger win to delete).
Raw exports list:
${exportsList.status === 'fulfilled' ? exportsList.value.stdout.slice(0, 8000) : 'data not available'}

2. UNREACHABLE CODE PATHS: Scan src/ for pattern files (src/patterns/*.ts). Look for: conditionals that always resolve one way, early returns followed by unreachable code, switch cases that can never be hit, catch blocks that can never fire. For each, show the file, line, and why it's unreachable. Be conservative — only flag cases where you're 90%+ confident.

3. ORPHAN TESTS: Read src/core.test.ts, src/patterns.test.ts, src/pizx.test.ts, src/model-picker.test.ts. For each test (describe/it block), check if the thing being tested still exists in the source. Flag tests that test: deleted functions, renamed exports, deprecated patterns, or things that no longer exist. For each orphan test, show: file, line, test name, and what it's testing that no longer exists.

4. UNUSED DEPENDENCIES: Analyze the depcheck output. List every npm dependency in package.json that has zero imports in src/. For each, show: package name, version, and the depcheck evidence. Also check devDependencies — are there tools we've stopped using but still have installed (e.g., an old linter after switching to biome)?
Raw depcheck:
${depTree.status === 'fulfilled' ? depTree.value.stdout.slice(0, 4000) : 'depcheck not available'}

5. STALE CONFIG: Read tsconfig.json, tsconfig.build.json, biome.json, vitest.config.ts. For each setting, determine if it's: (a) the default value (redundant), (b) overridden elsewhere (dead), or (c) for a feature we no longer use (stale). List: file, setting, why it's stale/redundant, and whether it's safe to remove.

6. REDUNDANT ABSTRACTIONS: Scan src/patterns/index.ts and src/index.ts for re-export chains. Look for: files that only re-export from another file, wrapper functions that just call another function with no added logic, utility modules with only one consumer. For each: show what it does, whether removing it would simplify the import graph, and what the migration path is.
`

// ─── Phase 3: Synthesize confidence-ranked deletion list ──────────────

console.log(chalk.yellow('\n Synthesizing confidence-ranked deletion list...\n'))

const synthesis = await pi({ model: PLANNER_MODEL, maxTokens: 4096 })`
You are a senior engineer reviewing a codebase pruning analysis. Synthesize these 6 parallel deletion-hunting results into a CONFIDENCE-RANKED deletion list.

Format:

## 🔪 Deletion Candidates — Ranked by Confidence

### ✅ HIGH CONFIDENCE (safe to delete now)
[Items where evidence is strong — zero imports, unreachable, confirmed orphan]

### ⚠️ MEDIUM CONFIDENCE (delete after quick verification)
[Items that are likely dead but warrant a manual look first]

### 🔍 LOW CONFIDENCE (investigate, don't delete yet)
[Items where evidence is suggestive but not conclusive]

### 📊 Impact Estimate
- Files that could be deleted: X
- Lines of code that could be removed: ~X
- Dependencies that could be dropped: X
- Total cleanup effort: ~X minutes

### 🎯 Top 3 Quick Wins
[3 items you could delete in under 5 minutes with highest confidence]

Here are the 6 check results:

${result.members.map((m, i) => `\n### Check ${i + 1}\n${m.success ? m.text : `FAILED: ${m.error}`}`).join('\n')}
`

console.log(chalk.bold.green('\n ✓ Prune analysis complete\n'))
console.log(chalk.dim(`   ${result.successCount}/${result.members.length} checks passed\n`))

for (const member of result.members) {
  if (!member.success) {
    console.log(chalk.red(`   ✗ ${member.task?.slice(0, 80)} — ${member.error}`))
  }
}

console.log(synthesis.text)
console.log(chalk.dim('\n ─── Remember: deletion is the best refactor ───\n'))
