import { describe, expect, it } from 'vitest'
import {
  splitWordsLE,
  joinWordsLE,
  transposeWords,
  padBlobToPieceMultiple,
  WORD_BYTES,
  PIECE_BYTES,
} from '..'

function hex(h: string): Uint8Array {
  const s = h.startsWith('0x') ? h.slice(2) : h
  const p = s.length % 2 === 0 ? s : `0${s}`
  const out = new Uint8Array(p.length / 2)
  for (let i = 0; i < p.length; i += 2) out[i / 2] = parseInt(p.slice(i, i + 2), 16)
  return out
}

describe('layout utilities (H.3/H.4)', () => {
  it('split/join round-trip for 2-byte words', () => {
    const bytes = hex('0x615d1700') // words: 0x5d61, 0x0017
    const words = splitWordsLE(bytes)
    expect(words).toEqual([0x5d61, 0x0017])
    const joined = joinWordsLE(words)
    expect(joined).toEqual(bytes)
  })

  it('split rejects odd-length inputs', () => {
    const odd = hex('0x01')
    expect(() => splitWordsLE(odd)).toThrow()
  })

  it('join rejects out-of-range words', () => {
    expect(() => joinWordsLE([0, 0x1_0000])).toThrow()
  })

  it('transpose rectangular matrix', () => {
    const m = [
      [1, 2, 3],
      [4, 5, 6],
    ]
    expect(transposeWords(m)).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ])
  })

  it('transpose rejects ragged matrix', () => {
    const ragged = [[1, 2], [3]]
    expect(() => transposeWords(ragged)).toThrow()
  })

  it('padBlobToPieceMultiple respects 684-byte piece size', () => {
    const zero = new Uint8Array(0)
    const p0 = padBlobToPieceMultiple(zero)
    expect(p0.originalLength).toBe(0)
    expect(p0.paddingBytes).toBe(0)
    expect(p0.kPieces).toBe(0)
    expect(p0.padded.length % PIECE_BYTES).toBe(0)

    const one = new Uint8Array(1)
    const p1 = padBlobToPieceMultiple(one)
    expect(p1.originalLength).toBe(1)
    expect(p1.paddingBytes).toBe(PIECE_BYTES - 1)
    expect(p1.kPieces).toBe(1)
    expect(p1.padded.length).toBe(PIECE_BYTES)

    const full = new Uint8Array(PIECE_BYTES)
    const pf = padBlobToPieceMultiple(full)
    expect(pf.originalLength).toBe(PIECE_BYTES)
    expect(pf.paddingBytes).toBe(0)
    expect(pf.kPieces).toBe(1)
    expect(pf.padded.length).toBe(PIECE_BYTES)

    const twoPiecesMinus1 = new Uint8Array(PIECE_BYTES * 2 - 1)
    const p2m1 = padBlobToPieceMultiple(twoPiecesMinus1)
    expect(p2m1.paddingBytes).toBe(1)
    expect(p2m1.kPieces).toBe(2)
    expect(p2m1.padded.length).toBe(PIECE_BYTES * 2)
  })

  it('constants are correct', () => {
    expect(WORD_BYTES).toBe(2)
    expect(PIECE_BYTES).toBe(684)
  })
})


