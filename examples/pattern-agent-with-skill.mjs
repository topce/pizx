#!/usr/bin/env pizx
/**
 * ─── pattern-agent-with-skill.mjs — Agent + Skill Integration ───────────────
 *
 * Demonstrates how to use skills with every level of the pizx system:
 *
 *   π  (small pi)       — text generation
 *   Π  (capital pi)     — coding agent with tools
 *   Ψ  (Critique)       — generate → critique → improve
 *   Φ  (Fleet)          — parallel agents with different perspectives
 *   Ρ  (Ralph)          — iterative improvement loop
 *   Λ  (Pipeline)       — sequential stages
 *
 * The `skills` option is available on ALL pattern tags via PatternOptions.
 * Skills are SKILL.md files stored in standard locations:
 *   - .agents/skills/<name>/SKILL.md    (project scope)
 *   - ~/.claude/skills/<name>/SKILL.md  (user scope)
 *   - ~/.pi/agent/skills/<name>/SKILL.md
 *
 * You can combine multiple skills: skills: ['code-simplification', 'test-driven-development']
 *
 * Run:
 *   pizx examples/pattern-agent-with-skill.mjs
 *
 * Prerequisites:
 *   - Skills installed (check .agents/skills/ or ~/.claude/skills/)
 *   - API keys in ~/.pi/agent/auth.json
 */

import { chalk } from 'zx'
import { loadSkillContent } from '../src/skill-loader.ts'

const MODEL = 'deepseek/deepseek-v4-flash'
const SKILL_NAME = 'code-simplification'

console.log(chalk.bold.yellow('\n  Agent + Skill Integration\n'))
console.log(chalk.dim(`  All examples use skill: "${SKILL_NAME}"\n`))

// ────────────────────────────────────────────────────────────────────────────
// 0. List available skills
// ────────────────────────────────────────────────────────────────────────────

console.log(chalk.bold.cyan(' Available Skills:'))
const skillDirs = ['.agents/skills', '.pi/skills', 'skills']
for (const dir of skillDirs) {
  const dirHandle = await $({ quiet: true })`ls ${dir} 2>/dev/null || true`
  if (dirHandle.stdout.trim()) {
    const names = dirHandle.stdout.trim().split('\n')
    for (const name of names) {
      console.log(`   ${chalk.green('✓')} ${chalk.bold(name)}  →  ${dir}/${name}/SKILL.md`)
    }
  }
}
console.log()

// ════════════════════════════════════════════════════════════════════════════
// 1. π  — small pi with manually loaded skill content
// ════════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.cyan(' 1. π + loadSkillContent() — manual skill injection\n'))

const skillContent = await loadSkillContent(SKILL_NAME)

if (skillContent) {
  console.log(chalk.dim(`  Loaded "${SKILL_NAME}" (${skillContent.length} chars) as system prompt\n`))

  const piResult = await π.quiet({
    model: MODEL,
    system: skillContent,
    maxTokens: 512,
  })`
Simplify this validation logic:

\`\`\`javascript
function validate(user) {
  if (user.name != null && user.name != undefined && user.name !== '') {
    if (user.age != null && user.age != undefined) {
      if (user.age >= 18 && user.age <= 120) {
        return true;
      }
    }
  }
  return false;
}
\`\`\`
`

  console.log(chalk.green(piResult))
  console.log(`  ${chalk.dim(`model: ${piResult.modelUsed} · ${piResult.duration}ms`)}\n`)
} else {
  console.log(chalk.red(`  Skill "${SKILL_NAME}" not found.\n`))
}

// ════════════════════════════════════════════════════════════════════════════
// 2. Π  — coding agent with the `skills` option
// ════════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.cyan(' 2. Π + skills option — coding agent with tools\n'))

const agentResult = await Π({
  model: MODEL,
  maxTurns: 6,
  quiet: true,
  skills: [SKILL_NAME],
})`
Find all .ts files in src/ that contain deeply nested conditionals (3+ levels).
For each file, show me the nesting depth and suggest how the skill would simplify it.
`

console.log(chalk.dim(`  ${agentResult.turnCount} turns · ${agentResult.duration}ms\n`))
console.log(chalk.white(agentResult.text))
console.log()

// ════════════════════════════════════════════════════════════════════════════
// 3. Ψ  — Critique pattern with skill
// ════════════════════════════════════════════════════════════════════════════
// The skill guides BOTH the generation AND critique phases.

console.log(chalk.bold.cyan(' 3. Ψ (Critique) + skills — generate → critique → improve\n'))

const critiqueResult = await Ψ.quiet({
  model: MODEL,
  skills: [SKILL_NAME],       // <── skill guides all phases
  rounds: 1,
})`
Write a clean, well-structured JavaScript function that takes an array of
objects with { id, parentId } and builds a nested tree structure.
Focus on readability and avoiding unnecessary complexity.
`

console.log(chalk.dim(`  ${critiqueResult.callCount} calls · ${critiqueResult.duration}ms\n`))
console.log(chalk.bold('  Final output:'))
console.log(chalk.green(critiqueResult.finalContent.slice(0, 600)))
if (critiqueResult.finalContent.length > 600) console.log(chalk.dim('  ...(truncated)'))
console.log()

// ════════════════════════════════════════════════════════════════════════════
// 4. Φ  — Fleet pattern with multiple skills (parallel analysis)
// ════════════════════════════════════════════════════════════════════════════
// Each fleet member gets the same skills context.

console.log(chalk.bold.cyan(' 4. Φ (Fleet) + skills — parallel analysis\n'))

const fleetResult = await Φ.quiet({
  model: MODEL,
  skills: [SKILL_NAME, 'spec-driven-development'],
  workers: 3,
  workerModel: MODEL,
})`
Review the file src/patterns/types.ts and suggest 3 improvements:
1. What can be simplified
2. What documentation is missing
3. What edge cases aren't handled
`

console.log(chalk.dim(`  ${fleetResult.callCount} calls · ${fleetResult.duration}ms\n`))
for (const member of fleetResult.members) {
  const icon = member.success ? chalk.green('✓') : chalk.red('✗')
  console.log(` ${icon} ${chalk.bold(member.perspective.slice(0, 60))}`)
  console.log(chalk.dim(`    ${member.text.slice(0, 200)}${member.text.length > 200 ? '...' : ''}`))
}
console.log()

// ════════════════════════════════════════════════════════════════════════════
// 5. Λ  — Pipeline pattern with skill (sequential stages)
// ════════════════════════════════════════════════════════════════════════════
// Skill context flows through every pipeline stage.

console.log(chalk.bold.cyan(' 5. Λ (Pipeline) + skills — sequential stages\n'))

const pipelineResult = await Λ.quiet({
  model: MODEL,
  skills: [SKILL_NAME],
  plannerModel: MODEL,
  workerModel: MODEL,
})`
Stage 1: Find a complex function in src/core.test.ts (3+ levels of nesting).
Stage 2: Rewrite it following the simplification principles.
Stage 3: Explain what changed and why it's simpler.
`

console.log(chalk.dim(`  ${pipelineResult.callCount} calls · ${pipelineResult.duration}ms\n`))
for (const stage of pipelineResult.stages) {
  console.log(`  ${chalk.bold(`Stage ${stage.index + 1}:`)} ${stage.text.slice(0, 200)}${stage.text.length > 200 ? '...' : ''}`)
}
console.log()

// ════════════════════════════════════════════════════════════════════════════
// 6. Multiple skills combined
// ════════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.cyan(' 6. Multiple skills — combined context\n'))

console.log(chalk.dim(`  Skills are composable — pass an array of names:\n`))
console.log(chalk.white(`    skills: ['code-simplification', 'test-driven-development', 'documentation']`))
console.log()
console.log(chalk.dim(`  Each skill's SKILL.md is loaded and merged into the system prompt.
  All pattern tags (Π Ψ Φ Λ Ρ Σ Δ Ω Α Γ) support the \`skills\` option.\n`))

// ════════════════════════════════════════════════════════════════════════════
// 7. Quick reference
// ════════════════════════════════════════════════════════════════════════════

console.log(chalk.bold.cyan(' Quick Reference\n'))
console.log(chalk.white(`  ┌─────────────┬──────────────────────────────────────────────┐`))
console.log(chalk.white(`  │ Construction │ Example                                      │`))
console.log(chalk.white(`  ├─────────────┼──────────────────────────────────────────────┤`))
console.log(chalk.white(`  │ π + skill   │ π({ system: await loadSkillContent('x') })\`\` │`))
console.log(chalk.white(`  │ Π + skill   │ Π({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Ψ + skill   │ Ψ({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Φ + skill   │ Φ({ skills: ['x', 'y'] })\`\`               │`))
console.log(chalk.white(`  │ Λ + skill   │ Λ({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Ρ + skill   │ Ρ({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Σ + skill   │ Σ({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Δ + skill   │ Δ({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Ω + skill   │ Ω({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Α + skill   │ Α({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  │ Γ + skill   │ Γ({ skills: ['x'] })\`\`                     │`))
console.log(chalk.white(`  └─────────────┴──────────────────────────────────────────────┘`))
console.log()
