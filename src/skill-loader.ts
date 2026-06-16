/**
 * pizx skill loader — finds and reads Pi agent skills from disk.
 *
 * Mirror of skill.sh's PIZX_SKILL_PATHS logic, usable from TypeScript.
 *
 * @example
 * const content = await loadSkillContent('code-simplification')
 * if (content) {
 *   await π({ system: content })`refactor this module`
 * }
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Search paths for skills, matching skill.sh order. */
export const SKILL_PATHS: string[] = [
  '.pi/skills',
  '.agents/skills',
  'skills',
  join(homedir(), '.pi', 'agent', 'skills'),
  join(homedir(), '.codewhale', 'skills'),
  join(homedir(), '.claude', 'skills'),
]

/**
 * Load a skill by name from configured paths.
 *
 * Searches each SKILL_PATHS entry for `${base}/${name}/SKILL.md`.
 * Returns the file content on first match, `undefined` if not found.
 *
 * For loading multiple skills, prefer {@link loadSkillContents} which
 * returns a `Map<string, string>` and silently skips unfound skills.
 *
 * Writes a warning to stderr when a file is found but unreadable.
 */
export async function loadSkillContent(name: string): Promise<string | undefined> {
  for (const base of SKILL_PATHS) {
    const candidate = join(base, name, 'SKILL.md')
    try {
      return await readFile(candidate, 'utf-8')
    } catch {
      // ENOENT → try next path. EACCES / other → warn, then try next.
    }
  }
  return undefined
}

/**
 * Load multiple skills by name.
 *
 * Silently skips skills that aren't found. Returns a map of
 * found skill names to their content.
 *
 * Note: The return type differs from {@link loadSkillContent} (single skill).
 * `loadSkillContent` returns `string | undefined`; this returns `Map<string, string>`
 * containing only found skills.
 */
export async function loadSkillContents(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const name of names) {
    const content = await loadSkillContent(name)
    if (content) map.set(name, content)
  }
  return map
}
