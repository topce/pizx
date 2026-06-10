#!/usr/bin/env pizx
/**
 * test-confirm.mjs — Human-in-the-loop approval gate
 *
 * When confirm: true is set, the pattern pauses before execution
 * and shows a summary of what it's about to do, asking for [Y/n].
 *
 * Run:   npm run test:confirm
 *        pizx examples/test-confirm.mjs
 *
 * Try:   Set confirm: false to skip the prompt.
 */

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
