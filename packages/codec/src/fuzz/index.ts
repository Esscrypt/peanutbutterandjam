import { bytesToHex, concatBytes, hexToBytes } from '@pbnjam/core'
import {
  type AncestryItem,
  type ErrorMessage,
  type FuzzerState,
  type FuzzMessage,
  FuzzMessageType,
  type FuzzPeerInfo,
  type FuzzState,
  type GetState,
  type IConfigService,
  type ImportBlock,
  type Initialize,
  type KeyValue,
  type StateRoot,
} from '@pbnjam/types'
import { decodeBlock, encodeBlock } from '../block/body'
import { decodeHeader, encodeHeader } from '../block/header'
import { decodeNatural, encodeNatural } from '../core/natural-number'

/**
 * Encode a FuzzMessage into bytes with length prefix
 *
 * ASN.1 discriminants:
 * - peer-info: [0] (0x00)
 * - initialize: [1] (0x01)
 * - state-root: [2] (0x02)
 * - import-block: [3] (0x03)
 * - get-state: [4] (0x04)
 * - state: [5] (0x05)
 * - error: [255] (0xFF)
 */
export function encodeFuzzMessage(
  message: FuzzMessage,
  config: IConfigService,
): Uint8Array {
  let payload: Uint8Array
  let discriminant: number

  switch (message.type) {
    case FuzzMessageType.PeerInfo:
      discriminant = 0x00
      payload = encodePeerInfo(message.payload)
      break
    case FuzzMessageType.Initialize:
      discriminant = 0x01
      payload = encodeInitialize(message.payload, config)
      break
    case FuzzMessageType.StateRoot:
      discriminant = 0x02
      payload = encodeStateRoot(message.payload)
      break
    case FuzzMessageType.ImportBlock:
      discriminant = 0x03
      payload = encodeImportBlock(message.payload, config)
      break
    case FuzzMessageType.GetState:
      discriminant = 0x04
      payload = encodeGetState(message.payload)
      break
    case FuzzMessageType.State:
      discriminant = 0x05
      payload = encodeState(message.payload)
      break
    case FuzzMessageType.Error:
      discriminant = 0xff
      payload = encodeError(message.payload)
      break
    default:
      // biome-ignore lint/suspicious/noExplicitAny: message type is unknown in default case
      throw new Error(`Unknown message type: ${(message as any).type}`)
  }

  const messageBytes = new Uint8Array(1 + payload.length)
  messageBytes[0] = discriminant
  messageBytes.set(payload, 1)

  // Return message payload WITHOUT length prefix
  // The length prefix is added by the transport layer (sendMessage)
  return messageBytes
}

/**
 * Decode a FuzzMessage from bytes.
 * Assumes the input is the MESSAGE PAYLOAD (discriminant + content), excluding the 4-byte length prefix.
 *
 * ASN.1 discriminants:
 * - peer-info: [0] (0x00)
 * - initialize: [1] (0x01)
 * - state-root: [2] (0x02)
 * - import-block: [3] (0x03)
 * - get-state: [4] (0x04)
 * - state: [5] (0x05)
 * - error: [255] (0xFF)
 */
export function decodeFuzzMessage(
  data: Uint8Array,
  config: IConfigService,
): FuzzMessage {
  if (data.length === 0) {
    throw new Error('Empty data')
  }
  const discriminant = data[0]
  const payload = data.subarray(1)

  switch (discriminant) {
    case 0x00:
      return {
        type: FuzzMessageType.PeerInfo,
        payload: decodePeerInfo(payload),
      }
    case 0x01:
      return {
        type: FuzzMessageType.Initialize,
        payload: decodeInitialize(payload, config),
      }
    case 0x02:
      return {
        type: FuzzMessageType.StateRoot,
        payload: decodeStateRoot(payload),
      }
    case 0x03:
      return {
        type: FuzzMessageType.ImportBlock,
        payload: decodeImportBlock(payload, config),
      }
    case 0x04:
      return {
        type: FuzzMessageType.GetState,
        payload: decodeGetState(payload),
      }
    case 0x05:
      return { type: FuzzMessageType.State, payload: decodeState(payload) }
    case 0xff:
      return { type: FuzzMessageType.Error, payload: decodeError(payload) }
    default:
      throw new Error(`Unknown discriminant: ${discriminant}`)
  }
}

// --- Encoders ---

function encodePeerInfo(info: FuzzPeerInfo): Uint8Array {
  const nameBytes = new TextEncoder().encode(info.app_name)
  const [err, nameLengthEncoded] = encodeNatural(BigInt(nameBytes.length))
  if (err) throw err

  const buffer = new Uint8Array(
    1 + 4 + 3 + 3 + nameLengthEncoded.length + nameBytes.length,
  )
  const view = new DataView(buffer.buffer)
  let offset = 0

  view.setUint8(offset++, info.fuzz_version)
  view.setUint32(offset, info.fuzz_features, true)
  offset += 4

  view.setUint8(offset++, info.jam_version.major)
  view.setUint8(offset++, info.jam_version.minor)
  view.setUint8(offset++, info.jam_version.patch)

  view.setUint8(offset++, info.app_version.major)
  view.setUint8(offset++, info.app_version.minor)
  view.setUint8(offset++, info.app_version.patch)

  buffer.set(nameLengthEncoded, offset)
  offset += nameLengthEncoded.length
  buffer.set(nameBytes, offset)

  return buffer
}

function encodeInitialize(
  init: Initialize,
  config: IConfigService,
): Uint8Array {
  // Encode header (directly, no length prefix - ASN.1 SEQUENCE concatenates fields)
  const [headerError, headerEncoded] = encodeHeader(init.header, config)
  if (headerError) throw headerError

  // Encode keyvals (State = SEQUENCE OF KeyValue)
  // encodeKeyValueSequence already adds the length prefix for the sequence
  const keyvalsEncoded = encodeKeyValueSequence(init.keyvals)

  // Encode ancestry (SEQUENCE OF AncestryItem)
  // encodeAncestry already adds the length prefix for the sequence
  const ancestryEncoded = encodeAncestry(init.ancestry)

  // Combine: header (direct) + keyvals (already length-prefixed) + ancestry (already length-prefixed)
  // ASN.1 SEQUENCE just concatenates fields directly
  return concatBytes([headerEncoded, keyvalsEncoded, ancestryEncoded])
}

function encodeImportBlock(
  msg: ImportBlock,
  config: IConfigService,
): Uint8Array {
  // Encode block using JAM codec
  // According to ASN.1 spec: ImportBlock ::= Block
  // So ImportBlock is just the block directly, NOT length-prefixed
  const [blockError, blockEncoded] = encodeBlock(msg.block, config)
  if (blockError) throw blockError

  // Return block directly without length prefix
  return blockEncoded
}

function encodeGetState(msg: GetState): Uint8Array {
  return hexToBytes(msg.block_hash)
}

function encodeStateRoot(msg: StateRoot): Uint8Array {
  return hexToBytes(msg.state_root)
}

function encodeState(state: FuzzerState): Uint8Array {
  // State is a sequence of KeyValue pairs
  return encodeKeyValueSequence(state.keyvals)
}

function encodeError(msg: ErrorMessage): Uint8Array {
  // Ensure error is always a string
  const errorString = msg.error ?? 'Unknown error'
  const errorBytes = new TextEncoder().encode(errorString)
  const [err, lengthEncoded] = encodeNatural(BigInt(errorBytes.length))
  if (err) throw err
  return concatBytes([lengthEncoded, errorBytes])
}

// Helper functions

function encodeKeyValue(kv: KeyValue): Uint8Array {
  const keyBytes = hexToBytes(kv.key)
  if (keyBytes.length !== 31) {
    throw new Error(`Key must be exactly 31 bytes, got ${keyBytes.length}`)
  }
  const valueBytes = hexToBytes(kv.value)

  // KeyValue: key (31 bytes) + value (length-prefixed)
  const [valueLenErr, valueLenEncoded] = encodeNatural(
    BigInt(valueBytes.length),
  )
  if (valueLenErr) throw valueLenErr

  return concatBytes([keyBytes, valueLenEncoded, valueBytes])
}

function encodeKeyValueSequence(keyvals: FuzzState): Uint8Array {
  // Encode sequence length
  const [lenErr, lenEncoded] = encodeNatural(BigInt(keyvals.length))
  if (lenErr) throw lenErr

  // Encode each KeyValue
  const kvEncoded = keyvals.map((kv) => encodeKeyValue(kv))

  return concatBytes([lenEncoded, ...kvEncoded] as Uint8Array[])
}

function encodeAncestryItem(item: AncestryItem): Uint8Array {
  // AncestryItem: slot (4 bytes, U32) + header_hash (32 bytes)
  const slotBytes = new Uint8Array(4)
  new DataView(slotBytes.buffer).setUint32(0, Number(item.slot), true)
  const headerHashBytes = hexToBytes(item.header_hash)

  return concatBytes([slotBytes, headerHashBytes])
}

function encodeAncestry(ancestry: AncestryItem[]): Uint8Array {
  // Encode sequence length (0-24)
  if (ancestry.length > 24) {
    throw new Error(`Ancestry length must be <= 24, got ${ancestry.length}`)
  }
  const [lenErr, lenEncoded] = encodeNatural(BigInt(ancestry.length))
  if (lenErr) throw lenErr

  // Encode each AncestryItem
  const itemsEncoded = ancestry.map((item) => encodeAncestryItem(item))

  return concatBytes([lenEncoded, ...itemsEncoded] as Uint8Array[])
}

// --- Decoders ---

function decodePeerInfo(data: Uint8Array): FuzzPeerInfo {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 0

  const fuzz_version = view.getUint8(offset++)
  const fuzz_features = view.getUint32(offset, true)
  offset += 4

  const jam_version = {
    major: view.getUint8(offset++),
    minor: view.getUint8(offset++),
    patch: view.getUint8(offset++),
  }

  const app_version = {
    major: view.getUint8(offset++),
    minor: view.getUint8(offset++),
    patch: view.getUint8(offset++),
  }

  const [err, nameLengthRes] = decodeNatural(data.subarray(offset))
  if (err) throw err
  offset += nameLengthRes.consumed

  const nameBytes = data.subarray(offset, offset + Number(nameLengthRes.value))
  const app_name = new TextDecoder().decode(nameBytes)

  return {
    fuzz_version,
    fuzz_features,
    jam_version,
    app_version,
    app_name,
  }
}

function decodeInitialize(
  data: Uint8Array,
  config: IConfigService,
): Initialize {
  let offset = 0

  // Decode header (directly, no length prefix - ASN.1 SEQUENCE concatenates fields)
  // Header is a complex structure with variable size, so we need to decode it
  // and use the consumed bytes to advance the offset
  const [headerError, headerResult] = decodeHeader(
    data.subarray(offset),
    config,
  )
  if (headerError) throw headerError
  offset += headerResult.consumed

  // Debug: Check what's at the offset after header
  if (data.length > offset) {
    const nextBytes = data.subarray(offset, Math.min(offset + 20, data.length))
    // Only log in debug mode to avoid noise
    if (process.env['DEBUG_FUZZ_DECODE']) {
      console.log(
        `[decodeInitialize] After header (offset=${offset}): first 20 bytes: ${Array.from(
          nextBytes,
        )
          .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
          .join(' ')}`,
      )
    }
  }

  // Skip padding zeros after header (tool artifacts, not part of ASN.1 spec)
  // Some tools add padding between header and keyvals, which we need to skip
  const originalOffset = offset
  while (offset < data.length && data[offset] === 0) {
    offset++
  }
  if (offset > originalOffset) {
    // Only log in debug mode to avoid noise
    if (process.env['DEBUG_FUZZ_DECODE']) {
      console.log(
        `[decodeInitialize] Skipped ${offset - originalOffset} bytes of padding zeros after header`,
      )
    }
  }

  // Decode keyvals (State = SEQUENCE OF KeyValue)
  // decodeKeyValueSequence expects the data to start with the sequence length prefix
  // No outer length prefix needed - ASN.1 SEQUENCE just concatenates fields
  const remainingForKeyvals = data.subarray(offset)
  if (remainingForKeyvals.length === 0) {
    throw new Error(
      `No data remaining for keyvals after header (offset=${offset}, data.length=${data.length})`,
    )
  }

  if (process.env['DEBUG_FUZZ_DECODE']) {
    console.log(
      `[decodeInitialize] Decoding keyvals: remaining data length=${remainingForKeyvals.length} bytes, offset=${offset}`,
    )
  }

  const { keyvals, consumed: keyvalsConsumed } =
    decodeKeyValueSequenceWithConsumed(remainingForKeyvals)
  offset += keyvalsConsumed

  if (process.env['DEBUG_FUZZ_DECODE']) {
    console.log(
      `[decodeInitialize] Decoded ${keyvals.length} keyvals, consumed ${keyvalsConsumed} bytes, new offset=${offset}`,
    )
  }

  // Decode ancestry (SEQUENCE OF AncestryItem)
  // decodeAncestry expects the data to start with the sequence length prefix
  const { ancestry, consumed: ancestryConsumed } = decodeAncestryWithConsumed(
    data.subarray(offset),
  )
  offset += ancestryConsumed

  return {
    header: headerResult.value,
    keyvals,
    ancestry,
  }
}

function decodeImportBlock(
  data: Uint8Array,
  config: IConfigService,
): ImportBlock {
  // Debug logging if enabled
  if (process.env['DEBUG_FUZZ_DECODE']) {
    console.log(`[decodeImportBlock] Decoding from ${data.length} bytes`)
    console.log(
      `[decodeImportBlock] First 20 bytes: ${Array.from(data.slice(0, 20))
        .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
        .join(' ')}`,
    )
  }

  // According to ASN.1 spec: ImportBlock ::= Block
  // So ImportBlock is just the block directly, NOT length-prefixed
  // Decode the entire data as a block
  if (data.length === 0) {
    throw new Error(`ImportBlock has zero-length block data`)
  }

  if (process.env['DEBUG_FUZZ_DECODE']) {
    console.log(
      `[decodeImportBlock] Decoding entire ${data.length} bytes as block (no length prefix)`,
    )
  }

  // Decode block using JAM codec
  const [blockError, blockResult] = decodeBlock(data, config)
  if (blockError) {
    if (process.env['DEBUG_FUZZ_DECODE']) {
      console.error(
        `[decodeImportBlock] Block decode error: ${blockError.message}`,
      )
      console.error(`[decodeImportBlock] Data length: ${data.length} bytes`)
    }
    throw new Error(
      `Failed to decode block in ImportBlock: ${blockError.message}`,
    )
  }

  return { block: blockResult.value }
}

function decodeGetState(data: Uint8Array): GetState {
  return { block_hash: bytesToHex(data.slice(0, 32)) }
}

function decodeStateRoot(data: Uint8Array): StateRoot {
  return { state_root: bytesToHex(data.slice(0, 32)) }
}

function decodeState(data: Uint8Array): FuzzerState {
  const keyvals = decodeKeyValueSequence(data)
  return { keyvals }
}

function decodeError(data: Uint8Array): ErrorMessage {
  const [err, lengthRes] = decodeNatural(data)
  if (err) throw err

  const errorBytes = data.subarray(
    lengthRes.consumed,
    lengthRes.consumed + Number(lengthRes.value),
  )
  return { error: new TextDecoder().decode(errorBytes) }
}

// Helper functions

function decodeKeyValue(data: Uint8Array): { kv: KeyValue; consumed: number } {
  // Key (31 bytes) + value (length-prefixed)
  if (data.length < 31) {
    throw new Error(
      `Not enough data for KeyValue key: need 31 bytes, got ${data.length}`,
    )
  }

  const keyBytes = data.subarray(0, 31)
  const key = bytesToHex(keyBytes)

  let offset = 31
  const [valueLenErr, valueLenRes] = decodeNatural(data.subarray(offset))
  if (valueLenErr) throw valueLenErr
  offset += valueLenRes.consumed

  const valueBytes = data.subarray(offset, offset + Number(valueLenRes.value))
  const value = bytesToHex(valueBytes)
  offset += Number(valueLenRes.value)

  return {
    kv: { key, value },
    consumed: offset,
  }
}

function decodeKeyValueSequence(data: Uint8Array): FuzzState {
  // Decode sequence length
  const [lenErr, lenRes] = decodeNatural(data)
  if (lenErr) throw lenErr

  let offset = lenRes.consumed
  const keyvals: KeyValue[] = []

  for (let i = 0; i < Number(lenRes.value); i++) {
    const { kv, consumed } = decodeKeyValue(data.subarray(offset))
    keyvals.push(kv)
    offset += consumed
  }

  return keyvals
}

function decodeKeyValueSequenceWithConsumed(data: Uint8Array): {
  keyvals: FuzzState
  consumed: number
} {
  // Decode sequence length
  const [lenErr, lenRes] = decodeNatural(data)
  if (lenErr) throw lenErr

  const expectedKeyvals = Number(lenRes.value)
  if (process.env['DEBUG_FUZZ_DECODE']) {
    console.log(
      `[decodeKeyValueSequenceWithConsumed] Expected ${expectedKeyvals} keyvals, data length: ${data.length} bytes`,
    )
  }

  let offset = lenRes.consumed
  const keyvals: KeyValue[] = []

  for (let i = 0; i < expectedKeyvals; i++) {
    if (offset >= data.length) {
      throw new Error(
        `Not enough data for keyval ${i + 1}/${expectedKeyvals} (offset=${offset}, data.length=${data.length})`,
      )
    }
    const { kv, consumed } = decodeKeyValue(data.subarray(offset))
    keyvals.push(kv)
    offset += consumed
  }

  if (process.env['DEBUG_FUZZ_DECODE']) {
    console.log(
      `[decodeKeyValueSequenceWithConsumed] Decoded ${keyvals.length} keyvals, consumed ${offset} bytes`,
    )
  }

  return { keyvals, consumed: offset }
}

function decodeAncestryItem(data: Uint8Array): {
  item: AncestryItem
  consumed: number
} {
  // slot (4 bytes) + header_hash (32 bytes)
  if (data.length < 36) {
    throw new Error(
      `Not enough data for AncestryItem: need 36 bytes, got ${data.length}`,
    )
  }

  const slotBytes = data.subarray(0, 4)
  const slot = BigInt(new DataView(slotBytes.buffer).getUint32(0, true))

  const headerHashBytes = data.subarray(4, 36)
  const header_hash = bytesToHex(headerHashBytes)

  return {
    item: { slot, header_hash },
    consumed: 36,
  }
}

// Keep for potential future use (e.g., tests)
// @ts-expect-error - intentionally unused, kept for API consistency
function _decodeAncestry(data: Uint8Array): AncestryItem[] {
  // Decode sequence length
  const [lenErr, lenRes] = decodeNatural(data)
  if (lenErr) throw lenErr

  let offset = lenRes.consumed
  const ancestry: AncestryItem[] = []

  for (let i = 0; i < Number(lenRes.value); i++) {
    const { item, consumed } = decodeAncestryItem(data.subarray(offset))
    ancestry.push(item)
    offset += consumed
  }

  return ancestry
}

function decodeAncestryWithConsumed(data: Uint8Array): {
  ancestry: AncestryItem[]
  consumed: number
} {
  // Decode sequence length
  const [lenErr, lenRes] = decodeNatural(data)
  if (lenErr) throw lenErr

  let offset = lenRes.consumed
  const ancestry: AncestryItem[] = []

  for (let i = 0; i < Number(lenRes.value); i++) {
    const { item, consumed } = decodeAncestryItem(data.subarray(offset))
    ancestry.push(item)
    offset += consumed
  }

  return { ancestry, consumed: offset }
}
