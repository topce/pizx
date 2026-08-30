import { describe, expect, it } from 'vitest'
import { type ConfirmGate, confirmGateSchema, resolveMode } from './utils.ts'

describe('resolveMode', () => {
  it('maps booleans: true → semi, false/undefined → auto', () => {
    expect(resolveMode(true)).toBe('semi')
    expect(resolveMode(false)).toBe('auto')
    expect(resolveMode(undefined)).toBe('auto')
  })

  it('maps gate objects by their true key', () => {
    expect(resolveMode({ hitl: true })).toBe('hitl')
    expect(resolveMode({ semi: true })).toBe('semi')
    expect(resolveMode({ auto: true })).toBe('auto')
  })

  it('treats a false key as absent (M1 regression)', () => {
    // These values cannot be expressed by ConfirmGate's type, but defensive
    // callers may still pass them at runtime; resolveMode must not misread them.
    expect(resolveMode({ hitl: false } as unknown as ConfirmGate)).toBe('auto')
    expect(resolveMode({ semi: false } as unknown as ConfirmGate)).toBe('auto')
  })
})

describe('confirmGateSchema', () => {
  it('accepts booleans and one-key-true gates', () => {
    expect(confirmGateSchema(true)).toBe(true)
    expect(confirmGateSchema(false)).toBe(false)
    expect(confirmGateSchema({ hitl: true })).toEqual({ hitl: true })
    expect(confirmGateSchema({ semi: true })).toEqual({ semi: true })
    expect(confirmGateSchema({ auto: true })).toEqual({ auto: true })
  })

  it('rejects false keys, extra keys, multiple keys, and garbage', () => {
    expect(() => confirmGateSchema({ hitl: false })).toThrow()
    expect(() => confirmGateSchema({ hit: true })).toThrow()
    expect(() => confirmGateSchema({ hitl: true, semi: true })).toThrow()
    expect(() => confirmGateSchema({})).toThrow()
    expect(() => confirmGateSchema('x')).toThrow()
  })
})
