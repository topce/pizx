#!/usr/bin/env pizx
/**
 * 5 Whys — Root cause analysis with π (small Pi)
 *
 * The "5 Whys" technique iteratively asks "why" to drill down from
 * a surface-level problem to its root cause. Each round uses π to
 * analyze the previous answer and uncover the next layer.
 *
 * Usage: pizx examples/pattern-five-whys.mjs
 *
 * You can pass a problem via CLI arg or edit the variable below.
 */

const args = process.argv.slice(2).filter(a => !a.endsWith('.mjs') && !a.endsWith('.js'))

// ── Problem to analyze ──────────────────────────────────────────────────────

const problem = args.length > 0
  ? args.join(' ')
  : 'The production deployment failed last night'

console.log(`🎯 5 Whys Root Cause Analysis\n`)
console.log(`Surface problem: "${problem}"\n`)

// ── Step through 5 whys ─────────────────────────────────────────────────────

let currentAnswer = problem

for (let i = 1; i <= 5; i++) {
  console.log(`Why #${i}...`)

  currentAnswer = await π`
    You are performing a "5 Whys" root cause analysis.

    This is iteration ${i} of 5.

    ${i === 1
      ? `Initial problem: "${currentAnswer}"\n\nAsk: Why did this happen? Identify the most likely immediate cause. Be specific and factual — avoid vague answers. Output ONLY the cause, no preamble.`
      : `Previous finding: "${currentAnswer}"\n\nAsk: Why did this happen? Dig deeper — look for systemic, process, or organizational causes, not just technical ones. Output ONLY the next-level cause, no preamble.`
    }
  `

  const indent = '  '.repeat(i)
  console.log(`${indent}→ ${currentAnswer}\n`)
}

// ── Summarize root cause ────────────────────────────────────────────────────

console.log('─'.repeat(60))
console.log('\nSynthesizing root cause and corrective actions...\n')

const summary = await π`
  You conducted a "5 Whys" root cause analysis on this problem:
  "${problem}"

  The chain of causes was:
  ${Array.from({ length: 5 }, (_, i) => `Why ${i + 1}: (see above)`).join('\n')}

  Provide:
  1. ROOT CAUSE: a one-sentence summary of the deepest root cause found
  2. CORRECTIVE ACTION: one specific, actionable fix to prevent recurrence
  3. PREVENTIVE MEASURE: one systemic change to catch this class of problem earlier

  Keep it concise — 3 bullet points.
`

console.log(summary)
