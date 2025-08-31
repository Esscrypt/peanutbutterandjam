import { describe, expect, it } from 'vitest'

import { encodeBlobReference, recoverBlobReference } from '../blob-reference'

function hex(h: string): Uint8Array {
  const s = h.startsWith('0x') ? h.slice(2) : h
  const out = new Uint8Array(s.length / 2)
  for (let i = 0; i < s.length; i += 2) out[i / 2] = parseInt(s.slice(i, i + 2), 16)
  return out
}

describe('Blob reference', () => {
  it('round-trip empty', () => {
    const enc = encodeBlobReference(new Uint8Array())
    expect(enc.kPieces).toBe(0)
    const dec = recoverBlobReference([], 0, 0)
    expect(dec.length).toBe(0)
  })

  it('round-trip small data with padding (<=684 bytes)', () => {
    const data = hex('0x615d17')
    const enc = encodeBlobReference(data)
    expect(enc.chunks.length).toBe(1023)
    // Use any 342 chunks (here first 342)
    const subset = enc.chunks.slice(0, 342).map((chunk, i) => ({ index: i, chunk }))
    const dec = recoverBlobReference(subset, enc.kPieces, enc.originalLength)
    expect(Array.from(dec)).toEqual(Array.from(data))
  })

  it('throws on insufficient chunks', () => {
    const data = hex('0x1234')
    const enc = encodeBlobReference(data)
    const subset = enc.chunks.slice(0, 341).map((chunk, i) => ({ index: i, chunk }))
    expect(() => recoverBlobReference(subset, enc.kPieces, enc.originalLength)).toThrow()
  })
})


