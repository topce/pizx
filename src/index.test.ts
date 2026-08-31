import { describe, expect, it } from 'vitest'
import { Schema } from './index.ts'

describe('package re-exports', () => {
  it('re-exports schemastery as `Schema` for plugin authors', () => {
    // A plugin can `import { Schema } from '@topce/pizx'` instead of depending
    // on `schemastery` directly — one fewer dependency to resolve.
    expect(typeof Schema).toBe('function')
    expect(typeof Schema.object).toBe('function')
  })

  it('the re-exported Schema validates and applies defaults', () => {
    const schema = Schema.object({ maxWords: Schema.natural().default(30) })
    expect(schema({})).toEqual({ maxWords: 30 })
    expect(schema({ maxWords: 5 })).toEqual({ maxWords: 5 })
  })
})
