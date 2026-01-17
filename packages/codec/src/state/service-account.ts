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

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnjam/core'
import type {
  DecodingResult,
  JamVersion,
  Safe,
  ServiceAccount,
} from '@pbnjam/types'
import { DEFAULT_JAM_VERSION, safeError, safeResult } from '@pbnjam/types'
import { encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { encodeVariableSequence } from '../core/sequence'
import { determineKeyTypes } from './state-key'
import {
  createServicePreimageKey,
  createServiceRequestKey,
  createServiceStorageKey,
} from './state-serialization'

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
  account: ServiceAccount,
  jamVersion?: JamVersion,
): Safe<Uint8Array> {
  // Recalculate items and octets from actual state to ensure consistency
  // Gray Paper: a_items = 2 * len(a_requests) + len(a_storage)
  // const storage = getAllServiceStorageItems(account)
  // const requests = getAllServiceRequests(account)
  // const recalculatedItems = BigInt(2 * requests.size + storage.size)

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

  // Octets (8 bytes) - use recalculated value
  view.setBigUint64(24, account.octets, true)

  // Gratis (8 bytes)
  view.setBigUint64(32, account.gratis, true)

  parts.push(accountBytes)

  // Gray Paper: encode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
  // 4 × 4-byte fields = 16 bytes total
  const metadataBytes = new Uint8Array(16)
  const metadataView = new DataView(metadataBytes.buffer)

  // Items (4 bytes) - use recalculated value
  // metadataView.setUint32(0, Number(recalculatedItems), true)
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
  account: ServiceAccount,
  minbalance: bigint,
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
  const itemsBytes = new Uint8Array(4)
  const itemsView = new DataView(itemsBytes.buffer)
  itemsView.setUint32(0, Number(account.items), true)
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

  const result = concatBytes(parts)

  return safeResult(result)
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
): Safe<DecodingResult<ServiceAccount>> {
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
      rawCshKeyvals: {}, // TODO: make sure this is set later in the flow
    },
    remaining: currentData,
    consumed,
  })
}

/**
 * Query service account preimage value
 *
 * Gray Paper merklization.tex (lines 105-106):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨h, p⟩ ∈ sa_preimages:
 * C(s, encode[4]{2³²-2} ∥ h) ↦ p
 *
 * @param serviceId - Service account ID
 * @param preimageHash - Preimage hash
 * @returns Preimage blob if found, undefined if not found
 */
export function getServicePreimageValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  preimageHash: Hex,
): Uint8Array | undefined {
  const preimageStateKey = createServicePreimageKey(serviceId, preimageHash)
  const stateKeyHex = bytesToHex(preimageStateKey)

  // Check raw rawCshKeyvals first (for test vectors)
  if (stateKeyHex in serviceAccount.rawCshKeyvals) {
    const value = serviceAccount.rawCshKeyvals[stateKeyHex]
    const valueBytes = hexToBytes(value)

    return valueBytes
  }

  return undefined
}

/**
 * Query service account request value
 *
 * Gray Paper merklization.tex (lines 107-110):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨⟨h, l⟩, t⟩ ∈ sa_requests:
 * C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
 *
 * @param serviceId - Service account ID
 * @param requestHash - Request hash (preimage hash)
 * @param length - Blob length
 * @returns Request status (timeslots array) if found, undefined if not found
 */
export function getServiceRequestValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  requestHash: Hex,
  length: bigint,
): bigint[] | undefined {
  const requestStateKey = createServiceRequestKey(
    serviceId,
    requestHash,
    length,
  )
  const stateKeyHex = bytesToHex(requestStateKey)

  // Check raw rawCshKeyvals first (for test vectors)
  let value: Hex | undefined
  if (stateKeyHex in serviceAccount.rawCshKeyvals) {
    value = serviceAccount.rawCshKeyvals[stateKeyHex]
  }

  if (!value) {
    return undefined
  }

  // Decode request status: var{sequence{encode[4]{x} | x ∈ t}}
  // This is a variable-length sequence of up to 3 timeslots (4-byte each)
  const valueBytes = hexToBytes(value)
  const [decodeError, decodeResult] = decodeNatural(valueBytes)
  if (decodeError || !decodeResult) {
    return undefined
  }

  const timeslotCount = Number(decodeResult.value)
  const lengthPrefixBytes = decodeResult.consumed
  const remainingBytes = valueBytes.length - lengthPrefixBytes
  const expectedBytes = timeslotCount * 4

  if (timeslotCount > 3 || remainingBytes !== expectedBytes) {
    return undefined
  }

  const timeslots: bigint[] = []
  for (let i = 0; i < timeslotCount; i++) {
    const offset = lengthPrefixBytes + i * 4
    if (offset + 4 <= valueBytes.length) {
      const view = new DataView(
        valueBytes.buffer,
        valueBytes.byteOffset + offset,
        4,
      )
      const timeslot = BigInt(view.getUint32(0, true)) // little-endian
      timeslots.push(timeslot)
    }
  }

  if (timeslots.length === timeslotCount) {
    return timeslots
  }

  return undefined
}

/**
 * Query service account storage value
 *
 * Gray Paper merklization.tex (lines 103-104):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨k, v⟩ ∈ sa_storage:
 * C(s, encode[4]{2³²-1} ∥ k) ↦ v
 *
 * @param serviceId - Service account ID
 * @param storageKey - Storage key (blob)
 * @returns Storage value if found, undefined if not found
 */
export function getServiceStorageValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  storageKey: Hex,
): Uint8Array | undefined {
  const storageStateKey = createServiceStorageKey(serviceId, storageKey)
  const stateKeyHex = bytesToHex(storageStateKey)

  // Check raw rawCshKeyvals first (for test vectors)
  if (stateKeyHex in serviceAccount.rawCshKeyvals) {
    const value = serviceAccount.rawCshKeyvals[stateKeyHex]
    const valueBytes = hexToBytes(value)
    return valueBytes
  }

  return undefined
}

export function getServiceStorageKey(serviceId: bigint, storageKey: Hex): Hex {
  const storageStateKey = createServiceStorageKey(serviceId, storageKey)
  return bytesToHex(storageStateKey)
}

export function deleteServiceStorageValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  storageKey: Hex,
): void {
  const storageStateKey = createServiceStorageKey(serviceId, storageKey)
  const stateKeyHex = bytesToHex(storageStateKey)
  delete serviceAccount.rawCshKeyvals[stateKeyHex]
}

export function setServiceStorageValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  storageKey: Hex,
  storageValue: Uint8Array,
): void {
  const storageStateKey = createServiceStorageKey(serviceId, storageKey)
  const stateKeyHex = bytesToHex(storageStateKey)

  // #region agent log
  if (typeof fetch !== 'undefined') {
    fetch(
      'http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'service-account.ts:564',
          message: 'Setting service storage value',
          data: {
            serviceId: serviceId.toString(),
            stateKeyHex: stateKeyHex,
            storageKeyLength: storageKey.length,
            storageValueLength: storageValue.length,
            alreadyExists: !!serviceAccount.rawCshKeyvals[stateKeyHex],
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'post-fix',
          hypothesisId: 'C',
        }),
      },
    ).catch(() => {})
  }
  // #endregion

  serviceAccount.rawCshKeyvals[stateKeyHex] = bytesToHex(storageValue)
}

export function setServicePreimageValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  preimageHash: Hex,
  preimageValue: Uint8Array,
): void {
  const preimageStateKey = createServicePreimageKey(serviceId, preimageHash)
  const stateKeyHex = bytesToHex(preimageStateKey)

  serviceAccount.rawCshKeyvals[stateKeyHex] = bytesToHex(preimageValue)
}

export function deleteServicePreimageValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  preimageHash: Hex,
): void {
  const preimageStateKey = createServicePreimageKey(serviceId, preimageHash)
  const stateKeyHex = bytesToHex(preimageStateKey)
  delete serviceAccount.rawCshKeyvals[stateKeyHex]
}

export function setServiceRequestValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  requestHash: Hex,
  length: bigint,
  requestValue: bigint[],
): void {
  const requestStateKey = createServiceRequestKey(
    serviceId,
    requestHash,
    length,
  )
  const stateKeyHex = bytesToHex(requestStateKey)

  // Encode request value: var{sequence{encode[4]{x} | x ∈ t}}
  // Gray Paper merklization.tex (lines 107-110)
  if (requestValue.length > 3) {
    throw new Error('Invalid request value: maximum 3 timeslots allowed')
  }

  const [encodeError, requestValueBytes] = encodeVariableSequence(
    requestValue,
    (timeslot: bigint) => encodeFixedLength(timeslot, 4n),
  )

  if (encodeError) {
    throw new Error(`Failed to encode request value: ${encodeError.message}`)
  }

  serviceAccount.rawCshKeyvals[stateKeyHex] = bytesToHex(requestValueBytes)
}

export function deleteServiceRequestValue(
  serviceAccount: ServiceAccount,
  serviceId: bigint,
  requestHash: Hex,
  length: bigint,
): void {
  const requestStateKey = createServiceRequestKey(
    serviceId,
    requestHash,
    length,
  )
  const stateKeyHex = bytesToHex(requestStateKey)
  delete serviceAccount.rawCshKeyvals[stateKeyHex]
}

/**
 * Extract the 27-byte Blake hash from a C(s, h) state key
 *
 * Gray Paper: C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
 * where n = encode[4](s), a = blake(h)
 * The Blake hash is in bytes 1, 3, 5, 7, 8-30 (interleaved with service ID)
 *
 * @param stateKeyBytes - 31-byte state key
 * @returns 27-byte Blake hash as Hex
 */

/**
 * Get all storage items for a service account
 *
 * Iterates through all C(s, h) keys in rawCshKeyvals and returns those that
 * are storage items. Uses determineKeyTypes to distinguish storage from preimages.
 *
 * Gray Paper merklization.tex (lines 103-104):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨k, v⟩ ∈ sa_storage:
 * C(s, encode[4]{2³²-1} ∥ k) ↦ v
 *
 * @param serviceAccount - Service account to query
 * @returns Map of state keys to storage values (as Uint8Array)
 */
export function getAllServiceStorageItems(
  serviceAccount: ServiceAccount,
  currentTimeslot?: bigint,
): Map<Hex, Uint8Array> {
  const storageItems = new Map<Hex, Uint8Array>()

  // Use determineKeyTypes to classify all keys at once
  const keyTypes = determineKeyTypes(
    serviceAccount.rawCshKeyvals,
    currentTimeslot,
  )

  for (const [stateKeyHex, keyType] of keyTypes) {
    if (keyType.keyType === 'storage') {
      storageItems.set(stateKeyHex, keyType.value)
    }
  }

  return storageItems
}

/**
 * Extract service ID from a C(s, h) state key
 *
 * Gray Paper: C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
 * where n = encode[4](s), a = blake(h)
 * The service ID is in bytes 0, 2, 4, 6 (interleaved with Blake hash)
 *
 * @param stateKeyBytes - 31-byte state key
 * @returns Service ID if valid, null otherwise
 */
export function extractServiceIdFromStateKey(
  stateKeyBytes: Uint8Array,
): bigint | null {
  if (stateKeyBytes.length !== 31) {
    return null
  }
  const serviceIdBytes = new Uint8Array(4)
  serviceIdBytes[0] = stateKeyBytes[0] // n₀
  serviceIdBytes[1] = stateKeyBytes[2] // n₁
  serviceIdBytes[2] = stateKeyBytes[4] // n₂
  serviceIdBytes[3] = stateKeyBytes[6] // n₃
  const view = new DataView(serviceIdBytes.buffer)
  return BigInt(view.getUint32(0, true)) // little-endian
}

/**
 * Get all requests for a service account
 *
 * Iterates through all C(s, h) keys in rawCshKeyvals and returns those that
 * have request-encoded values. Uses determineKeyTypes to identify requests.
 *
 * Gray Paper merklization.tex (lines 107-110):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨⟨h, l⟩, t⟩ ∈ sa_requests:
 * C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
 *
 * @param serviceAccount - Service account to query
 * @returns Map of state keys to {timeslots, blobLength} objects
 * Note: The blob length is obtained from the preimage if it exists, otherwise 0
 */
export function getAllServiceRequests(
  serviceAccount: ServiceAccount,
  currentTimeslot?: bigint,
): Map<Hex, { timeslots: bigint[]; blobLength: bigint }> {
  const requests = new Map<Hex, { timeslots: bigint[]; blobLength: bigint }>()

  // Use determineKeyTypes to classify all keys at once
  const keyTypes = determineKeyTypes(
    serviceAccount.rawCshKeyvals,
    currentTimeslot,
  )

  // Get all preimages to look up blob lengths
  const preimages = getAllServicePreimages(serviceAccount, currentTimeslot)
  const preimageMap = new Map<Hex, Uint8Array>()
  for (const [, preimageData] of preimages) {
    preimageMap.set(preimageData.preimageHash, preimageData.blob)
  }

  for (const [stateKeyHex, keyType] of keyTypes) {
    if (keyType.keyType === 'request') {
      // Get blob length from preimage if it exists, otherwise 0
      const preimageBlob = preimageMap.get(keyType.preimageHash)
      const blobLength = preimageBlob ? BigInt(preimageBlob.length) : 0n

      requests.set(stateKeyHex, {
        timeslots: keyType.timeslots,
        blobLength,
      })
    }
  }

  return requests
}

/**
 * Get all preimages for a service account
 *
 * Iterates through all C(s, h) keys in rawCshKeyvals and returns those that
 * are preimages. Uses determineKeyTypes to distinguish preimages from storage.
 *
 * Gray Paper merklization.tex (lines 105-106):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨h, p⟩ ∈ sa_preimages:
 * C(s, encode[4]{2³²-2} ∥ h) ↦ p
 *
 * @param serviceAccount - Service account to query
 * @returns Map of state keys to preimage values (as Uint8Array)
 * Note: The map key is the state key, and the value includes the preimage hash
 * in the returned object structure from determineKeyTypes.
 */
export function getAllServicePreimages(
  serviceAccount: ServiceAccount,
  currentTimeslot?: bigint,
): Map<Hex, { preimageHash: Hex; blob: Uint8Array }> {
  const preimages = new Map<Hex, { preimageHash: Hex; blob: Uint8Array }>()

  // Use determineKeyTypes to classify all keys at once
  const keyTypes = determineKeyTypes(
    serviceAccount.rawCshKeyvals,
    currentTimeslot,
  )

  for (const [stateKeyHex, keyType] of keyTypes) {
    if (keyType.keyType === 'preimage') {
      preimages.set(stateKeyHex, {
        preimageHash: keyType.preimageHash,
        blob: keyType.blob,
      })
    }
  }

  return preimages
}
