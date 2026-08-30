import { describe, expect, it } from 'vitest'
import { isPizxError, PizxError } from './errors.ts'

describe('PizxError', () => {
  it('carries a stable code and name', () => {
    const err = new PizxError('AGENT', 'agent failed', { letter: 'Π', cause: new Error('x') })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('PizxError')
    expect(err.code).toBe('AGENT')
    expect(err.message).toBe('agent failed')
    expect(err.cause).toBeInstanceOf(Error)
  })

  it('isPizxError distinguishes pizx errors from foreign ones', () => {
    expect(isPizxError(new PizxError('INTERNAL', 'x'))).toBe(true)
    expect(isPizxError(new Error('x'))).toBe(false)
    expect(isPizxError('x')).toBe(false)
  })
})
