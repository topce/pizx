#!/usr/bin/env pizx
/**
 * ─── pattern-workflow-loop-until-done.mjs — Loop Until Done ─────────────────
 *
 * Workflow Pattern 6 of 6 (from Claude Code dynamic workflows):
 *
 *   Agent → "New findings?" → Yes (loop back) | No → Done ✓
 *
 * Iteratively work on a task, checking after each pass whether more work
 * is needed. Stops when the agent determines nothing more can be improved.
 *
 * pizx has TWO native patterns for this:
 *   Ρ (Ralph Loop) — analyze → plan → execute → review → repeat
 *   Α (Adaptive)   — plan → execute → evaluate → adapt → repeat
 *
 * This example demonstrates both and helps you choose between them.
 *
 * Run:
 *   pizx examples/pattern-workflow-loop-until-done.mjs
 *
 * Real-world use: refactoring, bug fixing, optimization, research synthesis.
 */

import { chalk } from 'zx'

const PLANNER_MODEL = 'deepseek/deepseek-v4-pro'
const WORKER_MODEL = 'deepseek/deepseek-v4-flash'

console.log(chalk.bold.magenta('\n ⚡ Loop Until Done Workflow\n'))
console.log(chalk.dim(' Agent → New findings? → Yes (loop) | No → Done\n'))

// ── Approach 1: Ρ Ralph Loop — for code improvement ──────────────────────
console.log(chalk.bold.yellow('─── Approach 1: Ρ Ralph Loop (code-focused) ───\n'))
console.log(chalk.dim(' Read → Analyze → Plan → Execute → Review → (repeat until quality met)\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const ralphResult = await Ρ({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxIterations: 4,
  quiet: false,
})`
Review the pizx examples/ directory and identify improvements:
1. Check if any example files are missing proper error handling
2. Look for inconsistent code patterns across examples
3. Suggest at least one concrete improvement
4. Implement the simplest improvement (add a comment, fix a typo, etc.)
`

console.log(chalk.green(`\n✓ Ralph Loop: ${ralphResult.iterationCount} iteration(s)`))
console.log(chalk.dim(`  Completed: ${ralphResult.completed}\n`))

for (const iter of ralphResult.iterations) {
  console.log(chalk.yellow(`  Iteration ${iter.iteration}:`))
  console.log(chalk.dim(`    Plan: ${iter.plan.slice(0, 120)}...`))
  console.log(chalk.dim(`    Result: ${iter.result.slice(0, 120)}...`))
  console.log(chalk.dim(`    Should continue: ${iter.shouldContinue}`))
  console.log()
}

// ── Approach 2: Α Adaptive — for open-ended problems ─────────────────────
console.log(chalk.bold.yellow('─── Approach 2: Α Adaptive (quality-driven) ───\n'))
console.log(chalk.dim(' Plan → Execute → Score Quality → Adapt → (repeat until threshold)\n'))
console.log(chalk.dim(' Adaptation commands: CONTINUE | REFINE | SKIP_NEXT | ADD <step>\n'))
console.log(chalk.dim(` Planner: ${PLANNER_MODEL}  |  Worker: ${WORKER_MODEL}\n`))

const adaptiveResult = await Α({
  plannerModel: PLANNER_MODEL,
  workerModel: WORKER_MODEL,
  maxSteps: 5,
  qualityThreshold: 0.8,
})`
Analyze the pizx project structure and propose a plan to improve the onboarding
experience for new users. Consider:
- The examples/ directory
- The docs/ directory (especially onboarding.md)
- The README.md quick start section
`

console.log(chalk.green(`\n✓ Adaptive: ${adaptiveResult.totalSteps} step(s)\n`))

for (const step of adaptiveResult.steps) {
  const pct = Math.round(step.quality * 100)
  const color = step.quality >= 0.8 ? chalk.green : chalk.yellow
  console.log(chalk.yellow(`  Step ${step.step}: ${step.action.slice(0, 70)}...`))
  console.log(`    Quality: ${color(`${pct}%`)}  Adaptation: ${chalk.cyan(step.adaptation)}`)
}
console.log()

// ── Choosing between Ralph and Adaptive ───────────────────────────────────
console.log(chalk.bold.cyan('─── Ralph Loop vs Adaptive — When to use which ───'))
console.log(chalk.white(`
  Ρ Ralph Loop:
  - Code improvements, refactoring, bug fixing
  - Uses coding agent (Π) with file tools
  - "Find the problem and fix it" mindset
  - Simpler mental model: just keep going until it's good

  Α Adaptive:
  - Open-ended research, analysis, strategy
  - Self-adjusts the plan based on intermediate results
  - Can add, skip, or refine steps dynamically
  - "I'm not sure how many steps this will take" scenarios

  Both stop automatically when the quality bar is met!
`))

// ── Bonus: Simple manual loop ─────────────────────────────────────────────
console.log(chalk.bold.yellow('─── Bonus: Manual Loop with π ───\n'))
console.log(chalk.dim(' For ultimate control, write your own loop:\n'))
console.log(chalk.dim(`
  let done = false
  let context = ''
  while (!done) {
    const result = await π\`analyze this: ...\${context}\`
    context += '\\n' + result.text
    done = result.text.includes('NO_MORE_FINDINGS')
  }
`))

console.log(chalk.dim('\n✓ Loop Until Done — 2 native patterns + manual approach\n'))
