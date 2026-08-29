import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPizx, type Pizx } from './context.ts'

let app: Pizx | undefined
let dir: string

afterEach(async () => {
  await app?.dispose()
  app = undefined
})

describe('createPizx', () => {
  it('boots with the built-in π/Π letters registered (and aliases)', async () => {
    app = await createPizx()
    expect(app.π).toBe(app.ctx.letters.get('π'))
    expect(app.Π).toBe(app.ctx.letters.get('Π'))
    for (const name of ['π', 'pi', 'ai', 'Π', 'Pi', 'piAgent', 'codingAgent']) {
      expect(app.letter(name)).toBeDefined()
    }
    expect(app.ctx.trace.runId).toMatch(/^pizx-/)
    await app.dispose()
    app = undefined
  })

  it('mounts plugins passed via config', async () => {
    app = await createPizx({
      plugins: [
        {
          name: 'custom',
          inject: ['letters'],
          apply(ctx) {
            ctx.letters.define('Σ', { run: (prompt) => `σ:${prompt}` })
          },
        },
      ],
    })
    expect(app.letter('Σ')).toBeDefined()
    const σ = app.letter('Σ')
    if (!σ) throw new Error('Σ not registered')
    const out = await σ`hi`
    expect(out.text).toBe('σ:hi')
  })

  it('loads plugins from a config file', async () => {
    dir = await mkdtemp(join(tmpdir(), 'pizx-cfg-'))
    const { writeFile } = await import('node:fs/promises')
    const file = join(dir, 'pizx.config.mjs')
    await writeFile(
      file,
      `export const plugins = [{
        name: 'from-config',
        inject: ['letters'],
        apply(ctx) {
          ctx.letters.define('Ω', { run: (prompt) => 'cfg:' + prompt })
        },
      }]\n`,
      'utf-8'
    )
    const cwd = process.cwd()
    process.chdir(dir)
    try {
      app = await createPizx()
      expect(app.letter('Ω')).toBeDefined()
      const ω = app.letter('Ω')
      if (!ω) throw new Error('Ω not registered')
      const out = await ω`x`
      expect(out.text).toBe('cfg:x')
    } finally {
      process.chdir(cwd)
    }
  })

  it('supports imperative define() after boot', async () => {
    app = await createPizx()
    app.define('Ψ', { run: (prompt) => prompt.toUpperCase() })
    const ψ = app.letter('Ψ')
    if (!ψ) throw new Error('Ψ not registered')
    const out = await ψ`shout`
    expect(out.text).toBe('SHOUT')
  })

  it('exports an empty run trace as JSONL', async () => {
    app = await createPizx()
    const lines = app
      .exportLog('jsonl')
      .split('\n')
      .map((l) => JSON.parse(l))
    expect(lines[0].kind).toBe('run-start')
    expect(lines[lines.length - 1].kind).toBe('run-end')
    expect(app.traceSummary()).toContain('run ')
  })
})
