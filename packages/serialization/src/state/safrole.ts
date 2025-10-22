/**
 * Safrole Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Chapter 12 - Safrole Consensus Protocol
 * Formula (C(4)):
 *
 * C(4) ↦ encode{
 *   pendingset, epochroot,
 *   discriminator{0 when sealtickets ∈ sequence[C_epochlen]{safroleticket}, 1 when sealtickets ∈ sequence[C_epochlen]{bskey}},
 *   sealtickets, var{ticketaccumulator}
 * }
 *
 * Field order per Gray Paper (Section 12.2.1):
 * 1. pendingset - validator keys for next epoch (encoded as ValidatorPublicKeys sequence)
 * 2. epochroot - Bandersnatch ring root (32-byte hash)
 * 3. discriminator - 0 for tickets, 1 for Bandersnatch keys (natural encoding)
 * 4. sealtickets - current epoch's slot-sealer sequence (C_epochlen items)
 * 5. var{ticketaccumulator} - variable-length sequence of highest-scoring tickets
 *
 * Safrole Ticket Encoding (Gray Paper Equation 266):
 * encode{ST ∈ safroleticket} ≡ encode{ST_id, ST_entryindex}
 * - ST_id: hash (32 bytes) - ticket identifier
 * - ST_entryindex: natural number - entry index in ticket entries
 *
 * Note: For state serialization, we only encode id and entryIndex per Gray Paper.
 * The proof field is not part of the state ticket structure.
 *
 * ✅ CORRECT: Encodes pendingset as ValidatorPublicKeys sequence
 * ✅ CORRECT: Discriminator logic for sealtickets type
 * ✅ CORRECT: Fixed-length sealtickets sequence (C_epochlen)
 * ✅ CORRECT: Variable-length ticketaccumulator with proper encoding
 */

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import { isSafroleTicket } from '@pbnj/safrole'
import type {
  DecodingResult,
  IConfigService,
  SafroleState,
  SafroleTicketWithoutProof,
  ValidatorPublicKeys,
} from '@pbnj/types'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeVariableSequence, encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode Gray Paper compliant safrole ticket for state serialization.
 *
 * Gray Paper Equation 266: encode{ST ∈ safroleticket} ≡ encode{ST_id, ST_entryindex}
 * - ST_id: hash (32 bytes) - ticket identifier
 * - ST_entryindex: natural number - entry index in ticket entries
 *
 * Note: For state serialization, we only encode id and entryIndex per Gray Paper.
 * The proof field is not part of the state ticket structure.
 *
 * ✅ CORRECT: Matches Gray Paper specification exactly
 */
function encodeStateTicket(
  ticket: SafroleTicketWithoutProof,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // ST_id - ticket identifier (32-byte hash)
  parts.push(hexToBytes(ticket.id))

  // ST_entryindex - entry index (natural encoding)
  const [error, encoded] = encodeNatural(ticket.entryIndex)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode Gray Paper compliant safrole ticket for state serialization.
 *
 * Gray Paper Equation 266: decode{ST ∈ safroleticket} ≡ decode{ST_id, ST_entryindex}
 * - ST_id: hash (32 bytes) - ticket identifier
 * - ST_entryindex: natural number - entry index in ticket entries
 *
 * Note: For state serialization, we only decode id and entryIndex per Gray Paper.
 * The proof field is reconstructed from the extrinsic when needed.
 *
 * ✅ CORRECT: Matches Gray Paper specification exactly
 */
function decodeStateTicket(
  data: Uint8Array,
): Safe<DecodingResult<SafroleTicketWithoutProof>> {
  let currentData = data

  // Decode ST_id - ticket identifier (32-byte hash)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for ticket ID'))
  }
  const idBytes = currentData.slice(0, 32)
  const id = bytesToHex(idBytes)
  currentData = currentData.slice(32)

  // Decode ST_entryindex - entry index (natural encoding)
  const [error, entryIndexResult] = decodeNatural(currentData)
  if (error) {
    return safeError(error)
  }
  currentData = entryIndexResult.remaining

  return safeResult({
    value: {
      id,
      entryIndex: entryIndexResult.value,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encode validator public keys according to Gray Paper.
 *
 * Gray Paper: valkey ≡ blob[336]
 * Each validator key is 336 bytes: (k_bs, k_ed, k_bls, k_metadata)
 * - k_bs: Bandersnatch key (32 bytes)
 * - k_ed: Ed25519 key (32 bytes)
 * - k_bls: BLS key (144 bytes)
 * - k_metadata: metadata (128 bytes)
 */
export function encodeValidatorPublicKeys(
  validator: ValidatorPublicKeys,
): Uint8Array {
  const validatorBytes = new Uint8Array(336)
  let offset = 0

  // k_bs: Bandersnatch key (32 bytes)
  const bsBytes = hexToBytes(validator.bandersnatch)
  validatorBytes.set(bsBytes, offset)
  offset += 32

  // k_ed: Ed25519 key (32 bytes)
  const edBytes = hexToBytes(validator.ed25519)
  validatorBytes.set(edBytes, offset)
  offset += 32

  // k_bls: BLS key (144 bytes)
  const blsBytes = hexToBytes(validator.bls)
  validatorBytes.set(blsBytes, offset)
  offset += 144

  // k_metadata: metadata (128 bytes)
  const metadataBytes = hexToBytes(validator.metadata)
  validatorBytes.set(metadataBytes, offset)

  return validatorBytes
}

/**
 * Decode validator public keys according to Gray Paper.
 *
 * Gray Paper: valkey ≡ blob[336]
 * Each validator key is 336 bytes: (k_bs, k_ed, k_bls, k_metadata)
 * - k_bs: Bandersnatch key (32 bytes)
 * - k_ed: Ed25519 key (32 bytes)
 * - k_bls: BLS key (144 bytes)
 * - k_metadata: metadata (128 bytes)
 */
export function decodeValidatorPublicKeys(
  data: Uint8Array,
): Safe<DecodingResult<ValidatorPublicKeys>> {
  if (data.length < 336) {
    return safeError(new Error('Insufficient data for validator key'))
  }

  let offset = 0

  // k_bs: Bandersnatch key (32 bytes)
  const bsBytes = data.slice(offset, offset + 32)
  const bandersnatch = bytesToHex(bsBytes)
  offset += 32

  // k_ed: Ed25519 key (32 bytes)
  const edBytes = data.slice(offset, offset + 32)
  const ed25519 = bytesToHex(edBytes)
  offset += 32

  // k_bls: BLS key (144 bytes)
  const blsBytes = data.slice(offset, offset + 144)
  const bls = bytesToHex(blsBytes)
  offset += 144

  // k_metadata: metadata (128 bytes)
  const metadataBytes = data.slice(offset, offset + 128)
  const metadata = bytesToHex(metadataBytes)

  return safeResult({
    value: {
      bandersnatch,
      ed25519,
      bls,
      metadata,
    },
    remaining: data.slice(336),
    consumed: 336,
  })
}

/**
 * Encode safrole state according to Gray Paper C(4):
 * C(4) ↦ encode{
 *   pendingset, epochroot,
 *   discriminator{0 when sealtickets ∈ sequence[C_epochlen]{safroleticket}, 1 when sealtickets ∈ sequence[C_epochlen]{bskey}},
 *   sealtickets, var{ticketaccumulator}
 * }
 */
export function encodeSafrole(safrole: SafroleState): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 1. pendingset - encode as ValidatorPublicKeys sequence (not tickets)
  const [pendingError, pendingEncoded] = encodeSequenceGeneric(
    safrole.pendingSet,
    (validator) => safeResult(encodeValidatorPublicKeys(validator)),
  )
  if (pendingError) {
    return safeError(pendingError)
  }
  parts.push(pendingEncoded)

  // 2. epochroot - 32-byte Bandersnatch ring root
  parts.push(hexToBytes(safrole.epochRoot))

  // 3. discriminator - 0 for tickets, 1 for Bandersnatch keys
  const hasTickets = safrole.sealTickets.every((ticket) =>
    isSafroleTicket(ticket),
  )
  const discriminator = hasTickets ? 0n : 1n
  const [discError, discEncoded] = encodeNatural(discriminator)
  if (discError) {
    return safeError(discError)
  }
  parts.push(discEncoded)

  // 4. sealtickets - fixed-length sequence (C_epochlen = 600)
  if (hasTickets) {
    // Encode as safrole tickets
    const ticketParts: Uint8Array[] = []
    for (const item of safrole.sealTickets) {
      const ticket = item as SafroleTicketWithoutProof // Type assertion since it's a union type
      const [error, encoded] = encodeStateTicket(ticket)
      if (error) {
        return safeError(error)
      }
      ticketParts.push(encoded)
    }
    parts.push(concatBytes(ticketParts))
  } else {
    // Encode as Bandersnatch keys (fallback mode)
    const keyParts: Uint8Array[] = []
    for (const item of safrole.sealTickets) {
      const validatorKey = item as Uint8Array
      // In fallback mode, use the Bandersnatch key from ValidatorPublicKeys
      if (validatorKey) {
        keyParts.push(validatorKey)
      } else {
        return safeError(new Error('Missing Bandersnatch key in fallback mode'))
      }
    }
    parts.push(concatBytes(keyParts))
  }

  // 5. var{ticketaccumulator} - variable-length sequence with length prefix
  const accumTickets: Uint8Array[] = []
  for (const ticket of safrole.ticketAccumulator) {
    const [error, encoded] = encodeStateTicket(ticket)
    if (error) {
      return safeError(error)
    }
    accumTickets.push(encoded)
  }
  const [accumError, accumEncoded] = encodeSequenceGeneric(
    accumTickets,
    (bytes: Uint8Array) => safeResult(bytes),
  )
  if (accumError) {
    return safeError(accumError)
  }
  parts.push(accumEncoded)

  return safeResult(concatBytes(parts))
}

/**
 * Decode safrole state according to Gray Paper C(4):
 * C(4) ↦ encode{
 *   pendingset, epochroot,
 *   discriminator{0 when sealtickets ∈ sequence[C_epochlen]{safroleticket}, 1 when sealtickets ∈ sequence[C_epochlen]{bskey}},
 *   sealtickets, var{ticketaccumulator}
 * }
 */
export function decodeSafrole(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<SafroleState>> {
  let currentData = data

  // 1. Decode pendingset - ValidatorPublicKeys sequence
  const [pendingError, pendingResult] = decodeVariableSequence(
    currentData,
    (data) => decodeValidatorPublicKeys(data),
  )
  if (pendingError) {
    return safeError(pendingError)
  }
  currentData = pendingResult.remaining
  const pendingSet = pendingResult.value

  // 2. Decode epochroot - 32-byte Bandersnatch ring root
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for epoch root'))
  }
  const epochRootBytes = currentData.slice(0, 32)
  const epochRoot = bytesToHex(epochRootBytes)
  currentData = currentData.slice(32)

  // 3. Decode discriminator - 0 for tickets, 1 for Bandersnatch keys
  const [discError, discResult] = decodeNatural(currentData)
  if (discError) {
    return safeError(discError)
  }
  currentData = discResult.remaining
  const discriminator = discResult.value

  // 4. Decode sealtickets - fixed-length sequence (C_epochlen = 600)
  const sealTickets: (SafroleTicketWithoutProof | Uint8Array)[] = []

  if (discriminator === 0n) {
    // Decode as safrole tickets
    for (let i = 0; i < configService.epochDuration; i++) {
      const [ticketError, ticketResult] = decodeStateTicket(currentData)
      if (ticketError) {
        return safeError(ticketError)
      }
      currentData = ticketResult.remaining
      sealTickets.push(ticketResult.value)
    }
  } else {
    // Decode as Bandersnatch keys (fallback mode)
    for (let i = 0; i < configService.epochDuration; i++) {
      if (currentData.length < 32) {
        return safeError(new Error('Insufficient data for Bandersnatch key'))
      }
      const keyBytes = currentData.slice(0, 32)
      currentData = currentData.slice(32)
      sealTickets.push(keyBytes)
    }
  }

  // 5. Decode var{ticketaccumulator} - variable-length sequence with length prefix
  const [accumError, accumResult] = decodeVariableSequence(
    currentData,
    (data) => decodeStateTicket(data),
  )
  if (accumError) {
    return safeError(accumError)
  }
  currentData = accumResult.remaining
  const ticketAccumulator = accumResult.value

  return safeResult({
    value: {
      pendingSet,
      epochRoot,
      sealTickets: sealTickets,
      ticketAccumulator,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}
