import { describe, expect, it } from 'vitest'

import { encodePieceReference, recoverPieceReference } from '../rs-reference'

import { mapIndexToField } from '../gf16'

function makeMessage(k: number): number[] {
  const arr = new Array(k)
  for (let i = 0; i < k; i++) arr[i] = (0x1234 ^ i) & 0xffff
  return arr
}

describe('RS reference (piece) — encode/decode', () => {
  it('systematic mapping: first k outputs equal inputs', () => {
    const k = 8
    const n = 1023
    const msg = makeMessage(k)
    const code = encodePieceReference(msg, k, n)
    expect(code.length).toBe(n)
    for (let i = 0; i < k; i++) expect(code[i]).toBe(msg[i] & 0xffff)
  })

  it('recover from exactly 0..k-1 indices returns original', () => {
    const k = 8
    const n = 1023
    const msg = makeMessage(k)
    const code = encodePieceReference(msg, k, n)
    const received = [] as { index: number; value: number }[]
    for (let i = 0; i < k; i++) received.push({ index: i, value: code[i] })
    const rec = recoverPieceReference(received, k)
    expect(rec).toEqual(msg.map((x) => x & 0xffff))
  })

  it('recover from k arbitrary indices', () => {
    const k = 8
    const n = 1023
    const msg = makeMessage(k)
    const code = encodePieceReference(msg, k, n)
    const indices = [3, 7, 100, 342, 511, 800, 900, 1022]
    const received = indices.map((idx) => ({ index: idx, value: code[idx] }))
    const rec = recoverPieceReference(received, k)
    expect(rec).toEqual(msg.map((x) => x & 0xffff))
  })

  it('throws on insufficient unique indices', () => {
    const k = 8
    const n = 1023
    const msg = makeMessage(k)
    const code = encodePieceReference(msg, k, n)
    const indices = [0, 1, 2, 3, 4, 5, 6] // only 7
    const received = indices.map((idx) => ({ index: idx, value: code[idx] }))
    expect(() => recoverPieceReference(received, k)).toThrow()
  })

  it('throws on out-of-range indices', () => {
    const k = 8
    const n = 1023
    const msg = makeMessage(k)
    encodePieceReference(msg, k, n)
    expect(() => recoverPieceReference([{ index: -1, value: 0 }], k)).toThrow()
    expect(() => recoverPieceReference([{ index: 1023, value: 0 }], k)).toThrow()
  })
})


