#!/usr/bin/env pizx
/**
 * test-confirm-all.mjs — Comprehensive confirm gate examples
 *
 * Demonstrates human-in-the-loop confirm gates for all supported tags:
 * π, Π, Ω, Σ, Φ, Λ.
 *
 * Run:   npm run test:confirm-all
 *        pizx examples/test-confirm-all.mjs
 *
 * Each section pauses and asks for [Y/n]. Reply 'y' to proceed, 'n' to skip.
 * Set WHICH=π|Π|Ω|Σ|Φ|Λ|all to run specific gates. Default: all
 *
 *   WHICH=π pizx examples/test-confirm-all.mjs      # only π
 *   WHICH=all pizx examples/test-confirm-all.mjs    # all gates
 */

const WHICH = process.env.WHICH || 'all'
const run = (name) => WHICH === name || WHICH === 'all'

// ── π: Confirm before text generation ──────────────────────────────────────

if (run('π')) {
  console.log('\n=== π: Confirm before text generation ===')
  console.log('    (You should see your prompt before any API call)')
  try {
    const answer = await π({ confirm: true })`What is the capital of France? Reply in one word.`
    console.log(`\n  ✓ π response: ${answer.text.slice(0, 100)}`)
  } catch (err) {
    console.log(`  ✗ Cancelled: ${err.message}`)
  }
}

// ── Π: Confirm before coding agent ─────────────────────────────────────────

if (run('Π')) {
  console.log('\n=== Π: Confirm before coding agent starts ===')
  console.log('    (You should see the prompt and available tools)')
  try {
    const result = await Π({ confirm: true, maxTurns: 2 })`list the files in the current directory`
    console.log(`\n  ✓ Π response:\n${result.text.slice(0, 300)}`)
  } catch (err) {
    console.log(`  ✗ Cancelled: ${err.message}`)
  }
}

// ── Σ: Confirm before sub-task execution ───────────────────────────────────

if (run('Σ')) {
  console.log('\n=== Σ (Subagents): Confirm before sub-task execution ===')
  console.log('    (You should see the decomposed sub-tasks)')
  try {
    const result = await Σ({
      confirm: true,
      subdomains: [
        'List 3 authentication strategies',
        'List 3 database options',
      ],
    })`Evaluate tech choices for a new SaaS app`

    console.log(`\n  ✓ Completed ${result.subResults.length} sub-tasks`)
    console.log(`  Synthesis: ${result.synthesis.slice(0, 200)}...`)
  } catch (err) {
    console.log(`  ✗ Cancelled: ${err.message}`)
  }
}

// ── Φ: Confirm before fleet execution ──────────────────────────────────────

if (run('Φ')) {
  console.log('\n=== Φ (Fleet): Confirm before parallel execution ===')
  console.log('    (You should see the task list)')
  try {
    const result = await Φ({
      confirm: true,
      tasks: [
        'Name 3 frontend frameworks',
        'Name 3 backend frameworks',
      ],
    })`Compare web frameworks`

    const succeeded = result.members.filter((m) => m.success).length
    console.log(`\n  ✓ ${succeeded}/${result.members.length} fleet tasks succeeded`)
    console.log(`  Result: ${result.text.slice(0, 200)}...`)
  } catch (err) {
    console.log(`  ✗ Cancelled: ${err.message}`)
  }
}

// ── Ω: Confirm before orchestration ────────────────────────────────────────

if (run('Ω')) {
  console.log('\n=== Ω (Orchestrator): Confirm before dispatch ===')
  console.log('    (You should see the plan and sub-tasks)')
  try {
    const result = await Ω({ confirm: true, workers: 2 })`Compare REST vs GraphQL for a new API`

    const succeeded = result.workerResults.filter((w) => w.success).length
    console.log(`\n  ✓ ${succeeded}/${result.workerResults.length} workers succeeded`)
    console.log(`  Synthesis: ${result.synthesis.slice(0, 200)}...`)
  } catch (err) {
    console.log(`  ✗ Cancelled: ${err.message}`)
  }
}

// ── Λ: Confirm before pipeline stages ──────────────────────────────────────

if (run('Λ')) {
  console.log('\n=== Λ (Pipeline): Confirm before pipeline stages ===')
  console.log('    (You should see the stage list)')
  try {
    const result = await Λ({
      confirm: true,
      stages: ['Write a one-sentence product description for a todo app', 'Improve the description to be more compelling'],
    })`Create a product description`

    console.log(`\n  ✓ Completed ${result.stageResults.length} stages`)
    console.log(`  Final output: ${result.text.slice(0, 200)}...`)
  } catch (err) {
    console.log(`  ✗ Cancelled: ${err.message}`)
  }
}

console.log('\n── All confirm gate examples complete ──\n')
