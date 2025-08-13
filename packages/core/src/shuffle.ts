/**
 * JAM Gray Paper Fisher-Yates Shuffle Implementation
 *
 * Implements the shuffle function as described in Appendix F of the Gray Paper (Eq. 331)
 * Based on the reference implementation in jamtestvectors/shuffle/main.py
 *
 * Reference: graypaper/text/utilities.tex, Equation 329 and 331
 */

import type { HashValue } from '@pbnj/types'
import { hash as blake2b } from '@stablelib/blake2b'
import { logger } from './logger'

/**
 * Convert little-endian byte array to 32-bit unsigned integer
 */
function fromLittleEndianBytes(bytes: Uint8Array): number {
  let result = 0
  for (let i = 0; i < bytes.length; i++) {
    result += bytes[i] * 256 ** i
  }
  return result >>> 0 // Convert to unsigned 32-bit
}

/**
 * Convert 32-bit unsigned integer to little-endian byte array
 */
function toLittleEndianBytes(value: number, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = (value >>> (i * 8)) & 0xff
  }
  return bytes
}

/**
 * Compute the q sequence from hash as per Gray Paper Equation 331
 *
 * This implements the sequence-from-hash function:
 * seqfromhash(l, h) = [decode_4(blake(h || encode_4(floor(i/8)))[4i mod 32:+4]) for i in range(l)]
 */
function computeQSequence(entropy: Uint8Array, length: number): number[] {
  const result: number[] = []

  for (let i = 0; i < length; i++) {
    // Create preimage: h || encode_4(floor(i/8))
    const preimage = new Uint8Array(entropy.length + 4)
    preimage.set(entropy, 0)
    preimage.set(toLittleEndianBytes(Math.floor(i / 8), 4), entropy.length)

    // Hash the preimage
    const hashResult = blake2b(preimage, 32)

    // Extract 4 bytes at offset (4*i mod 32)
    const offset = (4 * i) % 32
    const slice = hashResult.slice(offset, offset + 4)

    // Convert to 32-bit unsigned integer
    const value = fromLittleEndianBytes(slice)
    result.push(value)
  }

  return result
}

/**
 * Fisher-Yates shuffle using random sequence (Equation 329)
 *
 * This is the recursive implementation from the Gray Paper:
 * fyshuffle(s, r) = [s[r[0] mod l]] + fyshuffle(s', r[1:])
 * where s' = s with s'[r[0] mod l] = s[l-1] and s' = s'[:-1]
 */
function fisherYatesShuffle<T>(sequence: T[], randomSequence: number[]): T[] {
  if (sequence.length === 0) {
    return []
  }

  const length = sequence.length
  const index = randomSequence[0] % length
  const head = sequence[index]

  // Create s' where s'[index] = s[length-1] and remove the last element
  const sequencePost = [...sequence]
  sequencePost[index] = sequence[length - 1]
  const truncatedSequence = sequencePost.slice(0, -1)

  // Recursive call with remaining sequence and random values
  const remaining = fisherYatesShuffle(
    truncatedSequence,
    randomSequence.slice(1),
  )

  return [head, ...remaining]
}

/**
 * JAM Gray Paper Fisher-Yates Shuffle (Equation 331)
 *
 * Shuffles an array using the Fisher-Yates algorithm with entropy from a 32-byte hash.
 * This implements the shuffle function exactly as specified in the Gray Paper.
 *
 * @param input - Array to shuffle (will be cloned, original not modified)
 * @param entropy - 32-byte hash as entropy source (HashValue format: '0x...')
 * @returns Shuffled copy of the input array
 */
export function jamShuffle<T>(input: T[], entropy: HashValue): T[] {
  logger.debug('JAM shuffle starting', {
    inputLength: input.length,
    entropy: `${entropy.slice(0, 10)}...`,
  })

  // Handle edge cases
  if (input.length === 0) {
    return []
  }

  if (input.length === 1) {
    return [...input]
  }

  try {
    // Convert entropy from hex string to Uint8Array
    const cleanEntropy = entropy.startsWith('0x') ? entropy.slice(2) : entropy
    if (cleanEntropy.length !== 64) {
      throw new Error(
        `Invalid entropy length: expected 64 hex chars, got ${cleanEntropy.length}`,
      )
    }

    const entropyBytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      entropyBytes[i] = Number.parseInt(
        cleanEntropy.slice(i * 2, i * 2 + 2),
        16,
      )
    }

    // Compute the q sequence (random sequence from hash)
    const randomSequence = computeQSequence(entropyBytes, input.length)

    // Perform Fisher-Yates shuffle
    const result = fisherYatesShuffle([...input], randomSequence)

    logger.debug('JAM shuffle completed', {
      inputLength: input.length,
      outputLength: result.length,
    })

    return result
  } catch (error) {
    logger.error('JAM shuffle failed', { error, inputLength: input.length })
    throw new Error(
      `JAM shuffle failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Shuffle validator indices for epoch rotation
 *
 * Creates a sequence [0, 1, 2, ..., n-1] and shuffles it using JAM shuffle
 * This is commonly used for validator rotation in epoch transitions
 *
 * @param validatorCount - Number of validators
 * @param entropy - 32-byte hash as entropy source
 * @returns Shuffled validator indices
 */
export function shuffleValidatorIndices(
  validatorCount: number,
  entropy: HashValue,
): number[] {
  if (validatorCount < 0) {
    throw new Error(`Invalid validator count: ${validatorCount}`)
  }

  if (validatorCount === 0) {
    return []
  }

  // Create sequence [0, 1, 2, ..., n-1]
  const indices = Array.from({ length: validatorCount }, (_, i) => i)

  return jamShuffle(indices, entropy)
}

/**
 * Rotate an array by n positions
 * Used in conjunction with shuffle for validator rotation as per Gray Paper
 *
 * @param array - Array to rotate
 * @param positions - Number of positions to rotate (positive = right shift)
 * @returns Rotated array
 */
export function rotateArray<T>(array: T[], positions: number): T[] {
  if (array.length === 0) {
    return [...array]
  }

  // Normalize positions to be within array bounds
  const normalizedPositions =
    ((positions % array.length) + array.length) % array.length

  // Rotate: take elements from the end and put them at the beginning
  return [
    ...array.slice(-normalizedPositions),
    ...array.slice(0, -normalizedPositions),
  ]
}

/**
 * Combined shuffle and rotate operation for validator assignment
 * Implements the P(e, t) function from Gray Paper reporting_assurance.tex
 *
 * @param validators - Array of validators to shuffle and rotate
 * @param entropy - 32-byte hash for shuffling
 * @param rotationOffset - Rotation offset based on time
 * @returns Shuffled and rotated validator array
 */
export function shuffleAndRotateValidators<T>(
  validators: T[],
  entropy: HashValue,
  rotationOffset: number,
): T[] {
  // First shuffle using entropy
  const shuffled = jamShuffle(validators, entropy)

  // Then rotate based on offset
  const rotated = rotateArray(shuffled, rotationOffset)

  return rotated
}
