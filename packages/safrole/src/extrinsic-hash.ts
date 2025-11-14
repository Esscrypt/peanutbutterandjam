/**
 * Extrinsic Hash Calculation
 *
 * Implements Gray Paper specification for extrinsic hash calculation:
 * H_extrinsichash ≡ blake{encode{blakemany{a}}}
 *
 * where a = {
 *   encodetickets{XT_tickets},
 *   encodepreimages{XT_preimages},
 *   g,
 *   encodeassurances{XT_assurances},
 *   encodedisputes{XT_disputes}
 * }
 *
 * and g = encode{var{sequence{
 *   tuple{blake{xg_workreport}, encode[4]{xg_slot}, var{xg_signatures}}
 *   {
 *     tuple{xg_workreport, xg_slot, xg_signatures} ∈ XT_guarantees
 *   }
 * }}}
 */

import { blake2bHash, concatBytes, hexToBytes } from '@pbnj/core'
import {
  encodeAssurances,
  encodeDisputes,
  encodeGuarantees,
  encodePreimages,
  encodeSafroleTickets,
} from '@pbnj/codec'
import type { BlockBody, Guarantee, IConfigService, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'

/**
 * Encode guarantees component 'g' according to Gray Paper specification
 *
 * Gray Paper formula:
 * g = encode{var{sequence{
 *   tuple{blake{xg_workreport}, encode[4]{xg_slot}, var{xg_signatures}}
 *   {
 *     tuple{xg_workreport, xg_slot, xg_signatures} ∈ XT_guarantees
 *   }
 * }}}
 *
 * @param guarantees - Array of guarantees to encode
 * @returns Encoded guarantees component
 */
export function encodeGuaranteesComponent(
  guarantees: Guarantee[],
): Safe<Uint8Array> {
  try {
    // Use the existing encodeGuarantees function from serialization package
    return encodeGuarantees(guarantees)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Create the array 'a' containing all encoded extrinsic components
 *
 * Gray Paper formula:
 * a = {
 *   encodetickets{XT_tickets},
 *   encodepreimages{XT_preimages},
 *   g,
 *   encodeassurances{XT_assurances},
 *   encodedisputes{XT_disputes}
 * }
 *
 * @param extrinsic - Block extrinsic containing all components
 * @returns Array of encoded extrinsic components
 */
export function createExtrinsicArray(
  extrinsic: BlockBody,
  config: IConfigService,
): Safe<Uint8Array[]> {
  try {
    const encodedComponents: Uint8Array[] = []

    // 1. encodetickets{XT_tickets}
    const [ticketsError, ticketsEncoded] = encodeSafroleTickets(
      extrinsic.tickets || [],
    )
    if (ticketsError) {
      return safeError(ticketsError)
    }
    encodedComponents.push(ticketsEncoded)

    // 2. encodepreimages{XT_preimages}
    const [preimagesError, preimagesEncoded] = encodePreimages(
      extrinsic.preimages || [],
    )
    if (preimagesError) {
      return safeError(preimagesError)
    }
    encodedComponents.push(preimagesEncoded)

    // 3. g (guarantees component)
    const [guaranteesError, guaranteesEncoded] = encodeGuaranteesComponent(
      extrinsic.guarantees || [],
    )
    if (guaranteesError) {
      return safeError(guaranteesError)
    }
    encodedComponents.push(guaranteesEncoded)

    // 4. encodeassurances{XT_assurances}
    const [assurancesError, assurancesEncoded] = encodeAssurances(
      extrinsic.assurances || [],
      config,
    )
    if (assurancesError) {
      return safeError(assurancesError)
    }
    encodedComponents.push(assurancesEncoded)

    // 5. encodedisputes{XT_disputes}
    const [disputesError, disputesEncoded] = encodeDisputes(
      extrinsic.disputes || [],
    )
    if (disputesError) {
      return safeError(disputesError)
    }
    encodedComponents.push(disputesEncoded)

    return safeResult(encodedComponents)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Blake2b Merkle Tree Construction (blakemany)
 *
 * Implements Gray Paper specification for blakemany function:
 * blakemany{a} creates a Merkle tree from sequence a using Blake2b hashing
 *
 * Gray Paper formula: H_extrinsichash ≡ blake{encode{blakemany{a}}}
 *
 * The ^# notation suggests blakemany returns a sequence of hashes representing
 * the Merkle tree structure, not just the root hash. This allows encode{} to
 * properly serialize the tree structure before the final blake{} hash.
 *
 * This is a simple binary Merkle tree construction that:
 * 1. Takes a sequence of items
 * 2. Creates a binary Merkle tree by splitting at the middle index
 * 3. Uses Blake2b hashing for all nodes
 * 4. Returns the complete Merkle tree structure as sequence of hashes
 *
 * @param items - Array of Uint8Array items to merklize
 * @returns Merkle tree structure as array of Uint8Array hashes
 */
export function blakemany(items: Uint8Array[]): Safe<Uint8Array[]> {
  try {
    if (items.length === 0) {
      // Empty sequence - return array with single zero hash
      return safeResult([new Uint8Array(32)])
    }

    if (items.length === 1) {
      // Single item - hash it and return as single-element array
      const [hashError, hash] = blake2bHash(items[0])
      if (hashError) {
        return safeError(hashError)
      }
      return safeResult([hexToBytes(hash)])
    }

    // Multiple items - create binary Merkle tree
    let currentLevel = items.map((item) => {
      const [hashError, hash] = blake2bHash(item)
      if (hashError) {
        throw hashError
      }
      return hexToBytes(hash)
    })

    const merkleTree: Uint8Array[] = [...currentLevel] // Start with leaf level

    // Build Merkle tree level by level
    while (currentLevel.length > 1) {
      const nextLevel: Uint8Array[] = []

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left

        // Combine left and right hashes
        const combined = concatBytes([left, right])
        const [hashError, hash] = blake2bHash(combined)
        if (hashError) {
          return safeError(hashError)
        }
        nextLevel.push(hexToBytes(hash))
      }

      // Add this level to the tree structure
      merkleTree.push(...nextLevel)
      currentLevel = nextLevel
    }

    return safeResult(merkleTree)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Calculate extrinsic hash according to Gray Paper specification
 *
 * Gray Paper formula:
 * H_extrinsichash ≡ blake{encode{blakemany{a}}}
 *
 * This creates a Merkle commitment to all extrinsic data, allowing individual
 * components to be proven without revealing others.
 *
 * @param extrinsic - Block extrinsic containing all components
 * @returns Extrinsic hash as hex string
 */
export function calculateExtrinsicHash(
  extrinsic: BlockBody,
  config: IConfigService,
): Safe<string> {
  try {
    // Step 1: Create array 'a' of encoded components
    const [arrayError, encodedComponents] = createExtrinsicArray(
      extrinsic,
      config,
    )
    if (arrayError) {
      return safeError(arrayError)
    }

    // Step 2: Apply blakemany{a} - create Merkle tree of components
    const [blakemanyError, merkleTree] = blakemany(encodedComponents)
    if (blakemanyError) {
      return safeError(blakemanyError)
    }

    // Step 3: Apply encode{} - serialize the Merkle tree structure
    // For now, we'll concatenate all hashes in the tree structure
    // In a full implementation, this would use proper Gray Paper encoding
    const encodedTree = concatBytes(merkleTree)

    // Step 4: Apply blake{} - hash the encoded Merkle tree
    const [hashError, hash] = blake2bHash(encodedTree)
    if (hashError) {
      return safeError(hashError)
    }

    return safeResult(hash)
  } catch (error) {
    return safeError(error as Error)
  }
}
