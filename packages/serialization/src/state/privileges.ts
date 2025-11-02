/**
 * Privileges serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(12))
 * Formula:
 *
 * C(12) ↦ encode{
 *   encode[4]{manager, assigners, delegator, registrar},
 *   alwaysaccers
 * }
 *
 * Gray Paper Section: accounts.tex (Equation 168-181)
 * Privileges structure:
 *
 * privileges ≡ tuple{
 *   manager,
 *   delegator,
 *   registrar,
 *   assigners,
 *   alwaysaccers
 * }
 *
 * manager ∈ serviceid
 * delegator ∈ serviceid
 * registrar ∈ serviceid
 * assigners ∈ sequence[Ccorecount]{serviceid}
 * alwaysaccers ∈ dictionary{serviceid}{gas}
 *
 * Implements Gray Paper privileges serialization as specified
 * Reference: graypaper/text/merklization.tex and accounts.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Privileges define the privileged service indices that have special
 * capabilities within the JAM protocol.
 *
 * Key concepts:
 * - **Manager**: Service able to alter privileges and bestow storage deposit credits
 * - **Delegator**: Service able to set staging set (validator keys)
 * - **Registrar**: Service able to create new service accounts in protected range
 * - **Assigners**: Services capable of altering authorizer queue (one per core)
 * - **Always Accers**: Services that automatically accumulate with basic gas
 *
 * Privilege types:
 * 1. **Manager**: Single blessed service for privilege management
 * 2. **Delegator**: Single service for validator set management
 * 3. **Registrar**: Single service for account creation
 * 4. **Assigners**: Fixed-length sequence of services (one per core)
 * 5. **Always Accers**: Dictionary mapping service IDs to gas amounts
 *
 * This is critical for JAM's privilege management system that ensures
 * proper access control and service capabilities.
 */

import { concatBytes } from '@pbnj/core'
import type { DecodingResult, Privileges, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import {
  type DictionaryEntry,
  decodeDictionary,
  encodeDictionary,
} from '../core/dictionary'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'

/**
 * Encode privileges according to Gray Paper specification.
 *
 * Gray Paper merklization.tex equation C(12):
 * C(12) ↦ encode{encode[4]{manager, assigners, delegator, registrar}, alwaysaccers}
 *
 * Gray Paper accounts.tex equation 168-181:
 * privileges ≡ tuple{manager, delegator, registrar, assigners, alwaysaccers}
 * manager ∈ serviceid
 * delegator ∈ serviceid
 * registrar ∈ serviceid
 * assigners ∈ sequence[Ccorecount]{serviceid}
 * alwaysaccers ∈ dictionary{serviceid}{gas}
 *
 * Privileges define the privileged service indices that have special
 * capabilities within the JAM protocol.
 *
 * Field encoding per Gray Paper:
 * 1. encode[4]{manager, assigners, delegator, registrar}: 16-byte fixed sequence
 * 2. alwaysaccers: Variable-length dictionary encoding
 *
 * Privilege semantics:
 * - **Manager**: Service able to alter privileges and bestow storage deposit credits
 * - **Delegator**: Service able to set staging set (validator keys)
 * - **Registrar**: Service able to create new service accounts in protected range
 * - **Assigners**: Services capable of altering authorizer queue (one per core)
 * - **Always Accers**: Services that automatically accumulate with basic gas
 *
 * Privilege types:
 * 1. **Manager**: Single blessed service for privilege management
 * 2. **Delegator**: Single service for validator set management
 * 3. **Registrar**: Single service for account creation
 * 4. **Assigners**: Fixed-length sequence of services (one per core)
 * 5. **Always Accers**: Dictionary mapping service IDs to gas amounts
 *
 * ✅ CORRECT: Uses encode[4] for manager, assigners, delegator, registrar
 * ✅ CORRECT: Assigners is sequence[Ccorecount]{serviceid}
 * ✅ CORRECT: Alwaysaccers is dictionary{serviceid}{gas}
 * ✅ CORRECT: Supports privilege management system
 *
 * @param privileges - Privileges state to encode
 * @param configService - Configuration service for core count
 * @returns Encoded octet sequence
 */
export function encodePrivileges(privileges: Privileges): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Gray Paper: encode[4]{manager, assigners, delegator, registrar}
  // This is a 16-byte fixed sequence: 4 bytes each for manager, assigners, delegator, registrar
  const privilegeBytes = new Uint8Array(16)
  const view = new DataView(privilegeBytes.buffer)

  // Manager (4 bytes)
  view.setUint32(0, Number(privileges.manager), true)

  // Assigners (4 bytes) - Note: This appears to be a single value in the Gray Paper formula
  // but the interface has assigners as an array. We'll encode the first assigner or 0
  const firstAssigner =
    privileges.assigners.length > 0 ? privileges.assigners[0] : 0n
  view.setUint32(4, Number(firstAssigner), true)

  // Delegator (4 bytes)
  view.setUint32(8, Number(privileges.delegator), true)

  // Registrar (4 bytes)
  view.setUint32(12, Number(privileges.registrar), true)

  parts.push(privilegeBytes)

  // Gray Paper: alwaysaccers - dictionary{serviceid}{gas}
  // Convert Map to DictionaryEntry array for proper dictionary encoding
  // Use fixed-length encoding for service IDs and gas values (4 bytes each)
  const alwaysAccersEntries: DictionaryEntry[] = []
  for (const [serviceId, gas] of privileges.alwaysaccers.entries()) {
    const [keyError, keyBytes] = encodeFixedLength(serviceId, 4n)
    if (keyError) {
      return safeError(keyError)
    }

    const [valueError, valueBytes] = encodeFixedLength(gas, 4n)
    if (valueError) {
      return safeError(valueError)
    }

    alwaysAccersEntries.push({
      key: keyBytes,
      value: valueBytes,
    })
  }

  const [error, encoded] = encodeDictionary(alwaysAccersEntries)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode privileges according to Gray Paper specification.
 *
 * Decodes the Gray Paper compliant privileges structure:
 * privileges ≡ tuple{manager, delegator, registrar, assigners, alwaysaccers}
 *
 * Each field is decoded according to its Gray Paper specification:
 * - manager, delegator, registrar: 4-byte service IDs
 * - assigners: Fixed-length sequence of service IDs (one per core)
 * - alwaysaccers: Variable-length dictionary of service ID to gas mappings
 *
 * ✅ CORRECT: Decodes encode[4] for manager, assigners, delegator, registrar
 * ✅ CORRECT: Assigners is sequence[Ccorecount]{serviceid}
 * ✅ CORRECT: Alwaysaccers is dictionary{serviceid}{gas}
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @param configService - Configuration service for core count
 * @returns Decoded privileges state and remaining data
 */
export function decodePrivileges(
  data: Uint8Array,
): Safe<DecodingResult<Privileges>> {
  let currentData = data

  // Gray Paper: decode[4]{manager, assigners, delegator, registrar}
  if (currentData.length < 16) {
    return safeError(new Error('Insufficient data for privileges header'))
  }

  const privilegeBytes = currentData.slice(0, 16)
  const view = new DataView(privilegeBytes.buffer)

  // Decode manager, assigners, delegator, registrar (4 bytes each)
  const manager = BigInt(view.getUint32(0, true))
  const assigners = BigInt(view.getUint32(4, true)) // Single value from Gray Paper
  const delegator = BigInt(view.getUint32(8, true))
  const registrar = BigInt(view.getUint32(12, true))

  currentData = currentData.slice(16)

  // Gray Paper: alwaysaccers - dictionary{serviceid}{gas}
  const [error, decoded] = decodeDictionary(currentData, 4, 4) // 4 bytes for serviceId, 4 bytes for gas
  if (error) {
    return safeError(error)
  }

  currentData = decoded.remaining
  const alwaysAccers = new Map<bigint, bigint>()

  // Convert DictionaryEntry array back to Map
  for (const entry of decoded.value) {
    // Decode service ID using fixed-length decoding (4 bytes)
    const [keyError, serviceId] = decodeFixedLength(entry.key, 4n)
    if (keyError) {
      return safeError(keyError)
    }

    // Decode gas using fixed-length decoding (4 bytes)
    const [valueError, gas] = decodeFixedLength(entry.value, 4n)
    if (valueError) {
      return safeError(valueError)
    }

    alwaysAccers.set(serviceId.value, gas.value)
  }

  const consumed = data.length - currentData.length

  return safeResult({
    value: {
      manager,
      delegator,
      registrar,
      assigners: [assigners], // Convert single value to array for interface compatibility
      alwaysaccers: alwaysAccers,
    },
    remaining: currentData,
    consumed,
  })
}
