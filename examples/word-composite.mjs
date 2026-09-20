#!/usr/bin/env pizx
/// <reference types="@topce/pizx/globals" />

// ── composite — TypeSafe Composite Scoring ──────────────────────────────────
// Break a complex judgment into independent dimensions, score each with its own
// Score question, then combine them with weights you control in code. Changing
// the weights re-ranks candidates without touching a prompt.
//
// Run:  TYPESAFE_API_KEY=… pizx examples/word-composite.mjs

const resume = `Alex Morgan — 8 years backend engineering.
- Primary language: Python (built two payment platforms, mentored 4 engineers).
- Designed the event-driven settlement system handling 50k tps.
- Also shipped Go and TypeScript services; picked up Rust for a side project.`

const out = await composite({
  dimensions: {
    python_depth: {
      instructions: 'How much depth of Python experience is shown?',
      criteria: ['None', 'Some', 'Primary language', 'Deep expertise'],
      weight: 0.4,
    },
    system_design: {
      instructions: 'How much large-scale system design experience?',
      criteria: ['None', 'Contributor', 'Owned a system', 'Designed at scale'],
      weight: 0.4,
    },
    leadership: {
      instructions: 'How much team leadership experience?',
      criteria: ['None', 'Mentorship', 'Led a small team', 'Managed managers'],
      weight: 0.2,
    },
  },
})`${resume}`

echo('composite score:', out.answer.score.toFixed(3))
for (const [name, p] of Object.entries(out.answer.parts)) {
  echo(`  ${name.padEnd(15)} raw=${p.score} norm=${p.normalized.toFixed(2)} w=${p.weight}`)
}

// Re-rank without re-asking: swap in a manager profile's weights.
const managerWeights = { python_depth: 0.15, system_design: 0.2, leadership: 0.65 }
let total = 0
for (const [name, p] of Object.entries(out.answer.parts)) total += p.normalized * managerWeights[name]
echo('as engineering manager:', total.toFixed(3))
