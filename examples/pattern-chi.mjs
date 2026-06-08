#!/usr/bin/env pizx
/**
 * Χ (Chi) — Cross-Agent Learning example.
 *
 * Demonstrates extracting learnings from a described or actual pattern execution.
 *
 * Usage: pizx examples/pattern-chi.mjs
 */

// Analyze a described execution (no prior run needed)
console.log('=== Learnings from described execution ===')
const learnings = await Χ`
  A 3-agent debate was run on "microservices vs monolith".
  The optimist argued for microservices citing scalability.
  The pessimist highlighted operational complexity and debugging difficulty.
  The pragmatist recommended a modular monolith as a middle ground.
  The synthesis mostly agreed with the pragmatist but didn't address data consistency.
`
console.log(`\nExtracted ${learnings.insights.length} insights:`)
learnings.insights.forEach(i => {
  console.log(`  [${i.category}] ${i.pattern} (confidence: ${i.confidence.toFixed(2)})`)
  console.log(`    → ${i.recommendation}`)
})
console.log(`\nSummary: ${learnings.summary}`)
console.log(`\nSuggested changes: ${learnings.suggestedChanges}`)

// Analyze with a previous pattern output passed as source
console.log('\n=== Learnings from pattern source ===')
// (In practice, you'd pass the result of a preceding pattern call)
const sourceLearning = await Χ({ trace: 'A fleet of 5 agents analyzed code in parallel. 4 succeeded, 1 failed with a timeout. The results had overlapping findings in 3 of 5 cases. No synthesis was performed.' })`extract improvements`
console.log(`\nExtracted ${sourceLearning.insights.length} insights`)
sourceLearning.insights.forEach(i => {
  console.log(`  [${i.category}] ${i.pattern}`)
})
