/**
 * Erasure-coding configuration constants.
 *
 * Gray Paper citations:
 * - (H.3) Layout in 2-byte little-endian words
 * - (H.4) Blob piece sizing: k=342 words (684 bytes per piece) for Audit DA
 */

/** Size of a word in bytes for JAM data layout (H.3) */
export const WORD_BYTES = 2

/** Number of data words per piece for blob encoding (H.4) */
export const PIECE_WORDS = 342

/** Number of bytes per piece for blob encoding (H.4) */
export const PIECE_BYTES = PIECE_WORDS * WORD_BYTES

/**
 * Validate that a byte length is a multiple of WORD_BYTES (2).
 */
export function assertEvenByteLength(length: number): void {
  if (length % WORD_BYTES !== 0) {
    throw new Error(
      `Input length must be a multiple of ${WORD_BYTES} bytes; got ${length}`,
    )
  }
}
