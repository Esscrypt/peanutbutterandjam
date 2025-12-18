/**
 * AuthQueue serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: authorization.tex (Equation 19)
 * Formula:
 *
 * authqueue ∈ sequence[C_corecount]{sequence[C_authqueuesize]{hash}}
 *
 * Gray Paper Section: merklization.tex (Equation C(2))
 * Formula:
 *
 * C(2) ↦ encode{authqueue}
 *
 * The authorization queue feeds the authorization pool for each core.
 * It contains pending authorizations waiting to be promoted to the pool.
 *
 * Structure per Gray Paper Equation (authorization.tex:19):
 * - authqueue ∈ sequence[C_corecount]{sequence[C_authqueuesize]{hash}}
 * - C_corecount = number of cores (from config service)
 * - C_authqueuesize = 80 (fixed queue size per core from Gray Paper definitions)
 *
 * Encoding:
 * - Fixed sequence of C_corecount cores
 * - Each core: fixed-length sequence of exactly C_authqueuesize authorization hashes
 * - Each hash: 32-byte authorization identifier
 * - Empty slots filled with zero hash (0x0000...)
 *
 * ✅ CORRECT: Encodes fixed sequence of cores with fixed-length authorization sequences
 * ✅ CORRECT: Uses AuthQueue.queue Map for core-indexed authorization sequences
 * ✅ CORRECT: Uses coreCount from config service for proper structure
 * ✅ CORRECT: Uses C_authqueuesize = 80 from Gray Paper definitions
 *
 * Implements Gray Paper authqueue serialization as specified
 * Reference: graypaper/text/authorization.tex and merklization.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * AuthQueue tracks pending authorizations that will be promoted to the AuthPool.
 * Each core has a fixed-size queue of up to 80 authorization hashes.
 *
 * Core components:
 * - **queue**: Map from core ID to array of authorization hashes
 * - **processingIndex**: Current processing position in the queue
 *
 * Serialization format:
 * 1. **sequence[C_corecount]**: Fixed sequence of cores
 * 2. **sequence[C_authqueuesize]**: Fixed-length sequence of 80 authorization hashes per core
 *
 * This is critical for JAM's authorization management and core assignment.
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnjam/core'
import type {
  AuthQueue,
  DecodingResult,
  IConfigService,
  Safe,
} from '@pbnjam/types'
import { AUTHORIZATION_CONSTANTS, safeError, safeResult } from '@pbnjam/types'
import { encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode authqueue according to Gray Paper C(2):
 * sequence[C_corecount]{sequence[C_authqueuesize]{hash}}
 */
export function encodeAuthqueue(
  authqueue: AuthQueue,
  configService: IConfigService,
): Safe<Uint8Array> {
  try {
    // Gray Paper: sequence[C_corecount]{sequence[C_authqueuesize]{hash}}
    const coreCount = configService.numCores
    const AUTH_QUEUE_SIZE = AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE

    // Create array for all cores, initialized with exactly C_authqueuesize slots each
    const coreQueues: Hex[][] = []

    // Initialize all cores with exactly C_authqueuesize authorization slots
    for (let i = 0; i < coreCount; i++) {
      coreQueues.push(
        new Array(AUTH_QUEUE_SIZE).fill(
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        ),
      )
    }

    // Populate cores with authorizations from the 2D array
    for (
      let coreIndex = 0;
      coreIndex < Math.min(authqueue.length, coreCount);
      coreIndex++
    ) {
      const coreQueue = authqueue[coreIndex] || []
      // Copy up to AUTH_QUEUE_SIZE authorizations, pad with zeros if needed
      for (let authIndex = 0; authIndex < AUTH_QUEUE_SIZE; authIndex++) {
        if (authIndex < coreQueue.length) {
          coreQueues[coreIndex][authIndex] = coreQueue[authIndex]
        }
        // Else: already initialized with zero hash
      }
    }

    // Encode as fixed-length sequence of cores
    const [error, encodedData] = encodeSequenceGeneric(
      coreQueues,
      (coreAuths) => {
        // Encode each core as a fixed-length sequence of exactly C_authqueuesize authorization hashes
        const encodedCoreAuths = coreAuths.map((hex) => hexToBytes(hex))
        return safeResult(concatBytes(encodedCoreAuths))
      },
    )
    if (error) return safeError(error)

    return safeResult(encodedData)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Decode authqueue according to Gray Paper C(2):
 * sequence[C_corecount]{sequence[C_authqueuesize]{hash}}
 */
export function decodeAuthqueue(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<AuthQueue>> {
  try {
    const coreCount = configService.numCores
    const AUTH_QUEUE_SIZE = AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE
    const HASH_SIZE = 32 // 32 bytes per hash

    let currentData = data
    const ZERO_HASH =
      '0x0000000000000000000000000000000000000000000000000000000000000000'

    const authqueue: AuthQueue = []

    // Decode each core's authorization queue
    for (let coreIdx = 0; coreIdx < coreCount; coreIdx++) {
      const coreAuths: Hex[] = []

      // Decode C_authqueuesize authorization hashes for this core
      for (let i = 0; i < AUTH_QUEUE_SIZE; i++) {
        if (currentData.length < HASH_SIZE) {
          return safeError(
            new Error(
              `Insufficient data for core ${coreIdx} authorization ${i}`,
            ),
          )
        }

        const hashBytes = currentData.slice(0, HASH_SIZE)
        const hash = bytesToHex(hashBytes)
        currentData = currentData.slice(HASH_SIZE)

        // Only add non-zero hashes to the queue
        if (hash !== ZERO_HASH) {
          coreAuths.push(hash)
        }
      }

      // Store the core's authorization queue (filter out zero hashes)
      authqueue.push(coreAuths)
    }

    const consumed = data.length - currentData.length

    return safeResult({
      value: authqueue,
      remaining: currentData,
      consumed,
    })
  } catch (error) {
    return safeError(error as Error)
  }
}
