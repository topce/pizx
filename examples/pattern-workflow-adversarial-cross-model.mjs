#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-adversarial-cross-model.mjs — Adversarial Cross-Model
 *
 * Inspired by "WTF Is a Loop?" Part 2 loop #14 — Lukas Kucinski's Clodex loop.
 *
 * The problem: a single model's blind spots affect BOTH the builder and the
 * reviewer if they share the same model. Claude misses what Claude always
 * misses. DeepSeek misses what DeepSeek always misses.
 *
 * The solution: two DIFFERENT model families review each other. The Worker
 * produces output with one model family. The Adversary reviews it with a
 * DIFFERENT model family. Work only passes when both agree.
 *
 * As the article put it: "two different model families have to agree before
 * code lands." --max-iter 5 and --threshold medium are the whole point.
 * It argues with itself up to 5 times and only passes work that clears the bar.
 *
 * Flow per round:
 *   Π (Claude family) produces ──→ Π (DeepSeek family) reviews ──→ Agree? → Done
 *       ↑                                                            │
 *       └──── fix addressing adversary's findings ────────────────────┘
 *
 * Run:
 *   pizx examples/pattern-workflow-adversarial-cross-model.mjs
 *
 * Real-world use: security audits, architecture decisions, code review for
 * high-risk changes (auth, crypto, billing), spec validation.
 */

import { chalk } from 'zx'

// ── Two different model families ──────────────────────────────────────────
// The entire point: DIFFERENT models catch DIFFERENT blind spots.
const CLAUDE_MODEL = 'anthropic/claude-sonnet-4-5'     // or claude-opus-4-5
const DEEPSEEK_MODEL = 'deepseek/deepseek-v4-pro'       // different family

console.log(chalk.bold.magenta('\n ⚡ Adversarial Cross-Model Verification\n'))
console.log(chalk.dim(' Two DIFFERENT model families must agree before work passes.\n'))
console.log(chalk.dim(`  Worker:    ${CLAUDE_MODEL}`))
console.log(chalk.dim(`  Adversary: ${DEEPSEEK_MODEL}\n`))

// ── The task (something subtle enough that models might disagree) ─────────
const TASK = `
Review this error handling pattern for the pizx Fleet orchestrator:

async function executeFleet(workers, { retries = 2, concurrency = 5 }) {
  const results = []
  const queue = [...workers]

  async function runWorker(worker) {
    try {
      const result = await worker()
      return { success: true, result }
    } catch (err) {
      if (retries > 0) {
        return runWorker(worker)  // recursive retry
      }
      return { success: false, error: err.message }
    }
  }

  const batches = []
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency)
    const batchResults = await Promise.all(batch.map(runWorker))
    batches.push(...batchResults)
  }

  return batches
}

Evaluate this pattern for correctness, safety, and edge cases.
Identify ALL bugs and potential issues.
`

console.log(chalk.cyan('📥 Task:'))
console.log(chalk.dim(TASK.trim()))
console.log()

// ══════════════════════════════════════════════════════════════════════════
// THE ADVERSARIAL CROSS-MODEL LOOP
// ══════════════════════════════════════════════════════════════════════════
const MAX_ROUNDS = 3
let round = 0
let agreed = false
let workerFindings = ''
let adversaryResponse = ''

while (!agreed && round < MAX_ROUNDS) {
  round++
  console.log(chalk.bold.yellow(`\n─── Round ${round}/${MAX_ROUNDS} ───\n`))

  // ── Phase 1: Worker (Claude family) produces analysis ────────────────
  const context = round === 1
    ? 'This is the first analysis.'
    : `Previous adversary response (which you should address):\n${adversaryResponse}`

  console.log(chalk.cyan(`  Phase 1: Worker (${CLAUDE_MODEL}) produces analysis...\n`))

  const workerResult = await π({
    model: CLAUDE_MODEL,
    quiet: true,
    timeoutMs: 60000,
  })`
    ${TASK}

    ${context}

    Focus on correctness and practical edge cases. What would actually break
    in production? Be specific about line numbers and scenarios.

    Format your response as:
    FINDINGS:
    - [list each issue with severity: HIGH/MEDIUM/LOW]
    
    CONFIDENCE: [estimate how confident you are, 1-10]
  `

  workerFindings = workerResult.text.trim()
  console.log(chalk.green('  ✓ Worker analysis complete\n'))
  console.log(chalk.dim(`  ${workerFindings.slice(0, 500)}...`))
  console.log()

  // ── Phase 2: Adversary (DeepSeek family) reviews ─────────────────────
  console.log(chalk.magenta(`  Phase 2: Adversary (${DEEPSEEK_MODEL}) reviews worker's analysis...\n`))

  const adversaryResult = await π({
    model: DEEPSEEK_MODEL,
    quiet: true,
    timeoutMs: 60000,
  })`
    You are the ADVERSARY. Your job is to review the worker's analysis using
    a DIFFERENT model family than the worker used. You catch what they missed.

    Task being analyzed:
    ${TASK}

    Worker's analysis (produced by a Claude-family model):
    ${workerFindings}

    Do THREE things:
    1. **AGREE** — List findings from the worker that you independently confirm.
       These are issues both model families see, making them HIGH confidence.

    2. **EXTEND** — Find issues the worker MISSED. Different model families
       have different blind spots. What did Claude not catch?
       This is the entire point of cross-model verification.

    3. **CHALLENGE** — If you disagree with any finding, say so and explain
       why. What looks like a false positive?

    Then give EXACTLY ONE verdict line:
    VERDICT: AGREE — I independently confirm all findings. No new issues found.
    VERDICT: EXTEND — I found issues the worker missed. List them below.
    VERDICT: DISAGREE — I challenge specific findings. See below.
    VERDICT: EXTEND_AND_DISAGREE — Both new issues and challenges.
  `

  adversaryResponse = adversaryResult.text.trim()
  console.log(chalk.dim(adversaryResponse))
  console.log()

  // ── Check if both model families agree ────────────────────────────────
  if (adversaryResponse.includes('VERDICT: AGREE')) {
    agreed = true
    console.log(chalk.green(`  ✅ Round ${round}: BOTH model families agree — ${CLAUDE_MODEL} and ${DEEPSEEK_MODEL} confirm the same findings.\n`))
  } else if (round < MAX_ROUNDS) {
    console.log(chalk.yellow(`  🔄 Round ${round}: Adversary found gaps — feeding back to worker for another pass.\n`))

    // Show the cross-model gap
    console.log(chalk.cyan('  Cross-model gap (what one caught and the other missed):'))
    if (adversaryResponse.includes('EXTEND')) {
      console.log(chalk.white(`  ${DEEPSEEK_MODEL} found issues ${CLAUDE_MODEL} missed.`))
    }
    if (adversaryResponse.includes('DISAGREE')) {
      console.log(chalk.white(`  ${DEEPSEEK_MODEL} challenged some of ${CLAUDE_MODEL}'s findings.`))
    }
    console.log()
  } else {
    console.log(chalk.red(`  ⛔ Round ${round}: Max rounds reached without full agreement.\n`))
  }
}

// ══════════════════════════════════════════════════════════════════════════
// FINAL REPORT
// ══════════════════════════════════════════════════════════════════════════
console.log(chalk.bold.magenta('\n══════════════════════════════════════════════════'))
console.log(chalk.bold.magenta('═══ Adversarial Cross-Model — Final Report ═══'))
console.log(chalk.bold.magenta('══════════════════════════════════════════════════\n'))

console.log(chalk.cyan('Participating Models:'))
console.log(chalk.white(`  Worker:    ${CLAUDE_MODEL}`))
console.log(chalk.white(`  Adversary: ${DEEPSEEK_MODEL}`))
console.log()

console.log(chalk.cyan('Outcome:'))
if (agreed) {
  console.log(chalk.green(`  ✅ Both model families agreed after ${round} round(s)`))
  console.log(chalk.white('  The findings have cross-model validation — higher confidence than'))
  console.log(chalk.white('  either model alone would provide.'))
} else {
  console.log(chalk.yellow(`  ⚠️  No full agreement after ${MAX_ROUNDS} rounds`))
  console.log(chalk.white('  Some findings have cross-model support; others remain contested.'))
  console.log(chalk.white('  In production, contested findings need human review.'))
}
console.log()

// ── Confidence framework ──────────────────────────────────────────────────
console.log(chalk.cyan('Cross-Validation Confidence Guide:'))
console.log(chalk.white(`
  🟢 HIGH confidence — BOTH models agree on a finding.
     Two independent model families confirmed it. Treat as reliable.

  🟡 MEDIUM confidence — One model found it, the other extended it.
     The second model didn't disagree but found additional related issues.

  🔴 LOW confidence — Only one model found it.
     This is a possible blind spot of the other model. Worth human review.

  ⚪ CONTESTED — Models disagree.
     Needs a third opinion or human judgement.
`))

console.log(chalk.cyan('Why different model families:'))
console.log(chalk.white(`
  This is Lukas Kucinski's Clodex pattern (article loop #14). The article says:

  "Two different model families have to agree before code lands.
   --max-iter 5 and --threshold medium are the whole point."

  A single model family used for both builder and reviewer shares blind spots.
  Claude misses what Claude always misses. DeepSeek catches different things.

  The first cross-model validation in pizx. Both model families must agree
  before work passes. This is the structural guarantee that makes the
  adversarial pattern trustworthy at scale.
`))

console.log(chalk.dim('✓ Adversarial Cross-Model — composition complete\n'))
