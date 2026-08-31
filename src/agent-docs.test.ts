import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Resolve paths relative to the repo root (this file lives in src/).
const root = fileURLToPath(new URL('../', import.meta.url))
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf-8')

describe('agent-facing docs', () => {
  it('ships AGENTS.md and llms.txt at the repo root', () => {
    expect(existsSync(`${root}AGENTS.md`)).toBe(true)
    expect(existsSync(`${root}llms.txt`)).toBe(true)
  })

  it('lists AGENTS.md and llms.txt in package.json "files"', () => {
    const pkg = JSON.parse(read('package.json')) as { files: string[] }
    expect(pkg.files).toContain('AGENTS.md')
    expect(pkg.files).toContain('llms.txt')
  })

  it('llms.txt follows the llmstxt.org shape (H1 + blockquote summary)', () => {
    const llms = read('llms.txt')
    expect(llms).toMatch(/^# pizx/m)
    expect(llms).toMatch(/^> /m)
  })

  it('every relative link in llms.txt resolves to an existing file', () => {
    const llms = read('llms.txt')
    const links = [...llms.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1])
    const relative = links.filter((l) => !/^https?:\/\//.test(l))
    expect(relative.length).toBeGreaterThan(0)
    const missing = relative.filter((l) => !existsSync(`${root}${l}`))
    expect(missing).toEqual([])
  })

  it('every relative doc link in AGENTS.md resolves to an existing file', () => {
    const agents = read('AGENTS.md')
    const links = [...agents.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1])
    // Only check in-repo doc/readme links (skip external URLs and anchors).
    const local = links.filter((l) => /^(README\.md|docs\/)/.test(l))
    expect(local.length).toBeGreaterThan(0)
    const missing = local.filter((l) => !existsSync(`${root}${l}`))
    expect(missing).toEqual([])
  })
})
