/**
 * Service Account serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(255, s))
 * Formula:
 *
 * ∀ ⟨s, sa⟩ ∈ accounts: C(255, s) ↦ encode{
 *   0,
 *   sa_codehash,
 *   encode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis},
 *   encode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
 * }
 *
 * Gray Paper Section: accounts.tex
 * Service Account structure:
 *
 * serviceaccount ≡ tuple{
 *   codehash,
 *   balance,
 *   minaccgas,
 *   minmemogas,
 *   octets,
 *   gratis,
 *   items,
 *   created,
 *   lastacc,
 *   parent
 * }
 *
 * Implements Gray Paper service account serialization as specified
 * Reference: graypaper/text/merklization.tex and accounts.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Service accounts are the core stateful entities in JAM, analogous to
 * smart contract accounts in Ethereum. Each service account contains:
 *
 * Core fields:
 * - **codehash**: Hash of the service's code (32 bytes)
 * - **balance**: Account balance (8 bytes)
 * - **minaccgas**: Minimum gas for accumulation (8 bytes)
 * - **minmemogas**: Minimum gas for memory operations (8 bytes)
 * - **octets**: Storage size in octets (8 bytes)
 * - **gratis**: Free gas allowance (8 bytes)
 * - **items**: Number of storage items (4 bytes)
 * - **created**: Creation timestamp (4 bytes)
 * - **lastacc**: Last access timestamp (4 bytes)
 * - **parent**: Parent service index (4 bytes)
 *
 * Serialization format:
 * 1. **0**: Placeholder discriminator (1 byte)
 * 2. **codehash**: 32-byte hash
 * 3. **encode[8]**: 5 × 8-byte fields (40 bytes total)
 * 4. **encode[4]**: 4 × 4-byte fields (16 bytes total)
 *
 * This is critical for JAM's service account state management system.
 */

import { bytesToHex, concatBytes, hexToBytes } from '@pbnjam/core'
import type {
  DecodingResult,
  JamVersion,
  Safe,
  ServiceAccountCore,
} from '@pbnjam/types'
import { DEFAULT_JAM_VERSION, safeError, safeResult } from '@pbnjam/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'

/**
 * Encode service account according to Gray Paper specification.
 *
 * Gray Paper merklization.tex equation C(255, s):
 * ∀ ⟨s, sa⟩ ∈ accounts: C(255, s) ↦ encode{
 *   0,
 *   sa_codehash,
 *   encode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis},
 *   encode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
 * }
 *
 * Service accounts are the core stateful entities in JAM, analogous to
 * smart contract accounts in Ethereum.
 *
 * Field encoding per Gray Paper:
 * 1. **0**: Placeholder discriminator (1 byte) - included for JAM version > 0.7.0
 * 2. **codehash**: 32-byte hash of service code
 * 3. **encode[8]**: 5 × 8-byte fields (balance, minaccgas, minmemogas, octets, gratis)
 * 4. **encode[4]**: 4 × 4-byte fields (items, created, lastacc, parent)
 *
 * Service account semantics:
 * - **codehash**: Hash of the service's refinement and accumulation code
 * - **balance**: Account balance for gas payments and transfers
 * - **minaccgas**: Minimum gas required for accumulation operations
 * - **minmemogas**: Minimum gas required for memory operations
 * - **octets**: Total storage size in octets (computed field)
 * - **gratis**: Free gas allowance per operation
 * - **items**: Number of storage items (computed field)
 * - **created**: Block timestamp when account was created
 * - **lastacc**: Block timestamp of last access
 * - **parent**: Index of parent service (for inheritance)
 *
 * ✅ CORRECT: Uses encode[8] for 8-byte fields (balance, minaccgas, minmemogas, octets, gratis)
 * ✅ CORRECT: Uses encode[4] for 4-byte fields (items, created, lastacc, parent)
 * ✅ CORRECT: Includes placeholder discriminator (0) for JAM version > 0.7.0
 * ✅ CORRECT: Supports service account state management
 *
 * @param account - Service account to encode
 * @param jamVersion - Optional JAM version. Defaults to v0.7.2 (includes discriminator)
 * @returns Encoded octet sequence
 */
export function encodeServiceAccount(
  account: ServiceAccountCore,
  jamVersion?: JamVersion,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper: 0 (placeholder discriminator)
  // Include discriminator for JAM version > 0.7.0 (v0.7.1+)
  // Fuzzer test vectors (v0.7.0) omit this discriminator byte
  const version = jamVersion ?? DEFAULT_JAM_VERSION
  const includeDiscriminator =
    version.major > 0 ||
    (version.major === 0 && version.minor > 7) ||
    (version.major === 0 && version.minor === 7 && version.patch > 0)

  if (includeDiscriminator) {
    const [error, encoded] = encodeNatural(0n)
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
  }

  // Gray Paper: sa_codehash (32-byte hash)
  parts.push(hexToBytes(account.codehash))

  // Gray Paper: encode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis}
  // 5 × 8-byte fields = 40 bytes total
  const accountBytes = new Uint8Array(40)
  const view = new DataView(accountBytes.buffer)

  // Balance (8 bytes)
  view.setBigUint64(0, account.balance, true)

  // MinAccGas (8 bytes)
  view.setBigUint64(8, account.minaccgas, true)

  // MinMemoGas (8 bytes)
  view.setBigUint64(16, account.minmemogas, true)

  // Octets (8 bytes)
  view.setBigUint64(24, account.octets, true)

  // Gratis (8 bytes)
  view.setBigUint64(32, account.gratis, true)

  parts.push(accountBytes)

  // Gray Paper: encode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
  // 4 × 4-byte fields = 16 bytes total
  const metadataBytes = new Uint8Array(16)
  const metadataView = new DataView(metadataBytes.buffer)

  // Items (4 bytes)
  metadataView.setUint32(0, Number(account.items), true)

  // Created (4 bytes)
  metadataView.setUint32(4, Number(account.created), true)

  // LastAcc (4 bytes)
  metadataView.setUint32(8, Number(account.lastacc), true)

  // Parent (4 bytes)
  metadataView.setUint32(12, Number(account.parent), true)

  parts.push(metadataBytes)

  return safeResult(concatBytes(parts))
}

/**
 * Encode service account for INFO host function according to Gray Paper pvm_invocations.tex.
 *
 * Gray Paper pvm_invocations.tex (lines 466-472):
 * encode{
 *   codehash,
 *   encode[8]{balance, minbalance, minaccgas, minmemogas, octets},
 *   encode[4]{items},
 *   encode[8]{gratis},
 *   encode[4]{created, lastacc, parent}
 * }
 *
 * Total: 32 + 40 + 4 + 8 + 12 = 96 bytes
 *
 * This is DIFFERENT from the merklization format (C(255, s)) which:
 * - Includes discriminator byte (0)
 * - Groups fields differently
 * - Does not include minbalance
 * - Total: 89 bytes (with discriminator) or 88 bytes (without)
 *
 * @param account - Service account to encode
 * @param minbalance - Calculated minimum balance (Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
 * @returns Encoded octet sequence (96 bytes)
 */
export function encodeServiceAccountForInfo(
  account: ServiceAccountCore,
  minbalance: bigint,
  computedItems?: bigint, // Optional: computed items (2 * requests.size + storage.size)
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper pvm_invocations.tex: codehash (32 bytes)
  // NOTE: No discriminator byte (0) - INFO format is different from merklization
  parts.push(hexToBytes(account.codehash))

  // Gray Paper pvm_invocations.tex: encode[8]{balance, minbalance, minaccgas, minmemogas, octets}
  // 5 × 8-byte fields = 40 bytes total
  const accountBytes = new Uint8Array(40)
  const view = new DataView(accountBytes.buffer)

  // Balance (8 bytes)
  view.setBigUint64(0, account.balance, true)

  // MinBalance (8 bytes) - calculated value, not stored
  view.setBigUint64(8, minbalance, true)

  // MinAccGas (8 bytes)
  view.setBigUint64(16, account.minaccgas, true)

  // MinMemoGas (8 bytes)
  view.setBigUint64(24, account.minmemogas, true)

  // Octets (8 bytes)
  view.setBigUint64(32, account.octets, true)

  parts.push(accountBytes)

  // Gray Paper pvm_invocations.tex: encode[4]{items}
  // 1 × 4-byte field = 4 bytes
  // Use computedItems if provided (dynamically computed from requests/storage sizes),
  // otherwise fall back to stored account.items
  const itemsBytes = new Uint8Array(4)
  const itemsView = new DataView(itemsBytes.buffer)
  itemsView.setUint32(0, Number(computedItems ?? account.items), true)
  parts.push(itemsBytes)

  // Gray Paper pvm_invocations.tex: encode[8]{gratis}
  // 1 × 8-byte field = 8 bytes
  const gratisBytes = new Uint8Array(8)
  const gratisView = new DataView(gratisBytes.buffer)
  gratisView.setBigUint64(0, account.gratis, true)
  parts.push(gratisBytes)

  // Gray Paper pvm_invocations.tex: encode[4]{created, lastacc, parent}
  // 3 × 4-byte fields = 12 bytes total
  const metadataBytes = new Uint8Array(12)
  const metadataView = new DataView(metadataBytes.buffer)

  // Created (4 bytes)
  metadataView.setUint32(0, Number(account.created), true)

  // LastAcc (4 bytes)
  metadataView.setUint32(4, Number(account.lastacc), true)

  // Parent (4 bytes)
  metadataView.setUint32(8, Number(account.parent), true)

  parts.push(metadataBytes)

  return safeResult(concatBytes(parts))
}

/**
 * Decode service account according to Gray Paper specification.
 *
 * Decodes the Gray Paper compliant service account structure:
 * serviceaccount ≡ tuple{codehash, balance, minaccgas, minmemogas, octets, gratis, items, created, lastacc, parent}
 *
 * Each field is decoded according to its Gray Paper specification:
 * - codehash: 32-byte hash
 * - balance, minaccgas, minmemogas, octets, gratis: 8-byte fields
 * - items, created, lastacc, parent: 4-byte fields
 *
 * ✅ CORRECT: Decodes encode[8] for 8-byte fields
 * ✅ CORRECT: Decodes encode[4] for 4-byte fields
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @param jamVersion - Optional JAM version. Defaults to v0.7.2 (expects discriminator)
 * @returns Decoded service account and remaining data
 */
export function decodeServiceAccount(
  data: Uint8Array,
  jamVersion?: JamVersion,
): Safe<DecodingResult<ServiceAccountCore>> {
  let currentData = data

  // Gray Paper: 0 (placeholder discriminator)
  // Include discriminator for JAM version > 0.7.0 (v0.7.1+)
  // Fuzzer test vectors (v0.7.0) omit this discriminator byte
  const version = jamVersion ?? DEFAULT_JAM_VERSION
  const expectDiscriminator =
    version.major > 0 ||
    (version.major === 0 && version.minor > 7) ||
    (version.major === 0 && version.minor === 7 && version.patch > 0)

  if (expectDiscriminator) {
    // For v0.7.1+, expect discriminator byte
    if (currentData.length > 0 && currentData[0] === 0x00) {
      const [discriminatorError, discriminatorResult] =
        decodeNatural(currentData)
      if (discriminatorError) {
        return safeError(discriminatorError)
      }
      currentData = discriminatorResult.remaining
    } else {
      // Discriminator expected but missing - this is an error for v0.7.1+
      return safeError(
        new Error(
          `Service account discriminator expected for JAM version ${version.major}.${version.minor}.${version.patch} but first byte is 0x${currentData[0]?.toString(16) || 'undefined'}`,
        ),
      )
    }
  } else {
    // For v0.7.0 and earlier, discriminator is optional (fuzzer test vectors omit it)
    // If first byte is 0x00, decode it as natural number. Otherwise, assume discriminator is missing.
    if (currentData.length > 0 && currentData[0] === 0x00) {
      const [discriminatorError, discriminatorResult] =
        decodeNatural(currentData)
      if (discriminatorError) {
        return safeError(discriminatorError)
      }
      currentData = discriminatorResult.remaining
    }
    // If first byte is not 0x00, assume discriminator is missing and start with codehash
  }

  // Gray Paper: sa_codehash (32-byte hash)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for codehash'))
  }
  const codehashBytes = currentData.slice(0, 32)
  const codehash = bytesToHex(codehashBytes)
  currentData = currentData.slice(32)

  // Gray Paper: decode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis}
  if (currentData.length < 40) {
    return safeError(new Error('Insufficient data for account fields'))
  }
  const accountBytes = currentData.slice(0, 40)
  const accountView = new DataView(accountBytes.buffer)

  // Decode 8-byte fields
  const balance = accountView.getBigUint64(0, true)
  const minaccgas = accountView.getBigUint64(8, true)
  const minmemogas = accountView.getBigUint64(16, true)
  const octets = accountView.getBigUint64(24, true)
  const gratis = accountView.getBigUint64(32, true)

  currentData = currentData.slice(40)

  // Gray Paper: decode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
  if (currentData.length < 16) {
    return safeError(new Error('Insufficient data for metadata fields'))
  }
  const metadataBytes = currentData.slice(0, 16)
  const metadataView = new DataView(metadataBytes.buffer)

  // Decode 4-byte fields
  const items = BigInt(metadataView.getUint32(0, true))
  const created = BigInt(metadataView.getUint32(4, true))
  const lastacc = BigInt(metadataView.getUint32(8, true))
  const parent = BigInt(metadataView.getUint32(12, true))

  currentData = currentData.slice(16)

  const consumed = data.length - currentData.length

  return safeResult({
    value: {
      codehash,
      balance,
      minaccgas,
      minmemogas,
      octets,
      gratis,
      items,
      created,
      lastacc,
      parent,
    },
    remaining: currentData,
    consumed,
  })
}
