import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Read the source rather than importing it: importing globals.ts runs a
// top-level `await getDefaultApp()` which boots the whole app. We only need to
// assert the ambient `declare global` block stays intact (a regression guard;
// `npm run typecheck` validates that the declarations actually compile).
const src = readFileSync(fileURLToPath(new URL('./globals.ts', import.meta.url)), 'utf-8')

describe('globals.ts ambient types', () => {
  it('declares a global augmentation block', () => {
    expect(src).toContain('declare global')
  })

  it('types every built-in letter and alias as a LetterFn global', () => {
    const names = [
      'π',
      'pi',
      'ai',
      'Π',
      'Pi',
      'piAgent',
      'codingAgent',
      'α',
      'acp',
      'agent',
      'ε',
      'run',
      'harness',
      'cli',
    ]
    for (const name of names) {
      expect(src).toContain(`const ${name}: LetterFn<`)
    }
  })
})
