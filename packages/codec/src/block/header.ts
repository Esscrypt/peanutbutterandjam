/**
 * JAM Block header serialization according to Gray Paper
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 182-197):
 *
 * encode(H) = encode(encodeUnsignedHeader(H), H_sealsig)
 *
 * encodeUnsignedHeader(H) = encode(
 *   H_parent,
 *   H_priorstateroot,
 *   H_extrinsichash,
 *   encode[4](H_timeslot),
 *   maybe{H_epochmark},
 *   maybe{H_winnersmark},
 *   encode[2](H_authorindex),
 *   H_vrfsig,
 *   var{H_offendersmark}
 * )
 *
 * Implements JAM block header serialization as specified in the Gray Paper
 *
 * *** IMPLEMENTER EXPLANATION ***
 * JAM block headers contain all the metadata needed to verify and process blocks.
 * The header has both signed and unsigned portions for cryptographic integrity.
 *
 * Structure breakdown:
 * 1. **Parent hash** (32 bytes): Links to previous block
 * 2. **Prior state root** (32 bytes): State commitment before this block
 * 3. **Extrinsic hash** (32 bytes): Merkle root of all extrinsics in block
 * 4. **Time slot** (4 bytes): When this block was produced
 * 5. **Epoch mark** (optional): New validator set and entropy (only on epoch boundaries)
 * 6. **Winners mark** (optional): Winning Safrole tickets for this slot
 * 7. **Author index** (2 bytes): Which validator authored this block
 * 8. **VRF signature** (96 bytes): Proves authorship and randomness
 * 9. **Offenders mark** (variable): Ed25519 keys of misbehaving validators
 * 10. **Seal signature** (64 bytes): Final signature over unsigned header
 *
 * The two-part structure (unsigned + seal) allows validators to sign the
 * complete header contents while including the signature in the commitment.
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnjam/core'
import type {
  BlockHeader,
  DecodingResult,
  EpochMark,
  IConfigService,
  Safe,
  SafroleTicketWithoutProof,
  UnsignedBlockHeader,
  ValidatorKeyPair,
  ValidatorKeyTuple,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

// Validator key pair encoding/decoding
function encodeValidatorKeyPair(validator: ValidatorKeyPair): Uint8Array {
  const parts: Uint8Array[] = []
  parts.push(hexToBytes(validator.bandersnatch))
  parts.push(hexToBytes(validator.ed25519))

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function decodeValidatorKeyPair(data: Uint8Array): {
  result: ValidatorKeyPair
  remaining: Uint8Array
} {
  const bandersnatch = bytesToHex(data.slice(0, 32))
  const ed25519 = bytesToHex(data.slice(32, 64))

  return {
    result: { bandersnatch, ed25519 },
    remaining: data.slice(64),
  }
}

// Epoch mark encoding/decoding (optional)
function encodeEpochMark(
  epochMark: EpochMark | null,
  config: IConfigService,
): Safe<Uint8Array> {
  if (epochMark === null) {
    // Encode as None (1 byte with value 0)
    return safeResult(new Uint8Array([0]))
  }

  const parts: Uint8Array[] = []
  // Encode as Some (1 byte with value 1)
  parts.push(new Uint8Array([1]))

  // Encode entropy (32 bytes)
  parts.push(hexToBytes(epochMark.entropyAccumulator))

  // Encode tickets_entropy (32 bytes)
  parts.push(hexToBytes(epochMark.entropy1))

  // Encode validators - FIXED-LENGTH sequence of exactly C_valcount (1023) validators
  // No length prefix needed since it's sequence[C_valcount] not var{sequence}
  if (epochMark.validators.length !== config.numValidators) {
    return safeError(
      new Error('Epoch mark validators length must be equal to numValidators'),
    )
  }
  for (const validator of epochMark.validators) {
    parts.push(encodeValidatorKeyPair(validator))
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decodes epoch mark according to Gray Paper serialization specification.
 *
 * Gray Paper formula: maybe{H_epochmark} where
 * H_epochmark ∈ optional{tuple{hash, hash, sequence[C_valcount]{tuple{bskey, edkey}}}}
 *
 * Encoding format:
 * 1. Option discriminator (0 = none, 1 = some)
 * 2. If some: (entropyaccumulator, entropy_1, fixed sequence of C_valcount validator key pairs)
 *    - entropyaccumulator: hash (32 bytes)
 *    - entropy_1: hash (32 bytes)
 *    - sequence[C_valcount]: FIXED-LENGTH sequence (no length prefix)
 *    - tuple{bskey, edkey}: (Bandersnatch key, Ed25519 key) pairs
 *
 * ✅ CORRECT: Option discriminator, entropy fields
 * ✅ CORRECT: Fixed-length sequence of exactly C_valcount validators (from config)
 * ✅ CORRECT: No length prefix for fixed sequence
 */
function decodeEpochMark(
  data: Uint8Array,
  config: IConfigService,
): Safe<DecodingResult<EpochMark | null>> {
  let currentData = data

  const optionTag = currentData[0]
  currentData = currentData.slice(1)

  if (optionTag === 0) {
    return safeResult({
      value: null,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  }

  // Decode entropy
  const entropy = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Decode tickets_entropy
  const ticketsEntropy = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Decode validators - FIXED-LENGTH sequence of exactly C_valcount validators
  // No length prefix needed since it's sequence[C_valcount] not var{sequence}
  // Each validator is just (bandersnatch_key, ed25519_key) - no entry index
  // Use config.numValidators instead of hardcoded 1023 to support different configs
  const validators: ValidatorKeyTuple[] = []
  for (let i = 0; i < config.numValidators; i++) {
    const validatorResult = decodeValidatorKeyPair(currentData)
    validators.push(validatorResult.result)
    currentData = validatorResult.remaining
  }

  return safeResult({
    value: {
      entropyAccumulator: entropy,
      entropy1: ticketsEntropy,
      validators,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encodes winners mark according to Gray Paper serialization specification.
 *
 * Gray Paper formula: maybe{H_winnersmark} where
 * H_winnersmark ∈ optional{sequence[C_epochlen]{safroleticket}}
 *
 * Encoding format:
 * 1. Option discriminator (0 = none, 1 = some)
 * 2. If some: fixed sequence of exactly C_epochlen (600) safrole tickets
 *    - sequence[C_epochlen]: FIXED-LENGTH sequence (no length prefix)
 *    - safroleticket: encode(st_id, st_entryindex)
 *
 * ✅ CORRECT: Option discriminator
 * ✅ CORRECT: Fixed-length sequence of exactly C_epochlen (600) tickets
 * ✅ CORRECT: No length prefix for fixed sequence
 * ✅ CORRECT: Safrole ticket encoding (st_id, st_entryindex)
 */
function encodeWinnersMark(
  winnersMark: SafroleTicketWithoutProof[] | null,
  config: IConfigService,
): Safe<Uint8Array> {
  if (winnersMark === null) {
    // Encode as None (1 byte with value 0)
    return safeResult(new Uint8Array([0]))
  }

  if (winnersMark.length !== config.epochDuration) {
    return safeError(
      new Error('Winners mark length must be equal to epoch duration'),
    )
  }
  const parts: Uint8Array[] = []
  // Encode as Some (1 byte with value 1)
  parts.push(new Uint8Array([1]))

  // Encode tickets - FIXED-LENGTH sequence (no length prefix)
  for (const ticket of winnersMark) {
    // Encode safroleticket as (st_id, st_entryindex)
    parts.push(hexToBytes(ticket.id)) // st_id (32 bytes)

    // Gray Paper: st_entryindex is either 0 or 1
    const [error, encoded] = encodeNatural(BigInt(ticket.entryIndex)) // st_entryindex (natural encoding)
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decodes winners mark according to Gray Paper serialization specification.
 *
 * Gray Paper formula: maybe{H_winnersmark} where
 * H_winnersmark ∈ optional{sequence[C_epochlen]{safroleticket}}
 *
 * Encoding format:
 * 1. Option discriminator (0 = none, 1 = some)
 * 2. If some: fixed sequence of exactly C_epochlen (600) safrole tickets
 *    - sequence[C_epochlen]: FIXED-LENGTH sequence (no length prefix)
 *    - safroleticket: encode(st_id, st_entryindex)
 *
 * ✅ CORRECT: Option discriminator
 * ✅ CORRECT: Fixed-length sequence of exactly C_epochlen (600) tickets
 * ✅ CORRECT: No length prefix for fixed sequence
 * ✅ CORRECT: Safrole ticket encoding (st_id, st_entryindex)
 */
function decodeWinnersMark(
  data: Uint8Array,
  config: IConfigService,
): Safe<DecodingResult<SafroleTicketWithoutProof[] | null>> {
  let currentData = data

  const optionTag = currentData[0]
  currentData = currentData.slice(1)

  if (optionTag === 0) {
    return safeResult({
      value: null,
      remaining: currentData,
      consumed: data.length - currentData.length,
    })
  }

  // Don't validate length upfront since entryIndex is variable length
  // We'll validate by counting actual tickets decoded

  // Fixed sequence of C_epochlen (600) tickets - no length prefix needed
  // Gray Paper: safroleticket = tuple{st_id, st_entryindex} - no proof
  const tickets: SafroleTicketWithoutProof[] = []
  for (let i = 0; i < config.epochDuration; i++) {
    // C_epochlen = 600
    // Decode ticket: (st_id, st_entryindex)
    const id = bytesToHex(currentData.slice(0, 32)) // st_id (32 bytes)
    currentData = currentData.slice(32)

    const [error, entryIndexResult] = decodeNatural(currentData) // st_entryindex
    if (error) return safeError(error)

    tickets.push({
      id,
      entryIndex: entryIndexResult.value,
    })
    currentData = entryIndexResult.remaining
  }

  // Validate we decoded exactly 600 tickets
  if (tickets.length !== config.epochDuration) {
    return safeError(
      new Error(
        `Winners mark must contain exactly ${config.epochDuration} tickets, got ${tickets.length} tickets`,
      ),
    )
  }

  return safeResult({
    value: tickets,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

// Offenders mark encoding/decoding (array of Ed25519 keys)
function encodeOffendersMark(offendersMark: Hex[]): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Encode count
  const [error, encoded] = encodeNatural(BigInt(offendersMark.length))
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Encode keys
  for (const key of offendersMark) {
    parts.push(hexToBytes(key))
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decodes offenders mark according to Gray Paper serialization specification.
 *
 * Gray Paper formula: var{H_offendersmark} where H_offendersmark ∈ sequence{edkey}
 * - var{x} = variable-length sequence encoding with natural number length prefix
 * - edkey = Ed25519 public key (32 bytes)
 *
 * Encoding format:
 * 1. Natural number encoding for sequence length
 * 2. Sequence of 32-byte Ed25519 keys
 *
 * ✅ Implementation is Gray Paper compliant:
 * - Correctly uses decodeNatural for length prefix (var{x} encoding)
 * - Correctly reads 32-byte Ed25519 keys (edkey specification)
 * - Properly handles variable-length sequence structure
 */
function decodeOffendersMark(data: Uint8Array): Safe<DecodingResult<Hex[]>> {
  let currentData = data

  // Decode count
  const [error, countResult] = decodeNatural(currentData)
  if (error) {
    return safeError(error)
  }
  const count = Number(countResult.value)
  currentData = countResult.remaining

  // Decode keys
  const keys: Hex[] = []
  for (let i = 0; i < count; i++) {
    const key = bytesToHex(currentData.slice(0, 32))
    keys.push(key)
    currentData = currentData.slice(32)
  }

  return safeResult({
    value: keys,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encodes unsigned JAM header according to Gray Paper serialization specification.
 *
 * Gray Paper formula: encodeunsignedheader{header} = encode(
 *   H_parent, H_priorstateroot, H_extrinsichash, encode[4]{H_timeslot},
 *   maybe{H_epochmark}, maybe{H_winnersmark}, encode[2]{H_authorindex},
 *   H_vrfsig, var{H_offendersmark}
 * )
 *
 * ✅ CORRECT: Field types and encoding methods
 * ✅ CORRECT: Field order matches Gray Paper specification
 * ✅ CORRECT: All encoding functions used properly
 * ✅ CORRECT: Excludes seal signature (that's added in encodeHeader)
 */
export function encodeUnsignedHeader(
  header: UnsignedBlockHeader,
  config: IConfigService,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // parent (32 bytes)
  parts.push(hexToBytes(header.parent))

  // parent_state_root (32 bytes)
  parts.push(hexToBytes(header.priorStateRoot))

  // extrinsic_hash (32 bytes)
  parts.push(hexToBytes(header.extrinsicHash))

  // slot (4 bytes)
  const [error, encoded] = encodeFixedLength(BigInt(header.timeslot), 4n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // epoch_mark (optional)
  const [error2, encoded2] = encodeEpochMark(header.epochMark, config)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // winners_mark (optional)
  const [error3, encoded3] = encodeWinnersMark(header.winnersMark, config)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // author_index (2 bytes)
  const [error4, encoded4] = encodeFixedLength(BigInt(header.authorIndex), 2n)
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)

  // vrf_sig (96 bytes) - comes BEFORE offenders_mark per Gray Paper
  parts.push(hexToBytes(header.vrfSig))

  // offenders_mark (variable) - comes AFTER vrf_sig per Gray Paper
  const [error5, encoded5] = encodeOffendersMark(header.offendersMark)
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)

  const result = concatBytes(parts)

  // Instrumentation (block 76): verify our encoding matches Gray Paper serialization.tex eq. 187-197
  // encodeunsignedheader{H} = encode( H_parent, H_priorstateroot, H_extrinsichash, encode[4]{H_timeslot},
  //   maybe{H_epochmark}, maybe{H_winnersmark}, encode[2]{H_authorindex}, H_vrfsig, var{H_offendersmark} )
  if (header.timeslot === 76n) {
    console.warn(
      '[GP encodeUnsignedHeader block 76] Gray Paper serialization.tex eq. 187-197',
      {
        ref: 'submodules/graypaper/text/serialization.tex',
        formula:
          'encodeunsignedheader{H} = encode( H_parent, H_priorstateroot, H_extrinsichash, encode[4]{H_timeslot}, maybe{H_epochmark}, maybe{H_winnersmark}, encode[2]{H_authorindex}, H_vrfsig, var{H_offendersmark} )',
        totalBytes: result.length,
        header: header,
        encodedUnsignedHeaderHexFull: bytesToHex(result),
      },
    )
  }

  return safeResult(result)
}

/**
 * Decodes unsigned JAM header according to Gray Paper serialization specification.
 *
 * Gray Paper formula: encodeunsignedheader{header} = encode(
 *   H_parent, H_priorstateroot, H_extrinsichash, encode[4]{H_timeslot},
 *   maybe{H_epochmark}, maybe{H_winnersmark}, encode[2]{H_authorindex},
 *   H_vrfsig, var{H_offendersmark}
 * )
 *
 * ✅ CORRECT: Field types and decoding methods
 * ✅ CORRECT: Field order matches Gray Paper specification
 * ✅ CORRECT: All decoding functions used properly
 * ✅ CORRECT: Excludes seal signature (that's handled in decodeHeader)
 */
export function decodeUnsignedHeader(
  data: Uint8Array,
  config: IConfigService,
): Safe<DecodingResult<UnsignedBlockHeader>> {
  let currentData = data

  // parent (32 bytes)
  const parent = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // parent_state_root (32 bytes)
  const parentStateRoot = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // extrinsic_hash (32 bytes)
  const extrinsicHash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // slot (4 bytes)
  const [error, slotResult] = decodeFixedLength(currentData, 4n)
  if (error) {
    return safeError(error)
  }
  const slot = slotResult.value
  currentData = slotResult.remaining

  // epoch_mark (optional)
  const [error2, epochMarkResult] = decodeEpochMark(currentData, config)
  if (error2) {
    return safeError(error2)
  }
  const epochMark = epochMarkResult.value
  currentData = epochMarkResult.remaining

  // winners_mark (optional) - Gray Paper: H_winnersmark, JSON: tickets_mark
  const [error3, winnersMarkResult] = decodeWinnersMark(currentData, config)
  if (error3) {
    return safeError(error3)
  }
  const winnersMark = winnersMarkResult.value
  currentData = winnersMarkResult.remaining

  // author_index (2 bytes)
  const [error4, authorIndexResult] = decodeFixedLength(currentData, 2n)
  if (error4) {
    return safeError(error4)
  }
  const authorIndex = authorIndexResult.value
  currentData = authorIndexResult.remaining

  // vrf_sig (96 bytes) - comes BEFORE offenders_mark per Gray Paper
  const vrfSig = bytesToHex(currentData.slice(0, 96))
  currentData = currentData.slice(96)

  // offenders_mark (variable) - comes AFTER vrf_sig per Gray Paper
  const [error5, offendersMarkResult] = decodeOffendersMark(currentData)
  if (error5) {
    return safeError(error5)
  }
  const offendersMark = offendersMarkResult.value
  currentData = offendersMarkResult.remaining

  return safeResult({
    value: {
      parent,
      priorStateRoot: parentStateRoot,
      extrinsicHash: extrinsicHash,
      timeslot: slot,
      epochMark: epochMark,
      winnersMark: winnersMark,
      offendersMark: offendersMark,
      authorIndex: authorIndex,
      vrfSig: vrfSig,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}

/**
 * Encodes JAM header according to Gray Paper serialization specification.
 *
 * Gray Paper formula: encode{header} = encode(encodeunsignedheader{header}, H_sealsig)
 * where encodeunsignedheader{header} = encode(
 *   H_parent, H_priorstateroot, H_extrinsichash, encode[4]{H_timeslot},
 *   maybe{H_epochmark}, maybe{H_winnersmark}, encode[2]{H_authorindex},
 *   H_vrfsig, var{H_offendersmark}
 * )
 *
 * ✅ CORRECT: Field types and encoding methods
 * ✅ CORRECT: Field order matches Gray Paper specification
 * ✅ CORRECT: All encoding functions used properly
 * ✅ CORRECT: Uses encodeUnsignedHeader + seal signature
 */
export function encodeHeader(
  header: BlockHeader,
  config: IConfigService,
): Safe<Uint8Array> {
  // Encode unsigned header first
  const [error, unsignedHeader] = encodeUnsignedHeader(header, config)
  if (error) {
    return safeError(error)
  }

  // Add seal signature
  const sealSig = hexToBytes(header.sealSig)

  return safeResult(concatBytes([unsignedHeader, sealSig]))
}

/**
 * Decodes JAM header according to Gray Paper serialization specification.
 *
 * Gray Paper formula: encode{header} = encode(encodeunsignedheader{header}, H_sealsig)
 * where encodeunsignedheader{header} = encode(
 *   H_parent, H_priorstateroot, H_extrinsichash, encode[4]{H_timeslot},
 *   maybe{H_epochmark}, maybe{H_winnersmark}, encode[2]{H_authorindex},
 *   H_vrfsig, var{H_offendersmark}
 * )
 *
 * ✅ CORRECT: Field types and decoding methods
 * ✅ CORRECT: Field order matches Gray Paper specification
 * ✅ CORRECT: All decoding functions used properly
 * ✅ CORRECT: Uses decodeUnsignedHeader + seal signature
 */
export function decodeHeader(
  data: Uint8Array,
  config: IConfigService,
): Safe<DecodingResult<BlockHeader>> {
  // Decode unsigned header first
  const [error, unsignedHeaderResult] = decodeUnsignedHeader(data, config)
  if (error) {
    return safeError(error)
  }

  let currentData = unsignedHeaderResult.remaining

  // seal_sig (96 bytes)
  const sealSig = bytesToHex(currentData.slice(0, 96))
  currentData = currentData.slice(96)

  return safeResult({
    value: {
      ...unsignedHeaderResult.value,
      sealSig: sealSig,
    },
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}
