import type { FieldElement } from '@pbnj/types'

import { PIECE_BYTES, PIECE_WORDS, WORD_BYTES } from './config'
import { joinWordsLE, splitWordsLE, transposeWords } from './layout'
import {
  encodePieceReference,
  type IndexedWord,
  recoverPieceReference,
} from './rs-reference'

export interface EncodedBlob {
  chunks: Uint8Array[]
  kPieces: number
  originalLength: number
}

export interface ChunkWithIndex {
  index: number
  chunk: Uint8Array
}

/**
 * Encode an arbitrary-sized blob into 1023 chunks using piecewise RS(1023,342) and transpose.
 * - Input is padded with zeros to a multiple of 684 bytes (H.4).
 * - Splits into kPieces pieces of 342 words (2-byte LE), encodes each piece to 1023 words,
 *   transposes into 1023 chunks of 2*kPieces bytes (H.3/H.5).
 */
export function encodeBlobReference(data: Uint8Array): EncodedBlob {
  const originalLength = data.length
  // Zero-pad to multiple of piece size
  const remainder = originalLength % PIECE_BYTES
  const paddingBytes = remainder === 0 ? 0 : PIECE_BYTES - remainder
  const padded = new Uint8Array(originalLength + paddingBytes)
  padded.set(data, 0)

  const kPieces = padded.length === 0 ? 0 : padded.length / PIECE_BYTES
  if (kPieces === 0) {
    return {
      chunks: Array.from({ length: 1023 }, () => new Uint8Array(0)),
      kPieces: 0,
      originalLength,
    }
  }

  // Split into pieces (bytes), convert each to 342 words
  const piecesWords: FieldElement[][] = new Array(kPieces)
  for (let p = 0; p < kPieces; p++) {
    const start = p * PIECE_BYTES
    const end = start + PIECE_BYTES
    const pieceBytes = padded.subarray(start, end)
    const words = splitWordsLE(pieceBytes)
    if (words.length !== PIECE_WORDS)
      throw new Error('internal: piece words length mismatch')
    piecesWords[p] = words
  }

  // Encode each piece to 1023 words
  const encodedPieces: FieldElement[][] = piecesWords.map((words) =>
    encodePieceReference(words, PIECE_WORDS, 1023),
  )

  // Transpose to 1023 chunks, each of kPieces words
  const chunksWords: FieldElement[][] = transposeWords(encodedPieces)

  // Serialize each chunk to bytes (2 * kPieces)
  const chunks: Uint8Array[] = chunksWords.map((col) => joinWordsLE(col))

  return { chunks, kPieces, originalLength }
}

/**
 * Recover a blob from any 342-of-1023 chunks with indices.
 * - Validates uniform chunk sizes and even lengths (2-byte words).
 * - For each piece row, recovers 342 message words using RS from the provided columns.
 * - Returns the original data truncated to originalLength.
 */
export function recoverBlobReference(
  chunksWithIndices: ChunkWithIndex[],
  kPieces: number,
  originalLength: number,
): Uint8Array {
  if (!Array.isArray(chunksWithIndices))
    throw new Error('chunksWithIndices must be an array')
  if (!Number.isInteger(kPieces) || kPieces < 0)
    throw new Error(`invalid kPieces: ${kPieces}`)
  if (!Number.isInteger(originalLength) || originalLength < 0)
    throw new Error(`invalid originalLength: ${originalLength}`)

  if (kPieces === 0) return new Uint8Array(0)

  // Validate and normalize inputs; enforce unique indices
  const indexToChunk = new Map<number, Uint8Array>()
  let expectedChunkLength = -1
  for (const { index, chunk } of chunksWithIndices) {
    if (!Number.isInteger(index) || index < 0 || index > 1022) {
      throw new Error(`index out of range: ${index}`)
    }
    if (chunk.length % WORD_BYTES !== 0)
      throw new Error('chunk length must be even (2-byte words)')
    if (expectedChunkLength === -1) expectedChunkLength = chunk.length
    if (chunk.length !== expectedChunkLength)
      throw new Error('all chunks must be the same length')
    if (!indexToChunk.has(index)) indexToChunk.set(index, chunk)
  }

  if (indexToChunk.size < PIECE_WORDS) {
    throw new Error(
      `insufficient unique indices: have ${indexToChunk.size}, need ${PIECE_WORDS}`,
    )
  }

  const wordsPerChunk = expectedChunkLength / WORD_BYTES
  if (wordsPerChunk !== kPieces) {
    throw new Error(
      `kPieces mismatch: chunkWords=${wordsPerChunk}, kPieces=${kPieces}`,
    )
  }

  // Build per-piece received sets
  const pieceRecoveredWords: FieldElement[][] = new Array(kPieces)
  for (let p = 0; p < kPieces; p++) {
    const received: IndexedWord[] = []
    for (const [idx, bytes] of indexToChunk.entries()) {
      const words = splitWordsLE(bytes)
      const value = words[p]
      received.push({ index: idx, value })
    }
    const recovered = recoverPieceReference(received, PIECE_WORDS)
    pieceRecoveredWords[p] = recovered
  }

  // Now pieceRecoveredWords is kPieces x 342; serialize per piece then concatenate
  const outBytes = new Uint8Array(kPieces * PIECE_BYTES)
  let offset = 0
  for (let p = 0; p < kPieces; p++) {
    const pieceBytes = joinWordsLE(pieceRecoveredWords[p])
    outBytes.set(pieceBytes, offset)
    offset += pieceBytes.length
  }

  return outBytes.subarray(0, originalLength)
}
