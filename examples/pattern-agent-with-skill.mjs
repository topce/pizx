#!/usr/bin/env pizx
/**
 * ─── pattern-agent-with-skill.mjs — Agent + Skill Integration ───────────────
 *
 * Demonstrates two ways to use skills with the pizx agent system:
 *
 *   1. Π with `skills` option — The coding agent loads one or more skills
 *      as additional context, guiding its behavior.
 *
 *   2. π + loadSkillContent() — Load a skill manually and pass it as a
 *      system prompt to small-pi for focused text generation.
 *
 * Skills are SKILL.md files stored in standard locations:
 *   - .agents/skills/<name>/SKILL.md    (project scope)
 *   - ~/.claude/skills/<name>/SKILL.md  (user scope)
 *   - ~/.pi/agent/skills/<name>/SKILL.md
 *
 * Run:
 *   pizx examples/pattern-agent-with-skill.mjs
 *
 * Prerequisites:
 *   - A skill installed (e.g. check .agents/skills/ or ~/.claude/skills/)
 *   - API keys in ~/.pi/agent/auth.json
 */

import { chalk } from 'zx'
import { loadSkillContent } from '../src/skill-loader.ts'

const MODEL = 'deepseek/deepseek-v4-flash'
const SKILL_NAME = 'code-simplification'

console.log(chalk.bold.yellow(`\n  Agent + Skill Integration (${MODEL})\n`))
console.log(chalk.dim(`  Skill: ${SKILL_NAME}\n`))

// ────────────────────────────────────────────────────────────────────────────
// 1. List available skills
// ────────────────────────────────────────────────────────────────────────────

console.log(chalk.bold.cyan(' Available Skills:'))
const skillDirs = [
  '.agents/skills',
  '.pi/skills',
  'skills',
]
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

// ────────────────────────────────────────────────────────────────────────────
// 2. Π + `skills` option — the coding agent automatically loads skill context
// ────────────────────────────────────────────────────────────────────────────

console.log(chalk.bold.cyan(' Method 1: Π + skills option\n'))

const agentResult = await Π({
  model: MODEL,
  maxTurns: 6,
  quiet: true,
  skills: [SKILL_NAME],      // <── skill name loaded automatically
})`
I have a function that processes user data. Here is the current code:

\`\`\`javascript
function processData(input) {
  let result = [];
  for (let i = 0; i < input.length; i++) {
    let item = input[i];
    if (item.type === 'user') {
      if (item.age >= 18) {
        if (item.status === 'active') {
          let formatted = {
            fullName: item.firstName + ' ' + item.lastName,
            yearsOld: item.age,
            emailAddress: item.email,
            isAdult: true
          };
          result.push(formatted);
        }
      }
    }
  }
  return result;
}
\`\`\`

Apply the loaded skill to simplify this code while preserving behavior.
Show me the simplified version and explain what changed.
`

console.log(chalk.dim(`  ${agentResult.turnCount} turns · ${agentResult.duration}ms\n`))
console.log(chalk.white(agentResult.text))
console.log()

// ────────────────────────────────────────────────────────────────────────────
// 3. π + loadSkillContent() — manually load a skill as system prompt
// ────────────────────────────────────────────────────────────────────────────

console.log(chalk.bold.cyan(' Method 2: π + loadSkillContent()\n'))

const skillContent = await loadSkillContent(SKILL_NAME)

if (!skillContent) {
  console.log(chalk.red(`  Skill "${SKILL_NAME}" not found. Skipping method 2.`))
} else {
  console.log(chalk.dim(`  Loaded "${SKILL_NAME}" (${skillContent.length} chars)\n`))

  const result = await π.quiet({
    model: MODEL,
    system: skillContent,     // <── skill content as system prompt
    maxTokens: 1024,
  })`
Here is a complex piece of code:

\`\`\`javascript
function calculateTotal(items) {
  let total = 0;
  for (let x = 0; x < items.length; x++) {
    let y = items[x];
    if (y.price != null && y.price != undefined) {
      if (y.quantity != null && y.quantity != undefined) {
        let subtotal = y.price * y.quantity;
        total = total + subtotal;
      }
    }
  }
  return total;
}
\`\`\`

Simplify this code following the skill's principles.
`

  console.log(chalk.green(result))
  console.log(`  ${chalk.dim(`model: ${result.modelUsed} · ${result.duration}ms`)}`)
}

console.log(chalk.dim('\n  (Skills can be combined — pass multiple names: skills: ["code-simplification", "test-driven-development"])\n'))
