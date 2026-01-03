/**
 * Service ID Generation Utilities
 *
 * Gray Paper Specification: pvm_invocations.tex
 * Implements service ID generation and checking according to Gray Paper equations
 */

import { encodeNatural } from '@pbnjam/codec'
import { blake2bHash, hexToBytes } from '@pbnjam/core'
import type { Safe, JamVersion, ServiceAccount } from '@pbnjam/types'
import { DEFAULT_JAM_VERSION, DEPOSIT_CONSTANTS, safeError, safeResult } from '@pbnjam/types'

// Gray Paper constant: Cminpublicindex = 2^16 = 65,536
const MIN_PUBLIC_INDEX = 65536n

/**
 * Generate next service ID according to Gray Paper specification
 *
 * Gray Paper pvm_invocations.tex equations 175-186:
 * im_nextfreeid = check((decode[4]{blake{encode{im_id, entropyaccumulator', H_timeslot}}}
 *                        mod (2^32 - Cminpublicindex - 2^8))
 *                        + Cminpublicindex)
 *
 * Version differences:
 * - v0.7.0: mod (2^32 - 2^9) + 2^8
 * - v0.7.1+: mod (2^32 - Cminpublicindex - 2^8) + Cminpublicindex
 *
 * @param serviceId - Current service ID (im_id)
 * @param entropyAccumulator - 32-byte entropy accumulator
 * @param timeslot - Block header timeslot (H_timeslot)
 * @param accounts - Map of existing service accounts (for collision checking)
 * @param jamVersion - Optional JAM version (defaults to v0.7.2)
 * @returns Next available service ID
 */
export function generateNextServiceId(
  serviceId: bigint,
  entropyAccumulator: Uint8Array,
  timeslot: bigint,
  accounts: Map<bigint, ServiceAccount>,
  jamVersion?: JamVersion,
): Safe<bigint> {
  const version = jamVersion ?? DEFAULT_JAM_VERSION

  if (entropyAccumulator.length !== 32) {
    return safeError(
      new Error(
        `Invalid entropy accumulator length: expected 32 bytes, got ${entropyAccumulator.length}`,
      ),
    )
  }

  // Step 1: Encode serviceid (natural encoding) - Gray Paper: encode{im_id, ...}
  const [serviceIdError, encodedServiceId] = encodeNatural(serviceId)
  if (serviceIdError) {
    return safeError(
      new Error(`Failed to encode service ID: ${serviceIdError.message}`),
    )
  }

  // Step 2: Encode timeslot (natural encoding) - Gray Paper: encode{..., H_timeslot}
  const [timeslotError, encodedTimeslot] = encodeNatural(timeslot)
  if (timeslotError) {
    return safeError(
      new Error(`Failed to encode timeslot: ${timeslotError.message}`),
    )
  }

  // Step 3: Concatenate: encode{im_id, entropyaccumulator', H_timeslot}
  const inputToHash = new Uint8Array(
    encodedServiceId.length +
      entropyAccumulator.length +
      encodedTimeslot.length,
  )
  let offset = 0
  inputToHash.set(encodedServiceId, offset)
  offset += encodedServiceId.length
  inputToHash.set(entropyAccumulator, offset)
  offset += entropyAccumulator.length
  inputToHash.set(encodedTimeslot, offset)

  // Step 4: Blake2b hash - Gray Paper: blake{encode{im_id, entropyaccumulator', H_timeslot}}
  const [hashError, hashHex] = blake2bHash(inputToHash)
  if (hashError) {
    return safeError(
      new Error(`Failed to compute Blake2b hash: ${hashError.message}`),
    )
  }

  // Step 5: Decode first 4 bytes as uint32 (LITTLE-ENDIAN) - Gray Paper: decode[4]{...}
  const hash = hexToBytes(hashHex)
  if (hash.length < 4) {
    return safeError(
      new Error(
        `Hash too short: expected at least 4 bytes, got ${hash.length}`,
      ),
    )
  }
  const hashView = new DataView(hash.buffer, hash.byteOffset, hash.byteLength)
  const decodedHash = BigInt(hashView.getUint32(0, true)) // true = little-endian

  // Step 6: Calculate nextfreeid candidate - Gray Paper formula
  const isV070OrEarlier =
    version.major < 0 ||
    (version.major === 0 && version.minor < 7) ||
    (version.major === 0 && version.minor === 7 && version.patch <= 0)

  let MODULUS: bigint
  let OFFSET: bigint

  if (isV070OrEarlier) {
    // v0.7.0 formula: mod (2^32 - 2^9) + 2^8
    MODULUS = 2n ** 32n - 2n ** 9n // 2^32 - 512
    OFFSET = 2n ** 8n // 256
    } else {
      // v0.7.1+ formula: mod (2^32 - Cminpublicindex - 2^8) + Cminpublicindex
      MODULUS = 2n ** 32n - MIN_PUBLIC_INDEX - 2n ** 8n // 2^32 - 65536 - 256
      OFFSET = MIN_PUBLIC_INDEX // 65536
    }

  const candidateId = (decodedHash % MODULUS) + OFFSET

  // Step 7: Apply check function to find available ID - Gray Paper equation 251-255
  const nextfreeid = checkServiceId(candidateId, accounts, version)

  return safeResult(nextfreeid)
}

/**
 * Check function from Gray Paper equation 251-255
 *
 * Gray Paper pvm_invocations.tex:
 * Version differences:
 * - v0.7.0: check((i - 2^8 + 1) mod (2^32 - 2^9) + 2^8)
 * - v0.7.1+: check((i - Cminpublicindex + 1) mod (2^32 - 2^8 - Cminpublicindex) + Cminpublicindex)
 *
 * Recursively finds the first available service ID starting from the given candidate.
 *
 * @param id - Candidate service ID to check
 * @param accounts - Map of existing service accounts
 * @param jamVersion - Optional JAM version (defaults to v0.7.2)
 * @returns First available service ID starting from candidate
 */
export function checkServiceId(
  id: bigint,
  accounts: Map<bigint, ServiceAccount>,
  jamVersion?: JamVersion,
): bigint {
  const version = jamVersion ?? DEFAULT_JAM_VERSION
  const isV070OrEarlier =
    version.major < 0 ||
    (version.major === 0 && version.minor < 7) ||
    (version.major === 0 && version.minor === 7 && version.patch <= 0)

  // If ID is not in accounts, return it
  if (!accounts.has(id)) {
    return id
  }

  // Otherwise, recursively check the next candidate
  let MODULUS: bigint
  let OFFSET: bigint
  let nextCandidate: bigint

  if (isV070OrEarlier) {
    // v0.7.0: check((i - 2^8 + 1) mod (2^32 - 2^9) + 2^8)
    MODULUS = 2n ** 32n - 2n ** 9n // 2^32 - 512
    OFFSET = 2n ** 8n // 256
    nextCandidate = OFFSET + ((id - OFFSET + 1n) % MODULUS)
    } else {
      // v0.7.1+: check((i - Cminpublicindex + 1) mod (2^32 - 2^8 - Cminpublicindex) + Cminpublicindex)
      MODULUS = 2n ** 32n - 2n ** 8n - MIN_PUBLIC_INDEX // 2^32 - 2^8 - Cminpublicindex
      OFFSET = MIN_PUBLIC_INDEX
      nextCandidate = OFFSET + ((id - OFFSET + 1n) % MODULUS)
    }

  return checkServiceId(nextCandidate, accounts, version)
}

/**
 * Calculate next free ID after service creation (Gray Paper line 791)
 *
 * Gray Paper line 791: i* = check(Cminpublicindex + (im_nextfreeid - Cminpublicindex + 42) mod (2^32 - Cminpublicindex - 2^8))
 *
 * This is used to update nextfreeid after creating a new service.
 * The initial nextfreeid is generated by generateNextServiceId using entropy.
 *
 * @param currentId - Current nextfreeid value
 * @param accounts - Map of existing service accounts
 * @returns Next free ID for future service creation
 */
export function calculateNextFreeId(
  currentId: bigint,
  accounts: Map<bigint, ServiceAccount>,
): bigint {
  const MODULUS = 2n ** 32n - MIN_PUBLIC_INDEX - 2n ** 8n // 2^32 - Cminpublicindex - 2^8

  // Gray Paper line 791: Calculate candidate ID
  // i* = Cminpublicindex + (im_nextfreeid - Cminpublicindex + 42) mod (2^32 - Cminpublicindex - 2^8)
  const candidateId =
    MIN_PUBLIC_INDEX + ((currentId - MIN_PUBLIC_INDEX + 42n) % MODULUS)

  // Gray Paper line 252-255: Apply check function to ensure ID is available
  // Note: This uses v0.7.1+ formula (no version parameter needed for post-creation update)
  return checkServiceId(candidateId, accounts)
}

/**
 * Calculate minimum balance according to Gray Paper specification
 *
 * Gray Paper accounts.tex equation (deposits):
 * minbalance = max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
 *
 * @param items - Number of items (2 * requests + storage)
 * @param octets - Total octets (sum of (81 + z) for requests + storage values)
 * @param gratis - Gratis (free deposit allowance)
 * @returns Minimum balance required
 */
export function calculateMinBalance(
  items: bigint,
  octets: bigint,
  gratis: bigint,
): bigint {
  const baseDeposit = BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT)
  const itemDeposit = BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT) * items
  const byteDeposit = BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT) * octets

  const totalDeposit = baseDeposit + itemDeposit + byteDeposit
  const minBalance = totalDeposit > gratis ? totalDeposit - gratis : 0n

  return minBalance
}

