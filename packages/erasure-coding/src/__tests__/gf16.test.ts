import { describe, expect, it } from 'vitest'
import {
  gfAdd,
  gfMultiply,
  gfInverse,
  gfDivide,
  gfPow,
  polyToCantor,
  cantorToPoly,
  mapIndexToField,
  isCantorBasisFullRank,
} from '../gf16'

describe('GF(2^16) polynomial basis', () => {
  it('add is XOR and closed', () => {
    expect(gfAdd(0x1234, 0x00ff)).toBe(0x1234 ^ 0x00ff)
  })

  it('multiply basics and identity', () => {
    expect(gfMultiply(0, 0xabcd)).toBe(0)
    expect(gfMultiply(0xabcd, 0)).toBe(0)
    expect(gfMultiply(1, 0x4567)).toBe(0x4567)
    expect(gfMultiply(0x4567, 1)).toBe(0x4567)
  })

  it('inverse and division', () => {
    const a = 0x00f1
    const inv = gfInverse(a)
    expect(gfMultiply(a, inv)).toBe(1)
    expect(gfDivide(a, a)).toBe(1)
  })

  it('power properties', () => {
    const a = 0xdead & 0xffff
    expect(gfPow(a, 0)).toBe(1)
    expect(gfPow(a, 1)).toBe(a)
  })
})

describe('Cantor basis conversions', () => {
  it('round-trip cantor <-> poly', () => {
    expect(isCantorBasisFullRank()).toBe(true)
    const values = [0x0000, 0x0001, 0x00ff, 0x1234, 0xabcd, 0xffff]
    for (const v of values) {
      const mask = polyToCantor(v)
      const back = cantorToPoly(mask)
      expect(back).toBe(v & 0xffff)
    }
  })
})

describe('Index mapping', () => {
  it('maps indices to field elements deterministically', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 16; i++) {
      const x = mapIndexToField(i)
      expect(x >>> 16).toBe(0)
      seen.add(x)
    }
    expect(seen.size).toBeGreaterThan(1)
  })
})


