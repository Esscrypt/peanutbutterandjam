#!/usr/bin/env bun
/**
 * Check if fskip calculation differs due to bitmask
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeBlob, decodeProgramFromPreimage } from '@pbnjam/codec'
import { hexToBytes } from '@pbnjam/core'

const WORKSPACE_ROOT = join(__dirname, '..')
const JSON_PATH = join(
  WORKSPACE_ROOT,
  'submodules/jam-test-vectors/traces/preimages_light/00000004.json',
)

const data = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))

// Get preimage from key 0x008e00200007009363619235b9fdd711cfc47ca834f2000f95bc7ab94b0e9d
const targetKey =
  '0x008e00200007009363619235b9fdd711cfc47ca834f2000f95bc7ab94b0e9d'
const kv = data.pre_state.keyvals.find((kv: any) => kv.key === targetKey)
if (!kv) throw new Error('Code preimage not found')

const preimageBlob = hexToBytes(kv.value as `0x${string}`)
const [error, result] = decodeProgramFromPreimage(preimageBlob)
if (error) throw new Error(`Failed to decode preimage: ${error.message}`)

const [blobError, blobResult] = decodeBlob(result.value.code)
if (blobError) throw new Error(`Failed to decode blob: ${blobError.message}`)

const code = blobResult.value.code
const bitmask = blobResult.value.bitmask

console.log('Analyzing JUMP instruction at PC=5\n')

// Calculate fskip with extended bitmask (like AssemblyScript)
function calculateFskipWithExtended(
  instructionIndex: number,
  bitmask: Uint8Array,
): number {
  const extendedBitmask = new Uint8Array(bitmask.length + 25)
  extendedBitmask.set(bitmask)
  extendedBitmask.fill(1, bitmask.length)

  for (let j = 1; j <= 24; j++) {
    const bitIndex = instructionIndex + j
    if (bitIndex < extendedBitmask.length && extendedBitmask[bitIndex] === 1) {
      return j - 1
    }
  }
  return 24
}

// Calculate fskip without extended bitmask
function calculateFskipWithoutExtended(
  instructionIndex: number,
  bitmask: Uint8Array,
): number {
  for (let j = 1; j <= 24; j++) {
    const bitIndex = instructionIndex + j
    if (bitIndex >= bitmask.length) {
      return 24 // End of bitmask
    }
    if (bitmask[bitIndex] === 1) {
      return j - 1
    }
  }
  return 24
}

const pc = 5
const fskipExtended = calculateFskipWithExtended(pc, bitmask)
const fskipWithoutExtended = calculateFskipWithoutExtended(pc, bitmask)

console.log(`PC=${pc}: opcode=0x${code[pc].toString(16)} (JUMP)`)
console.log(`Bitmask at PC=${pc}: ${bitmask[pc]}`)
console.log(`\nfskip calculation:`)
console.log(`  With extended bitmask: ${fskipExtended}`)
console.log(`  Without extended bitmask: ${fskipWithoutExtended}`)

// Show bitmask around PC
console.log(`\nBitmask around PC=${pc}:`)
for (let i = Math.max(0, pc - 2); i < Math.min(bitmask.length, pc + 10); i++) {
  const marker =
    i === pc
      ? ' ⬅ PC'
      : i === pc + 1 + fskipExtended
        ? ' ⬅ next instruction'
        : ''
  console.log(`  PC ${i}: bitmask=${bitmask[i]} ${marker}`)
}

// Show what bytes we'd read
const lengthXExtended = Math.min(4, fskipExtended)
const lengthXWithoutExtended = Math.min(4, fskipWithoutExtended)

console.log(`\nBytes we'd read:`)
console.log(
  `  With extended (lengthX=${lengthXExtended}):`,
  Array.from(code.slice(pc + 1, pc + 1 + lengthXExtended))
    .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
    .join(', '),
)
console.log(
  `  Without extended (lengthX=${lengthXWithoutExtended}):`,
  Array.from(code.slice(pc + 1, pc + 1 + lengthXWithoutExtended))
    .map((b) => `0x${b.toString(16).padStart(2, '0')}`)
    .join(', '),
)

// Calculate targets
function readLittleEndian(bytes: number[], length: number): number {
  let value = 0
  for (let i = 0; i < Math.min(length, bytes.length); i++) {
    value |= bytes[i] << (i * 8)
  }
  return value
}

const bytesExtended = Array.from(code.slice(pc + 1, pc + 1 + lengthXExtended))
const bytesWithoutExtended = Array.from(
  code.slice(pc + 1, pc + 1 + lengthXWithoutExtended),
)

const offsetExtended = readLittleEndian(bytesExtended, lengthXExtended)
const offsetWithoutExtended = readLittleEndian(
  bytesWithoutExtended,
  lengthXWithoutExtended,
)

// Apply sign extension
function signExtend(value: number, length: number): number {
  const signBitPosition = 8 * length - 1
  const signBit = (value >> signBitPosition) & 1
  return signBit === 0 ? value : value - (1 << (8 * length))
}

const signedOffsetExtended = signExtend(offsetExtended, lengthXExtended)
const signedOffsetWithoutExtended = signExtend(
  offsetWithoutExtended,
  lengthXWithoutExtended,
)

const targetExtended = pc + signedOffsetExtended
const targetWithoutExtended = pc + signedOffsetWithoutExtended

console.log(`\nTarget calculations:`)
console.log(
  `  With extended: offset=${offsetExtended} (signed=${signedOffsetExtended}) → target=${targetExtended}`,
)
console.log(
  `  Without extended: offset=${offsetWithoutExtended} (signed=${signedOffsetWithoutExtended}) → target=${targetWithoutExtended}`,
)
console.log(`  Reference target: 74997`)
console.log(`  Our calculated: 75209`)
