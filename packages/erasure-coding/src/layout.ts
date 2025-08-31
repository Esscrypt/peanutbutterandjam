import { logger } from '@pbnj/core'
import type { BlobPaddingResult, WordLE16 } from '@pbnj/types'
import { assertEvenByteLength, PIECE_BYTES, WORD_BYTES } from './config'

/**
 * Split a byte array into 16-bit little-endian words.
 *
 * Gray Paper (H.3): Data is treated as 2-byte little-endian words.
 *
 * - Validates input length is a multiple of 2; callers may zero-pad beforehand.
 * - Returns an array of numbers in range [0, 65535].
 */
export function splitWordsLE(bytes: Uint8Array): WordLE16[] {
  assertEvenByteLength(bytes.length)
  const words: WordLE16[] = new Array(bytes.length / WORD_BYTES)
  for (let i = 0, w = 0; i < bytes.length; i += 2, w += 1) {
    words[w] = bytes[i] | (bytes[i + 1] << 8)
  }
  return words
}

/**
 * Join 16-bit little-endian words into a byte array.
 *
 * Gray Paper (H.3): Each word is serialized as 2 bytes little-endian.
 * - Validates each word is within 16-bit range.
 */
export function joinWordsLE(words: WordLE16[]): Uint8Array {
  const out = new Uint8Array(words.length * WORD_BYTES)
  for (let w = 0, i = 0; w < words.length; w += 1, i += 2) {
    const value = words[w]
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`Invalid 16-bit word at index ${w}: ${value}`)
    }
    out[i] = value & 0xff
    out[i + 1] = (value >>> 8) & 0xff
  }
  return out
}

/**
 * Transpose a 2D matrix of words.
 *
 * Expects a rectangular matrix (all rows equal length).
 * Used in later milestones for piece↔chunk re-layout (H.3/H.5).
 */
export function transposeWords(matrix: WordLE16[][]): WordLE16[][] {
  if (matrix.length === 0) return []
  const rows = matrix.length
  const cols = matrix[0].length
  for (let r = 1; r < rows; r += 1) {
    if (matrix[r].length !== cols) {
      throw new Error('transposeWords requires a rectangular matrix')
    }
  }
  const out: WordLE16[][] = new Array(cols)
  for (let c = 0; c < cols; c += 1) {
    const col: WordLE16[] = new Array(rows)
    for (let r = 0; r < rows; r += 1) {
      col[r] = matrix[r][c]
    }
    out[c] = col
  }
  return out
}

/**
 * Pad a blob so that its length is a multiple of the JAM piece size (684 bytes).
 *
 * Gray Paper (H.4): The blob is split into pieces of 342 words = 684 bytes.
 * If the blob length is not a multiple of 684, pad with zero bytes.
 */
export function padBlobToPieceMultiple(bytes: Uint8Array): BlobPaddingResult {
  const originalLength = bytes.length
  const remainder = originalLength % PIECE_BYTES
  const paddingBytes = remainder === 0 ? 0 : PIECE_BYTES - remainder
  const padded = new Uint8Array(originalLength + paddingBytes)
  padded.set(bytes, 0)

  const kPieces = padded.length === 0 ? 0 : padded.length / PIECE_BYTES
  logger.debug('padBlobToPieceMultiple', {
    originalLength,
    paddingBytes,
    kPieces,
  })
  return { originalLength, paddingBytes, kPieces, padded }
}
