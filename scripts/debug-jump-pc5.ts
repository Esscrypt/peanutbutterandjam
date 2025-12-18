#!/usr/bin/env bun
/**
 * Debug JUMP instruction at PC=5
 *
 * Analyzes why JUMP at PC=5 calculates different target addresses
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  decodeBlob,
  decodeNatural,
  decodeProgramFromPreimage,
} from '@pbnjam/codec'
import { bytesToHex, hexToBytes } from '@pbnjam/core'

const WORKSPACE_ROOT = join(__dirname, '..')

// Load block 4 JSON
const blockJsonPath = join(
  WORKSPACE_ROOT,
  'submodules/jam-test-vectors/traces/preimages_light/00000004.json',
)
const blockData = JSON.parse(readFileSync(blockJsonPath, 'utf-8'))

// Find service account for service_id=0
const serviceAccountKey =
  '0xff000000000000000000000000000000000000000000000000000000000000'
const serviceAccountValue = blockData.pre_state.keyvals.find(
  (kv: any) => kv.key === serviceAccountKey,
)?.value

if (!serviceAccountValue) {
  console.error('Service account not found!')
  process.exit(1)
}

// Extract code_hash from service account
// Service account format: 0x00<code_hash_32_bytes><other_fields>
const codeHashHex = serviceAccountValue.slice(4, 68) // Skip '0x00' prefix, then 32 bytes (64 hex chars)
console.log(`Service code hash: 0x${codeHashHex}`)

// Find preimage with this code hash
// Preimage keys are C(s, h) format: 0x0a<service_id_4_bytes><hash_32_bytes>
// For service_id=0: 0x0a00000000<hash>
const serviceId = 0n
const serviceIdBytes = new Uint8Array(4)
const serviceIdView = new DataView(serviceIdBytes.buffer)
serviceIdView.setUint32(0, Number(serviceId), true) // little-endian

const codeHashBytes = hexToBytes('0x' + codeHashHex)
const preimageKeyBytes = new Uint8Array(1 + 4 + 32)
preimageKeyBytes[0] = 0x0a // C(s, h) discriminator
preimageKeyBytes.set(serviceIdBytes, 1)
preimageKeyBytes.set(codeHashBytes, 5)
const preimageKey =
  '0x' +
  Array.from(preimageKeyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

console.log(`Looking for preimage key: ${preimageKey}`)

const preimageEntry = blockData.pre_state.keyvals.find(
  (kv: any) => kv.key === preimageKey,
)

if (!preimageEntry) {
  console.error('Preimage not found!')
  console.error('Available keys starting with 0x0a:')
  blockData.pre_state.keyvals
    .filter((kv: any) => kv.key.startsWith('0x0a'))
    .slice(0, 5)
    .forEach((kv: any) => console.error(`  ${kv.key}`))
  process.exit(1)
}

const preimageValueHex = preimageEntry.value

if (!preimageValueHex) {
  console.error('Preimage value not found!')
  process.exit(1)
}

// Preimage value is encoded as encode{var{blob}} = length_prefix + blob
// First decode the natural number length prefix
const preimageValueBytes = hexToBytes(preimageValueHex)

const [lengthError, lengthResult] = decodeNatural(preimageValueBytes)
if (lengthError || !lengthResult) {
  console.error('Failed to decode preimage length:', lengthError?.message)
  process.exit(1)
}

const blobLength = Number(lengthResult.value)
const lengthPrefixBytes = lengthResult.consumed
const preimageBlob = preimageValueBytes.slice(
  lengthPrefixBytes,
  lengthPrefixBytes + blobLength,
)

console.log(`\nPreimage value format:`)
console.log(`  Total value length: ${preimageValueBytes.length} bytes`)
console.log(`  Length prefix: ${lengthPrefixBytes} bytes`)
console.log(`  Blob length: ${blobLength} bytes`)
console.log(`  Preimage blob length: ${preimageBlob.length} bytes`)

// Decode preimage
const [decodePreimageError, decodedPreimageResult] =
  decodeProgramFromPreimage(preimageBlob)
if (decodePreimageError) {
  console.error('Failed to decode preimage:', decodePreimageError.message)
  process.exit(1)
}

const decodedPreimage = decodedPreimageResult!.value
console.log('\nDecoded preimage:')
console.log(`  roDataLength: ${decodedPreimage.roDataLength}`)
console.log(`  rwDataLength: ${decodedPreimage.rwDataLength}`)
console.log(`  heapZeroPaddingSize: ${decodedPreimage.heapZeroPaddingSize}`)
console.log(`  stackSize: ${decodedPreimage.stackSize}`)
console.log(`  codeSize: ${decodedPreimage.codeSize}`)

// Decode code blob
const [decodeBlobError, decodedBlobResult] = decodeBlob(decodedPreimage.code)
if (decodeBlobError) {
  console.error('Failed to decode blob:', decodeBlobError.message)
  process.exit(1)
}

const { code, bitmask, jumpTable } = decodedBlobResult!.value
console.log('\nDecoded blob:')
console.log(`  code length: ${code.length} bytes`)
console.log(`  bitmask length: ${bitmask.length} bytes`)
console.log(`  jumpTable length: ${jumpTable.length} entries`)

// Analyze JUMP instruction at PC=5
const pc = 5
const opcode = code[pc]
console.log(`\n🔍 Analyzing JUMP instruction at PC=${pc}:`)
console.log(`  Opcode: 0x${opcode.toString(16).padStart(2, '0')} (${opcode})`)
console.log(`  Expected: 0x40 (64) for JUMP`)

if (opcode !== 0x40) {
  console.error(
    `  ❌ Wrong opcode! Expected JUMP (0x40), got 0x${opcode.toString(16)}`,
  )
  process.exit(1)
}

// Calculate fskip (Fskip function)
function calculateFskip(
  instructionIndex: number,
  opcodeBitmask: Uint8Array,
): number {
  const extendedBitmask = new Uint8Array(opcodeBitmask.length + 25)
  extendedBitmask.set(opcodeBitmask)
  extendedBitmask.fill(1, opcodeBitmask.length)

  for (let j = 1; j <= 24; j++) {
    const bitIndex = instructionIndex + j
    if (bitIndex < extendedBitmask.length && extendedBitmask[bitIndex] === 1) {
      return j - 1
    }
  }
  return 24
}

const fskip = calculateFskip(pc, bitmask)
console.log(`  fskip: ${fskip}`)

// Extract operands
const operandStart = pc + 1
const operandEnd = operandStart + fskip
const operands = code.slice(operandStart, operandEnd)
console.log(
  `  Operand bytes [${operandStart}..${operandEnd}): ${Array.from(operands)
    .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
    .join(', ')}`,
)

// Parse offset according to Gray Paper
// l_X = min(4, fskip)
const lengthX = Math.min(4, fskip)
console.log(`  lengthX: ${lengthX}`)

// Read offset as unsigned little-endian
let rawOffset = 0n
for (let i = 0; i < lengthX && i < operands.length; i++) {
  rawOffset |= BigInt(operands[i]) << BigInt(i * 8)
}
console.log(`  rawOffset (unsigned): ${rawOffset}`)

// Apply sign extension
const signBitPosition = BigInt(8 * lengthX - 1)
const signBit = lengthX > 0 ? (rawOffset >> signBitPosition) & 1n : 0n
const offset =
  signBit === 0n ? rawOffset : rawOffset - 2n ** BigInt(8 * lengthX)
console.log(`  signBitPosition: ${signBitPosition}`)
console.log(`  signBit: ${signBit}`)
console.log(`  offset (signed): ${offset}`)

// Calculate target address
const targetAddress = BigInt(pc) + offset
console.log(`  targetAddress: PC(${pc}) + offset(${offset}) = ${targetAddress}`)

// Expected targets
const ourTarget = 75209n
const refTarget = 74997n
console.log(`\n📊 Comparison:`)
console.log(`  Our calculated target: ${targetAddress}`)
console.log(`  Our trace shows: ${ourTarget}`)
console.log(`  Reference trace shows: ${refTarget}`)
console.log(`  Difference from reference: ${targetAddress - refTarget} bytes`)

// Check if target is valid (bitmask check)
if (targetAddress >= 0n && Number(targetAddress) < bitmask.length) {
  const targetBitmask = bitmask[Number(targetAddress)]
  console.log(`\n✅ Target validation:`)
  console.log(`  Target PC: ${targetAddress}`)
  console.log(`  Bitmask at target: ${targetBitmask}`)
  console.log(
    `  Is valid basic block start: ${targetBitmask === 1 ? 'YES' : 'NO'}`,
  )

  if (targetBitmask === 1) {
    const targetOpcode = code[Number(targetAddress)]
    console.log(
      `  Opcode at target: 0x${targetOpcode.toString(16).padStart(2, '0')} (${targetOpcode})`,
    )
  }
} else {
  console.log(`\n❌ Target out of bounds!`)
  console.log(`  Target PC: ${targetAddress}`)
  console.log(`  Code length: ${code.length}`)
  console.log(`  Bitmask length: ${bitmask.length}`)
}

// Show code bytes around PC=5
console.log(`\n📋 Code bytes around PC=${pc}:`)
const contextStart = Math.max(0, pc - 2)
const contextEnd = Math.min(code.length, pc + 10)
for (let i = contextStart; i < contextEnd; i++) {
  const marker = i === pc ? ' ⬅ JUMP' : ''
  const bm = i < bitmask.length ? bitmask[i] : 0
  const bmMark = bm === 1 ? ' [INST]' : ''
  console.log(
    `  PC ${i.toString().padStart(5)}: 0x${code[i].toString(16).padStart(2, '0')} bitmask=${bm}${bmMark}${marker}`,
  )
}

// Show what the reference trace expects
console.log(`\n📋 Reference trace analysis:`)
console.log(`  Reference JUMP at PC=5 jumps to PC=74997`)
console.log(`  This means offset should be: 74997 - 5 = 74992`)
console.log(`  Our calculated offset: ${offset}`)
console.log(`  Difference: ${offset - 74992n} bytes`)

if (offset !== 74992n) {
  console.log(`\n❌ Offset mismatch!`)
  console.log(`  Expected offset bytes for 74992:`)
  // 74992 in little-endian (4 bytes max)
  const expectedOffset = 74992n
  const expectedBytes: number[] = []
  for (let i = 0; i < 4; i++) {
    expectedBytes.push(Number((expectedOffset >> BigInt(i * 8)) & 0xffn))
  }
  console.log(
    `    ${expectedBytes.map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}`,
  )
  console.log(`  Actual operand bytes:`)
  console.log(
    `    ${Array.from(operands.slice(0, 4))
      .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
      .join(', ')}`,
  )
}
