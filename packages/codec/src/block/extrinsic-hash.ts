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

import { blake2bHash, blakemany } from '@pbnjam/core'
import type { BlockBody, IConfigService, Safe } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { encodeUint8Array } from '../core/sequence'
import { encodeAssurances } from './assurance'
import { encodeDisputes } from './dispute'
import { encodeGuaranteesForExtrinsicHash } from './guarantee'
import { encodePreimages } from './preimage'
import { encodeSafroleTickets } from './ticket'

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

    // 3. g (guarantees component) - For extrinsic hash, we hash the work report first!
    const [guaranteesError, guaranteesEncoded] =
      encodeGuaranteesForExtrinsicHash(extrinsic.guarantees || [])
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
    // Gray Paper: encode([i₀, i₁, ...]) ≡ encode(i₀) ∥ encode(i₁) ∥ ...
    // For fixed-length items like hashes (32 bytes), identity serialization applies:
    // we simply concatenate the hashes directly
    // Note: blakemany returns only leaf hashes, not all tree nodes
    const [encodeError, encodedTree] = encodeUint8Array(merkleTree)
    if (encodeError) {
      return safeError(encodeError)
    }

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
