/**
 * Service Account Utilities
 *
 * Gray Paper Reference: accounts.tex
 * Implements service account calculations according to Gray Paper specifications.
 */

import type { ServiceAccount } from '@pbnjam/types'
import { bytesToHex, hexToBytes } from 'viem'

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
 * @param serviceAccount - Service account with storage and requests
 * @param options - Optional parameters for calculating octets during a write operation
 * @returns Total octets count
 */
export function calculateServiceAccountOctets(
  serviceAccount: ServiceAccount,
  options?: {
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
  },
): bigint {
  let totalOctets = 0n

  // Sum over requests: 81 + z for each (h, z) in requests
  for (const [_hashHex, requestMap] of serviceAccount.requests) {
    for (const [length, _requestStatus] of requestMap) {
      totalOctets += 81n + length
    }
  }

  // Sum over storage: 34 + len(y) + len(x) for each (x, y) in storage
  // where x is the original storage key blob, y is the storage value blob
  const writeKeyHex = options?.writeKey
    ? bytesToHex(options.writeKey)
    : undefined

  for (const [storageKeyHex, storageValue] of serviceAccount.storage) {
    const isWriteKey = writeKeyHex && storageKeyHex === writeKeyHex

    if (isWriteKey) {
      // This is the key being modified
      if (!options?.isDelete && options?.writeValue && options?.writeKey) {
        // Adding/updating: use new value
        // Gray Paper: len(x) is the byte length of the original storage key blob
        const keyBytes = options.writeKey.length
        totalOctets += 34n + BigInt(keyBytes) + BigInt(options.writeValue.length)
      }
      // If deleting, skip this entry
    } else {
      // Different key: use existing value
      // Gray Paper: len(x) is the byte length of the original storage key blob
      // Storage keys are stored as hex strings, so convert back to original blob byte length
      const keyBytes = hexToBytes(storageKeyHex).length
      totalOctets += 34n + BigInt(keyBytes) + BigInt(storageValue.length)
    }
  }

  // If adding a new key (not updating existing), add it
  if (
    !options?.isDelete &&
    options?.writeKey &&
    options?.writeValue &&
    !serviceAccount.storage.has(writeKeyHex!)
  ) {
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
 * @param serviceAccount - Service account with storage and requests
 * @param options - Optional parameters for calculating items during a write operation
 * @returns Total items count
 */
export function calculateServiceAccountItems(
  serviceAccount: ServiceAccount,
  options?: {
    /**
     * Key being written (for write operations)
     */
    writeKey?: Uint8Array
    /**
     * Whether this is a delete operation
     */
    isDelete?: boolean
  },
): bigint {
  // Count unique request keys (hash, length pairs)
  let requestKeyCount = 0
  for (const [_hashHex, requestMap] of serviceAccount.requests) {
    for (const [_length, _requestStatus] of requestMap) {
      requestKeyCount++
    }
  }

  // Count storage entries
  let storageCount = serviceAccount.storage.size
  const writeKeyHex = options?.writeKey
    ? bytesToHex(options.writeKey)
    : undefined

  if (options?.writeKey) {
    if (options.isDelete) {
      // Deleting: subtract 1 if key exists
      if (serviceAccount.storage.has(writeKeyHex!)) {
        storageCount--
      }
    } else {
      // Adding/updating: add 1 if key doesn't exist
      if (!serviceAccount.storage.has(writeKeyHex!)) {
        storageCount++
      }
    }
  }

  // Gray Paper: items = 2 * len(requests) + len(storage)
  return BigInt(2 * requestKeyCount + storageCount)
}

