import { describe, it, expect } from 'vitest'
import { roundHalfUp } from '../src/rounding.js'

describe('roundHalfUp', () => {
  it('rounds 0.005 up to 0.01', () => { expect(roundHalfUp(0.005)).toBe(0.01) })
  it('rounds 0.004 down to 0.00', () => { expect(roundHalfUp(0.004)).toBe(0) })
  it('rounds 1.555 to 1.56', () => { expect(roundHalfUp(1.555)).toBe(1.56) })
  it('handles negative: -0.005 → -0.01', () => { expect(roundHalfUp(-0.005)).toBe(-0.01) })
  it('handles zero', () => { expect(roundHalfUp(0)).toBe(0) })
  it('rounds 33.335 to 33.34', () => { expect(roundHalfUp(33.335)).toBe(33.34) })
  it('rounds 100.005 to 100.01', () => { expect(roundHalfUp(100.005)).toBe(100.01) })
})
