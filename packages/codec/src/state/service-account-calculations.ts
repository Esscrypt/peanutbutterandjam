/**
 * Service Account Utilities
 *
 * Gray Paper Reference: accounts.tex
 * Implements service account calculations according to Gray Paper specifications.
 */

import {
  createServiceStorageKey,
  getAllServiceRequests,
  getAllServiceStorageItems,
} from '@pbnjam/codec'
import type { ServiceAccount } from '@pbnjam/types'
import { bytesToHex } from 'viem'

/**
 * Calculate service account octets according to Gray Paper specification
 *
 * Gray Paper accounts.tex line 148:
 * a_octets = sum((81 + z) for (h, z) in keys(requests)) + sum((34 + len(y) + len(x)) for (x, y) in storage)
 *
 * Where:
 * - (h, z) are request keys: h is the hash, z is the blob length
 * - (x, y) are storage entries: x is the original storage key blob, y is the storage value blob
 * - len(x) is the byte length of the original storage key blob (NOT the 31-byte state trie key)
 *
 * NOTE: When calculating from rawCshKeyvals (state keys), we cannot recover the original storage key
 * length (len(x)) because state keys only contain the Blake hash of the original key.
 * We use the approximation 34 + len(value) for storage items when we don't have the original key.
 * However, during write operations, we DO have the original key, so we can use the full formula.
 *
 * @param serviceAccount - Service account with rawCshKeyvals
 * @param options - Optional parameters for calculating octets during a write operation
 * @returns Total octets count
 */
export function calculateServiceAccountOctets(
  serviceAccount: ServiceAccount,
  options?: {
    /**
     * Service ID (required for write operations to create state key)
     */
    serviceId?: bigint
    /**
     * Key being written (for write operations)
     * If provided, this key will use the new value instead of the stored value
     */
    writeKey?: Uint8Array
    /**
     * Value being written (for write operations)
     * If provided, this value will be used for the writeKey instead of the stored value
     */
    writeValue?: Uint8Array
    /**
     * Whether this is a delete operation
     * If true, the writeKey will be excluded from the calculation
     */
    isDelete?: boolean
    /**
     * Current timeslot (for request classification)
     */
    currentTimeslot?: bigint
  },
): bigint {
  let totalOctets = 0n

  // Get all requests from rawCshKeyvals
  const requests = getAllServiceRequests(
    serviceAccount,
    options?.currentTimeslot,
  )

  // Sum over requests: 81 + z for each (h, z) in requests
  // z is the blob length from the request
  for (const [, requestData] of requests) {
    totalOctets += 81n + requestData.blobLength
  }

  // Get all storage items from rawCshKeyvals
  const storageItems = getAllServiceStorageItems(
    serviceAccount,
    options?.currentTimeslot,
  )

  // Handle write operation if provided
  let writeKeyStateKeyHex: `0x${string}` | undefined
  if (options?.writeKey && options?.serviceId) {
    // Create state key from original storage key for comparison
    const storageKeyHex = bytesToHex(options.writeKey) as `0x${string}`
    const storageStateKey = createServiceStorageKey(
      options.serviceId,
      storageKeyHex,
    )
    writeKeyStateKeyHex = bytesToHex(storageStateKey) as `0x${string}`
  }

  // Sum over storage: 34 + len(y) + len(x) for each (x, y) in storage
  // where x is the original storage key blob, y is the storage value blob
  for (const [stateKeyHex, storageValue] of storageItems) {
    const isWriteKey =
      writeKeyStateKeyHex && stateKeyHex === writeKeyStateKeyHex

    if (isWriteKey) {
      // This is the key being modified
      if (!options?.isDelete && options?.writeValue && options?.writeKey) {
        // Adding/updating: use new value and original key length
        // Gray Paper: len(x) is the byte length of the original storage key blob
        const keyBytes = options.writeKey.length
        totalOctets +=
          34n + BigInt(keyBytes) + BigInt(options.writeValue.length)
      }
      // If deleting, skip this entry (don't add it to total)
    } else {
      // Different key: use existing value
      // NOTE: We cannot get the original key length (len(x)) from the state key alone,
      // as state keys only contain the Blake hash of the original key.
      // We use 34 + len(value) as an approximation (same as decodeCompleteServiceAccount)
      const valueLength = BigInt(storageValue.length)
      totalOctets += 34n + valueLength
    }
  }

  // If adding a new key (not updating existing), add it
  if (
    !options?.isDelete &&
    options?.writeKey &&
    options?.writeValue &&
    options?.serviceId &&
    writeKeyStateKeyHex &&
    !storageItems.has(writeKeyStateKeyHex)
  ) {
    // Adding new key: use full formula with original key length
    const keyBytes = options.writeKey.length
    totalOctets += 34n + BigInt(keyBytes) + BigInt(options.writeValue.length)
  }

  return totalOctets
}

/**
 * Calculate service account items according to Gray Paper specification
 *
 * Gray Paper accounts.tex line 145:
 * a_items = 2 * len(requests) + len(storage)
 *
 * @param serviceAccount - Service account with rawCshKeyvals
 * @param options - Optional parameters for calculating items during a write operation
 * @returns Total items count
 */
export function calculateServiceAccountItems(
  serviceAccount: ServiceAccount,
  options?: {
    /**
     * Service ID (required for write operations to create state key)
     */
    serviceId?: bigint
    /**
     * Key being written (for write operations)
     */
    writeKey?: Uint8Array
    /**
     * Whether this is a delete operation
     */
    isDelete?: boolean
    /**
     * Current timeslot (for request classification)
     */
    currentTimeslot?: bigint
  },
): bigint {
  // Get all requests from rawCshKeyvals
  const requests = getAllServiceRequests(
    serviceAccount,
    options?.currentTimeslot,
  )

  // Count unique request keys (hash, length pairs)
  const requestKeyCount = requests.size

  // Get all storage items from rawCshKeyvals
  const storageItems = getAllServiceStorageItems(
    serviceAccount,
    options?.currentTimeslot,
  )

  // Count storage entries
  let storageCount = storageItems.size

  // Handle write operation if provided
  if (options?.writeKey && options?.serviceId) {
    // Create state key from original storage key for comparison
    const storageKeyHex = bytesToHex(options.writeKey) as `0x${string}`
    const storageStateKey = createServiceStorageKey(
      options.serviceId,
      storageKeyHex,
    )
    const writeKeyStateKeyHex = bytesToHex(storageStateKey) as `0x${string}`
    const keyExists = storageItems.has(writeKeyStateKeyHex)

    if (options.isDelete) {
      // Deleting: subtract 1 if key exists
      if (keyExists) {
        storageCount--
      }
    } else {
      // Adding/updating: add 1 if key doesn't exist
      if (!keyExists) {
        storageCount++
      }
    }
  }

  // Gray Paper: items = 2 * len(requests) + len(storage)
  return BigInt(2 * requestKeyCount + storageCount)
}
