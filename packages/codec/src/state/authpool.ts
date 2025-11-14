/**
 * AuthPool Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Chapter 1 - Authorization Pool
 * Formula (C(1)):
 *
 * C(1) ↦ encode{sequence[C_corecount]{sequence[C_authpoolsize]{hash}}}
 *
 * The authorization pool tracks authorization requirements per core.
 * Each core has a sequence of up to C_authpoolsize authorization hashes.
 *
 * Structure per Gray Paper Equation (authorization.tex:18):
 * - authpool ∈ sequence[C_corecount]{sequence[C_authpoolsize]{hash}}
 * - C_corecount = number of cores (from config service)
 * - C_authpoolsize = 8 (fixed length from Gray Paper definitions)
 *
 * Encoding:
 * - Fixed sequence of C_corecount cores
 * - Each core: fixed-length sequence of exactly C_authpoolsize authorization hashes
 * - Each hash: 32-byte authorization identifier
 * - Empty slots filled with zero hash (0x0000...)
 *
 * ✅ CORRECT: Encodes fixed sequence of cores with fixed-length authorization sequences
 * ✅ CORRECT: Uses proper authorization hash data from AuthPool.authorizations
 * ✅ CORRECT: Uses coreCount from config service for proper structure
 */

import { bytesToHex, type Hex, hexToBytes } from '@pbnj/core'
import type {
  AuthPool,
  DecodingResult,
  IConfigService,
  Safe,
} from '@pbnj/types'
import { AUTHORIZATION_CONSTANTS, safeError, safeResult } from '@pbnj/types'
import {
  decodeSequenceGeneric,
  decodeVariableSequence,
  encodeSequenceGeneric,
  encodeVariableSequence,
} from '../core/sequence'

/**
 * Encode authpool according to Gray Paper C(1):
 * sequence[C_corecount]{sequence[C_authpoolsize]{hash}}
 */
export function encodeAuthpool(
  authpool: AuthPool,
  configService: IConfigService,
): Safe<Uint8Array> {
  // Gray Paper: sequence[C_corecount]{sequence[:C_authpoolsize]{hash}}
  const coreCount = configService.numCores

  // Create array for all cores, initialized with exactly C_authpoolsize slots each
  const coreAuthorizations: Hex[][] = []
  const AUTH_POOL_SIZE = AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE

  // Initialize all cores with exactly C_authpoolsize authorization slots
  for (let i = 0; i < coreCount; i++) {
    coreAuthorizations.push(
      new Array(AUTH_POOL_SIZE).fill(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ),
    )
  }

  // Copy authorizations from authpool (2D array structure)
  for (
    let coreIndex = 0;
    coreIndex < Math.min(authpool.length, coreCount);
    coreIndex++
  ) {
    const corePool = authpool[coreIndex] || []
    // Copy up to AUTH_POOL_SIZE authorizations, pad with zeros if needed
    for (let authIndex = 0; authIndex < AUTH_POOL_SIZE; authIndex++) {
      if (authIndex < corePool.length) {
        coreAuthorizations[coreIndex][authIndex] = corePool[authIndex]
      }
      // Else: already initialized with zero hash
    }
  }

  // Encode as fixed-length sequence of cores
  // Gray Paper: C(1) ↦ encode{sq{build{var{x}}{x ∈ authpool}}}
  // This means each authorization hash should be encoded with var{x} (variable-length with length prefix)
  const [error, encodedData] = encodeSequenceGeneric(
    coreAuthorizations,
    (coreAuths) => {
      // Encode each core as a variable-length sequence of authorization hashes
      // Gray Paper: sequence[:C_authpoolsize]{hash} - variable-length sequence with length prefix
      // Filter out zero hashes (empty slots) before encoding
      const nonZeroAuths = coreAuths.filter(
        (auth) =>
          auth !==
          '0x0000000000000000000000000000000000000000000000000000000000000000',
      )
      const [seqError, encodedSeq] = encodeVariableSequence(
        nonZeroAuths,
        (hex) => {
          // Each hash is a fixed 32-byte value (no length prefix per hash)
          const hashBytes = hexToBytes(hex)
          return safeResult(hashBytes)
        },
      )
      if (seqError) return safeError(seqError)
      return safeResult(encodedSeq)
    },
  )
  if (error) return safeError(error)

  return safeResult(encodedData)
}

/**
 * Decode authpool according to Gray Paper C(1):
 * sequence[C_corecount]{sequence[C_authpoolsize]{hash}}
 */
export function decodeAuthpool(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<AuthPool>> {
  try {
    const coreCount = configService.numCores
    const AUTH_POOL_SIZE = AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE

    // Decode as fixed-length sequence of cores
    // Gray Paper: C(1) ↦ encode{sq{build{var{x}}{x ∈ authpool}}}
    // This means each authorization hash is encoded with var{x} (variable-length with length prefix)
    const [error, result] = decodeSequenceGeneric<Hex[]>(
      data,
      (data) => {
        // Decode each core as a variable-length sequence of authorization hashes
        // Gray Paper: sequence[:C_authpoolsize]{hash} - variable-length sequence with length prefix
        // Each hash is a fixed 32-byte value (no length prefix per hash)
        const [seqError, decodedSeq] = decodeVariableSequence<Hex>(
          data,
          (data) => {
            // Each hash is a fixed 32-byte value
            if (data.length < 32) {
              return safeError(
                new Error(
                  `Insufficient data for hash decoding (expected 32 bytes, got ${data.length})`,
                ),
              )
            }
            const hashBytes = data.slice(0, 32)
            const hashHex = bytesToHex(hashBytes)

            return safeResult({
              value: hashHex,
              remaining: data.slice(32),
              consumed: 32,
            })
          },
        )
        if (seqError) return safeError(seqError)

        // Pad with zero hashes to C_authpoolsize
        const coreAuths: Hex[] = [...decodedSeq.value]
        while (coreAuths.length < AUTH_POOL_SIZE) {
          coreAuths.push(
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          )
        }

        return safeResult({
          value: coreAuths,
          remaining: decodedSeq.remaining,
          consumed: decodedSeq.consumed,
        })
      },
      coreCount, // Fixed length: C_corecount
    )

    if (error) return safeError(error)

    // Reconstruct AuthPool from decoded data (2D array structure)
    const ZERO_HASH =
      '0x0000000000000000000000000000000000000000000000000000000000000000'

    const authpool: AuthPool = result.value.map((coreAuths) => {
      // Filter out zero hashes (empty slots) for each core
      return coreAuths.filter((auth) => auth !== ZERO_HASH)
    })

    return safeResult({
      value: authpool,
      remaining: result.remaining,
      consumed: result.consumed,
    })
  } catch (error) {
    return safeError(error as Error)
  }
}
