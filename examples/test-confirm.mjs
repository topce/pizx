#!/usr/bin/env pizx
/**
 * test-confirm.mjs — Human-in-the-loop approval gate
 *
 * When confirm: true is set, the tag pauses before executing
 * and shows a summary of what it's about to do, asking for [Y/n].
 *
 * Run:   npm run test:confirm
 *        pizx examples/test-confirm.mjs
 *
 * Try:   Set confirm: false to skip the prompt.
 */

// ── π (small pi): confirm before text generation ──────────────────────────

console.log('\n=== π: Text generation with confirm gate ===')
const answer = await π({ confirm: true })`What is the capital of France? Reply in one word.`
console.log(`\n✓ π response: ${answer.text.slice(0, 100)}`)

// ── Σ (Subagents): confirm before sub-task execution ───────────────────────

console.log('\n=== Σ: Subagents with confirm gate ===')
const result = await Σ({
  confirm: true,            // ← pause and ask before executing sub-tasks
  subdomains: [
    'List 3 authentication strategies',
    'List 3 database options',
  ],
})`Evaluate tech choices for a new SaaS app`

console.log(`\n✓ Completed ${result.subResults.length} sub-tasks`)
console.log(result.synthesis)
console.log()

// ── Π (capital pi): confirm before agent starts ────────────────────────────
// Uncomment to test (requires file tools access):
// console.log('\n=== Π: Coding agent with confirm gate ===')
// const agentResult = await Π({ confirm: true, maxTurns: 2 })`list the files in src/`
// console.log(`\n✓ Π response: ${agentResult.text.slice(0, 200)}`)

