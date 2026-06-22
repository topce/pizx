#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-generate-filter.mjs — Generate-And-Filter ─────────────
 *
 * Workflow Pattern 4 of 6 (from Claude Code dynamic workflows):
 *
 *   Generators → [idea 1, idea 2, ... idea N] → Filter (rubric + dedupe)
 *                                               → Best | Discarded
 *
 * Multiple generators produce candidates in parallel, then a filter step
 * evaluates each against a rubric, deduplicates, and selects the best.
 *
 * In pizx, this is composed: Φ (Fleet) generates candidates in parallel,
 * then π scores/deduplicates them. This is a two-phase composition.
 *
 * Run:
 *   pizx examples/pattern-workflow-generate-filter.mjs
 *
 * Real-world use: naming things, brainstorming features, generating test cases.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.green('\n ⚡ Generate-And-Filter Workflow\n'))
console.log(chalk.dim(' Phase 1: Φ Fleet generates candidates in parallel\n'))
console.log(chalk.dim(' Phase 2: π scores + deduplicates + selects best\n'))

// ── Phase 1: Generate candidates in parallel ──────────────────────────────
console.log(chalk.bold.yellow('─── Phase 1: Φ Fleet — Generate Candidates ───\n'))

const CANDIDATE_COUNT = 5

// Each generator gets a slightly different angle
const candidates = await Φ({
  workerModel: WORKER_MODEL,
  concurrency: 5,
  tasks: [
    'Generate a product tagline for pizx focused on POWER (AI-powered shell scripting)',
    'Generate a product tagline for pizx focused on SIMPLICITY (easy to use, natural feel)',
    'Generate a product tagline for pizx focused on SPEED (fast iteration, parallel execution)',
    'Generate a product tagline for pizx focused on CREATIVITY (unlock new workflows)',
    'Generate a product tagline for pizx focused on RELIABILITY (production-grade patterns)',
  ],
})`generate taglines`

console.log(chalk.green(`✓ Generated ${candidates.successCount} candidates\n`))

const generated = candidates.members
  .filter((m) => m.success)
  .map((m) => m.text.trim())

for (let i = 0; i < generated.length; i++) {
  console.log(chalk.dim(`  [${i + 1}] ${generated[i].slice(0, 120)}`))
}
console.log()

// ── Phase 2: Filter — score against rubric + deduplicate + pick best ─────
console.log(chalk.bold.yellow('─── Phase 2: π — Score, Deduplicate, Select ───\n'))

const candidatesList = generated
  .map((g, i) => `[Candidate ${i + 1}]: ${g}`)
  .join('\n\n')

const filterResult = await π({
  model: PLANNER_MODEL,
})`
You are evaluating product taglines for "pizx" — an AI-powered shell scripting
tool that extends zx with multi-agent orchestration patterns.

RUBRIC (score each 1-10 on):
- Clarity: Is it immediately clear what pizx does?
- Memorability: Does it stick in your head?
- Differentiation: Does it stand out from other AI/CLI tools?
- Tone: Professional but welcoming, not hype-y

Candidates:
${candidatesList}

Your task:
1. Score each candidate on all 4 dimensions
2. Identify and flag near-duplicates
3. Select the TOP candidate with justification
4. List discarded candidates with reasons

Format your response as:
SCORES:
[table or list of scores per candidate]

DUPLICATES:
[none, or which candidates are too similar]

🏆 WINNER: [Candidate N]
Justification: [why this one wins]

🗑️ DISCARDED:
- [Candidate X]: [reason]
`

console.log(chalk.bold.green('\n═══ Filter Results ═══'))
console.log(chalk.white(filterResult.text))
console.log()

// ── Bonus: Simpler approach with just Ψ Critique ─────────────────────────
console.log(chalk.bold.yellow('─── Bonus: Simpler approach with Ψ Critique ───\n'))
console.log(chalk.dim(' If you only need one candidate refined: generate → critique → improve\n'))

console.log(chalk.dim('  await Ψ`generate a compelling tagline for pizx`\n'))
console.log(chalk.dim('  (See examples/pattern-critique.mjs for full demo)\n'))

console.log(chalk.dim('✓ Generate-And-Filter — composition demonstrated\n'))
