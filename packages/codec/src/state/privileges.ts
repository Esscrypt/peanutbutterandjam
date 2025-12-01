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
import type {
  DecodingResult,
  IConfigService,
  JamVersion,
  Privileges,
  Safe,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import {
  type DictionaryEntry,
  decodeDictionary,
  encodeDictionary,
} from '../core/dictionary'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { encodeSequenceGeneric } from '../core/sequence'

/**
 * Default latest JAM version for privileges encoding/decoding
 * Defaults to v0.7.2 (latest Gray Paper version with registrar field)
 */
const DEFAULT_JAM_VERSION: JamVersion = { major: 0, minor: 7, patch: 2 }

/**
 * Encode privileges according to Gray Paper specification.
 *
 * Supports both v0.7.0 and v0.7.1+ formats:
 *
 * **v0.7.0** (Gray Paper v0.7.0):
 * - C(12) ↦ encode{encode[4]{manager, assigners, delegator}, alwaysaccers}
 * - Structure: manager, assigners, delegator, alwaysaccers (no registrar)
 *
 * **v0.7.1+** (Gray Paper v0.7.1+):
 * - C(12) ↦ encode{encode[4]{manager, assigners, delegator, registrar}, alwaysaccers}
 * - Structure: manager, delegator, registrar, assigners, alwaysaccers
 *
 * Privileges define the privileged service indices that have special
 * capabilities within the JAM protocol.
 *
 * Field encoding per Gray Paper:
 * - manager: encode[4]{serviceid} = 4 bytes
 * - assigners: sequence[Ccorecount]{serviceid} = 4 * Ccorecount bytes
 * - delegator: encode[4]{serviceid} = 4 bytes
 * - registrar: encode[4]{serviceid} = 4 bytes (v0.7.1+ only)
 * - alwaysaccers: dictionary{serviceid}{gas} (variable length)
 *
 * Privilege semantics:
 * - **Manager**: Service able to alter privileges and bestow storage deposit credits
 * - **Delegator**: Service able to set staging set (validator keys)
 * - **Registrar**: Service able to create new service accounts in protected range (v0.7.1+)
 * - **Assigners**: Services capable of altering authorizer queue (one per core)
 * - **Always Accers**: Services that automatically accumulate with basic gas
 *
 * @param privileges - Privileges state to encode
 * @param configService - Configuration service for core count
 * @param jamVersion - Optional JAM version. Defaults to v0.7.1+ behavior
 * @returns Encoded octet sequence
 */
export function encodePrivileges(
  privileges: Privileges,
  configService: IConfigService,
  jamVersion?: JamVersion,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Determine version: default to latest (v0.7.2) with registrar
  // Versions <= 0.7.0: manager, assigners, delegator, alwaysaccers (no registrar)
  // Versions >= 0.7.1: manager, delegator, registrar, assigners, alwaysaccers
  const version = jamVersion ?? DEFAULT_JAM_VERSION
  // Check if version is <= 0.7.0 (old format without registrar)
  // Versions >= 0.7.1 (including 0.7.2, 0.8.0, etc.) use the new format with registrar
  const isV070OrEarlier =
    version.major < 0 ||
    (version.major === 0 && version.minor < 7) ||
    (version.major === 0 && version.minor === 7 && version.patch <= 0)

  // Manager (4 bytes) - always first
  const [managerError, managerBytes] = encodeFixedLength(privileges.manager, 4n)
  if (managerError) return safeError(managerError)
  parts.push(managerBytes)

  if (isV070OrEarlier) {
    // v0.7.0 encoding: manager, assigners, delegator, alwaysaccers
    // Assigners: sequence[Ccorecount]{encode[4]{serviceid}} - fixed-length sequence, no length prefix
    const coreCount = configService.numCores
    const paddedAssigners = Array.from(privileges.assigners)
    // Pad to Ccorecount if needed
    while (paddedAssigners.length < coreCount) {
      paddedAssigners.push(0n)
    }
    // Truncate to Ccorecount if needed
    const assignersToEncode = paddedAssigners.slice(0, coreCount)
    const [assignersError, assignersBytes] = encodeSequenceGeneric(
      assignersToEncode,
      (serviceId) => encodeFixedLength(serviceId, 4n),
    )
    if (assignersError) return safeError(assignersError)
    parts.push(assignersBytes)

    // Delegator (4 bytes)
    const [delegatorError, delegatorBytes] = encodeFixedLength(
      privileges.delegator,
      4n,
    )
    if (delegatorError) return safeError(delegatorError)
    parts.push(delegatorBytes)
  } else {
    // v0.7.1+ encoding: manager, delegator, registrar, assigners, alwaysaccers
    // Delegator (4 bytes)
    const [delegatorError, delegatorBytes] = encodeFixedLength(
      privileges.delegator,
      4n,
    )
    if (delegatorError) return safeError(delegatorError)
    parts.push(delegatorBytes)

    // Registrar (4 bytes)
    const [registrarError, registrarBytes] = encodeFixedLength(
      privileges.registrar,
      4n,
    )
    if (registrarError) return safeError(registrarError)
    parts.push(registrarBytes)

    // Assigners: sequence[Ccorecount]{encode[4]{serviceid}} - fixed-length sequence, no length prefix
    const coreCount = configService.numCores
    const paddedAssigners = Array.from(privileges.assigners)
    // Pad to Ccorecount if needed
    while (paddedAssigners.length < coreCount) {
      paddedAssigners.push(0n)
    }
    // Truncate to Ccorecount if needed
    const assignersToEncode = paddedAssigners.slice(0, coreCount)
    const [assignersError, assignersBytes] = encodeSequenceGeneric(
      assignersToEncode,
      (serviceId) => encodeFixedLength(serviceId, 4n),
    )
    if (assignersError) return safeError(assignersError)
    parts.push(assignersBytes)
  }

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
 * Supports both v0.7.0 and v0.7.1+ formats:
 *
 * **v0.7.0** (Gray Paper v0.7.0):
 * - Structure: manager, assigners, delegator, alwaysaccers (no registrar)
 * - Registrar is set to 0 when decoding v0.7.0 format
 *
 * **v0.7.1+** (Gray Paper v0.7.1+):
 * - Structure: manager, delegator, registrar, assigners, alwaysaccers
 *
 * Each field is decoded according to its Gray Paper specification:
 * - manager, delegator, registrar: 4-byte service IDs
 * - assigners: Fixed-length sequence of service IDs (one per core)
 * - alwaysaccers: Variable-length dictionary of service ID to gas mappings
 *
 * @param data - Octet sequence to decode
 * @param configService - Configuration service for core count
 * @param jamVersion - Optional JAM version. Defaults to v0.7.1+ behavior
 * @returns Decoded privileges state and remaining data
 */
export function decodePrivileges(
  data: Uint8Array,
  configService: IConfigService,
  jamVersion?: JamVersion,
): Safe<DecodingResult<Privileges>> {
  let currentData = data

  // Determine version: default to latest (v0.7.2) with registrar
  // Versions <= 0.7.0: manager, assigners, delegator, alwaysaccers (no registrar)
  // Versions >= 0.7.1: manager, delegator, registrar, assigners, alwaysaccers
  const version = jamVersion ?? DEFAULT_JAM_VERSION
  // Check if version is <= 0.7.0 (old format without registrar)
  // Versions >= 0.7.1 (including 0.7.2, 0.8.0, etc.) use the new format with registrar
  const isV070OrEarlier =
    version.major < 0 ||
    (version.major === 0 && version.minor < 7) ||
    (version.major === 0 && version.minor === 7 && version.patch <= 0)

  // Decode manager (4 bytes) - always first
  if (currentData.length < 4) {
    return safeError(new Error('Insufficient data for manager'))
  }
  const [managerError, managerResult] = decodeFixedLength(
    currentData.slice(0, 4),
    4n,
  )
  if (managerError) return safeError(managerError)
  const manager = managerResult.value
  currentData = currentData.slice(4)

  const assigners: bigint[] = []
  let delegator: bigint
  let registrar: bigint

  if (isV070OrEarlier) {
    // v0.7.0 decoding: manager, assigners, delegator, alwaysaccers
    // Decode assigners: sequence[Ccorecount]{encode[4]{serviceid}} - fixed-length sequence, no length prefix
    // Gray Paper: assigners ∈ sequence[Ccorecount]{serviceid}
    // This is ALWAYS exactly Ccorecount elements (one per core), not variable
    const coreCount = configService.numCores
    for (let i = 0; i < coreCount; i++) {
      if (currentData.length < 4) {
        return safeError(
          new Error(
            `Insufficient data for assigner service ID at index ${i} (expected ${coreCount} total, got ${currentData.length} bytes remaining)`,
          ),
        )
      }
      const [error, result] = decodeFixedLength(currentData.slice(0, 4), 4n)
      if (error) return safeError(error)
      assigners.push(result.value)
      currentData = currentData.slice(4)
    }

    // Decode delegator (4 bytes)
    if (currentData.length < 4) {
      return safeError(new Error('Insufficient data for delegator'))
    }
    const [delegatorError, delegatorResult] = decodeFixedLength(
      currentData.slice(0, 4),
      4n,
    )
    if (delegatorError) return safeError(delegatorError)
    delegator = delegatorResult.value
    currentData = currentData.slice(4)

    // v0.7.0 has no registrar - set to 0
    registrar = 0n
  } else {
    // v0.7.1+ decoding: manager, delegator, registrar, assigners, alwaysaccers
    // Decode delegator (4 bytes)
    if (currentData.length < 4) {
      return safeError(new Error('Insufficient data for delegator'))
    }
    const [delegatorError, delegatorResult] = decodeFixedLength(
      currentData.slice(0, 4),
      4n,
    )
    if (delegatorError) return safeError(delegatorError)
    delegator = delegatorResult.value
    currentData = currentData.slice(4)

    // Decode registrar (4 bytes)
    if (currentData.length < 4) {
      return safeError(new Error('Insufficient data for registrar'))
    }
    const [registrarError, registrarResult] = decodeFixedLength(
      currentData.slice(0, 4),
      4n,
    )
    if (registrarError) return safeError(registrarError)
    registrar = registrarResult.value
    currentData = currentData.slice(4)

    // Decode assigners: sequence[Ccorecount]{encode[4]{serviceid}} - fixed-length sequence, no length prefix
    // Gray Paper: assigners ∈ sequence[Ccorecount]{serviceid}
    // This is ALWAYS exactly Ccorecount elements (one per core), not variable
    const coreCount = configService.numCores
    for (let i = 0; i < coreCount; i++) {
      if (currentData.length < 4) {
        return safeError(
          new Error(
            `Insufficient data for assigner service ID at index ${i} (expected ${coreCount} total, got ${currentData.length} bytes remaining)`,
          ),
        )
      }
      const [error, result] = decodeFixedLength(currentData.slice(0, 4), 4n)
      if (error) return safeError(error)
      assigners.push(result.value)
      currentData = currentData.slice(4)
    }
  }

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
      assigners,
      alwaysaccers: alwaysAccers,
    },
    remaining: currentData,
    consumed,
  })
}
