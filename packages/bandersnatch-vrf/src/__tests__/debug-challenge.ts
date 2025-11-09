/**
 * Debug script to manually compute challenge and compare with proof's c
 *
 * This script helps debug why the challenge computed from the proof doesn't match
 * the challenge extracted from the proof bytes.
 */

import { sha512 } from '@noble/hashes/sha2'
import { BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'
import { bytesToHex, mod } from '@pbnj/core'
import { bytesToBigIntLittleEndian } from '../crypto/elligator2'

// Values from the test logs
const cFromProofHex = 'f41696b906dd37a70329371aef517f762258eba2e65d1184d46d5549a1262d6'
const expectedCHex = 'b822dc8cc01ab0ebf2c2b20a9b2eb5bfa2b44ab44e4135647e83e9c5028e9e8'

// Points from the test logs
const yHex = '0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3'
const iHex = '0x7d64728140cda3e75a1dcc3946136fb4bb78baec5954f72281d2e294d148c2f0'
const oHex = '0x5393ef1b5ae440adac5f72fb992dbcf88fd62d099b04cc399ed614ed276a6c64'
const uHex = '0x1caa9919262f50162d42721bda09680b8cd42b58821f689ac4ee860637400ab2'
const vHex = '0x6d067dd157faeb7013472938d1615d76566fdff31f6e04c246b9c4c25eebf187'

// Hash input from the test logs
const hashInputHex =
  '0x42616e646572736e617463685f5348412d3531325f454c4c3202ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b37d64728140cda3e75a1dcc3946136fb4bb78baec5954f72281d2e294d148c2f05393ef1b5ae440adac5f72fb992dbcf88fd62d099b04cc399ed614ed276a6c641caa9919262f50162d42721bda09680b8cd42b58821f689ac4ee860637400ab26d067dd157faeb7013472938d1615d76566fdff31f6e04c246b9c4c25eebf18700'

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToBigInt(bytes: Uint8Array, littleEndian = false): bigint {
  if (littleEndian) {
    return bytesToBigIntLittleEndian(bytes)
  }
  let result = 0n
  for (let i = 0; i < bytes.length; i++) {
    result = result * 256n + BigInt(bytes[i])
  }
  return result
}

console.log('=== Challenge Debug ===\n')

// Parse c from proof
const cFromProofBytes = hexToBytes(cFromProofHex)
const cFromProof = bytesToBigInt(cFromProofBytes, true) // little-endian
const cFromProofReduced = mod(cFromProof, BANDERSNATCH_PARAMS.CURVE_ORDER)

console.log('cFromProof (hex):', cFromProofHex)
console.log('cFromProof (bigint, little-endian):', cFromProof.toString(16))
console.log('cFromProof (reduced mod curve order):', cFromProofReduced.toString(16))
console.log()

// Compute challenge from hash input
const hashInputBytes = hexToBytes(hashInputHex)
const hash = sha512(hashInputBytes)
const cBytes = hash.slice(0, 32)

console.log('Hash input (hex):', hashInputHex)
console.log('Hash input length:', hashInputBytes.length)
console.log('Hash (hex):', bytesToHex(hash))
console.log('cBytes (first 32 bytes of hash, hex):', bytesToHex(cBytes))
console.log()

// Try different interpretations
console.log('=== Trying different interpretations ===\n')

// 1. Little-endian interpretation (current implementation)
const cLittleEndian = mod(
  bytesToBigIntLittleEndian(cBytes),
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
console.log('1. Little-endian interpretation:')
console.log('   cBytes (hex):', bytesToHex(cBytes))
console.log('   c (bigint, little-endian):', bytesToBigIntLittleEndian(cBytes).toString(16))
console.log('   c (reduced mod curve order):', cLittleEndian.toString(16))
console.log('   Matches cFromProof?', cLittleEndian === cFromProofReduced)
console.log()

// 2. Big-endian interpretation
const cBigEndian = mod(bytesToBigInt(cBytes, false), BANDERSNATCH_PARAMS.CURVE_ORDER)
console.log('2. Big-endian interpretation:')
console.log('   cBytes (hex):', bytesToHex(cBytes))
console.log('   c (bigint, big-endian):', bytesToBigInt(cBytes, false).toString(16))
console.log('   c (reduced mod curve order):', cBigEndian.toString(16))
console.log('   Matches cFromProof?', cBigEndian === cFromProofReduced)
console.log()

// 3. Direct match - what if cFromProof is the hash itself?
console.log('3. Direct hash match:')
console.log('   cFromProof (hex):', cFromProofHex)
console.log('   cBytes (hex):', bytesToHex(cBytes))
console.log('   Match?', cFromProofHex.toLowerCase() === bytesToHex(cBytes).toLowerCase().slice(2))
console.log()

// 4. What if we need to reverse the bytes?
const cBytesReversed = new Uint8Array(cBytes).reverse()
const cReversedLittleEndian = mod(
  bytesToBigIntLittleEndian(cBytesReversed),
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
console.log('4. Reversed bytes, little-endian:')
console.log('   cBytes reversed (hex):', bytesToHex(cBytesReversed))
console.log('   c (bigint, little-endian):', bytesToBigIntLittleEndian(cBytesReversed).toString(16))
console.log('   c (reduced mod curve order):', cReversedLittleEndian.toString(16))
console.log('   Matches cFromProof?', cReversedLittleEndian === cFromProofReduced)
console.log()

// 5. What if cFromProof is already reduced and we need to match the raw hash?
console.log('5. Raw hash comparison:')
const rawHashAsBigInt = bytesToBigIntLittleEndian(cBytes)
console.log('   Raw hash (bigint, little-endian):', rawHashAsBigInt.toString(16))
console.log('   cFromProof (bigint, little-endian):', cFromProof.toString(16))
console.log('   Match?', rawHashAsBigInt === cFromProof)
console.log()

// 6. Try to reconstruct the challenge computation step by step
console.log('=== Step-by-step challenge reconstruction ===\n')

// Step 1: suite_string || 0x02
const suiteString = 'Bandersnatch_SHA-512_ELL2'
const str0 = new Uint8Array(suiteString.length + 1)
str0.set(new TextEncoder().encode(suiteString), 0)
str0[str0.length - 1] = 0x02
console.log('Step 1: str_0 = suite_string || 0x02')
console.log('   str0 (hex):', bytesToHex(str0))
console.log()

// Step 2: str_i = str_{i-1} || point_to_string(P_{i-1})
const points = [
  hexToBytes(yHex),
  hexToBytes(iHex),
  hexToBytes(oHex),
  hexToBytes(uHex),
  hexToBytes(vHex),
]

let currentStr = str0
for (let i = 0; i < points.length; i++) {
  const point = points[i]
  const newStr = new Uint8Array(currentStr.length + point.length)
  newStr.set(currentStr, 0)
  newStr.set(point, currentStr.length)
  currentStr = newStr
  console.log(`Step 2.${i + 1}: Append point ${i + 1} (${['Y', 'I', 'O', 'U', 'V'][i]})`)
  console.log(`   Point (hex): ${bytesToHex(point)}`)
  console.log(`   Current str length: ${currentStr.length}`)
}

// Step 3: h = hash(str_n || ad || 0x00)
const auxData = new Uint8Array(0)
const hashInput = new Uint8Array(currentStr.length + auxData.length + 1)
hashInput.set(currentStr, 0)
hashInput.set(auxData, currentStr.length)
hashInput[hashInput.length - 1] = 0x00

console.log()
console.log('Step 3: h = hash(str_n || ad || 0x00)')
console.log('   hashInput (hex):', bytesToHex(hashInput))
console.log('   hashInput length:', hashInput.length)
console.log('   Matches test log?', bytesToHex(hashInput) === hashInputHex.slice(2))
console.log()

const h = sha512(hashInput)
console.log('Step 4: Hash result')
console.log('   h (hex):', bytesToHex(h))
console.log('   h length:', h.length)
console.log()

// Step 4: c = string_to_int(h_{0 ... cLen - 1})
const cLen = 32
const cBytesFromHash = h.slice(0, cLen)
console.log('Step 5: c = string_to_int(h_{0 ... cLen - 1})')
console.log('   cBytes (hex):', bytesToHex(cBytesFromHash))
console.log()

// Try all interpretations again with the reconstructed hash
console.log('=== Final comparison with reconstructed hash ===\n')
const cFinalLittleEndian = mod(
  bytesToBigIntLittleEndian(cBytesFromHash),
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
const cFinalBigEndian = mod(bytesToBigInt(cBytesFromHash, false), BANDERSNATCH_PARAMS.CURVE_ORDER)

console.log('cFromProof (reduced):', cFromProofReduced.toString(16))
console.log('cFinal (little-endian, reduced):', cFinalLittleEndian.toString(16))
console.log('cFinal (big-endian, reduced):', cFinalBigEndian.toString(16))
console.log('expectedC (from test):', expectedCHex)
console.log()
console.log('Matches cFromProof (little-endian)?', cFinalLittleEndian === cFromProofReduced)
console.log('Matches cFromProof (big-endian)?', cFinalBigEndian === cFromProofReduced)
console.log('Matches expectedC?', cFinalLittleEndian.toString(16) === expectedCHex)
console.log()

// Try to find what c value would produce cFromProof when encoded
console.log('=== Reverse engineering: what c produces cFromProof? ===\n')

// cFromProof as hex (from proof bytes)
const cFromProofBytesDirect = hexToBytes(cFromProofHex)
console.log('cFromProof bytes (hex):', bytesToHex(cFromProofBytesDirect))
console.log('cFromProof bytes length:', cFromProofBytesDirect.length)
console.log('Hash bytes length:', cBytesFromHash.length)
console.log('cFromProof hex length (chars):', cFromProofHex.length)
console.log('Expected 32 bytes = 64 hex chars')

// Try interpreting cFromProof bytes as little-endian (what we expect)
const cFromProofAsLittleEndian = bytesToBigIntLittleEndian(cFromProofBytesDirect)
const cFromProofAsLittleEndianReduced = mod(
  cFromProofAsLittleEndian,
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
console.log('cFromProof interpreted as little-endian:', cFromProofAsLittleEndian.toString(16))
console.log('cFromProof interpreted as little-endian (reduced):', cFromProofAsLittleEndianReduced.toString(16))
console.log()

// Try interpreting cFromProof bytes as big-endian
const cFromProofAsBigEndian = bytesToBigInt(cFromProofBytesDirect, false)
const cFromProofAsBigEndianReduced = mod(
  cFromProofAsBigEndian,
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
console.log('cFromProof interpreted as big-endian:', cFromProofAsBigEndian.toString(16))
console.log('cFromProof interpreted as big-endian (reduced):', cFromProofAsBigEndianReduced.toString(16))
console.log()

// What if cFromProof is the raw hash (before reduction)?
console.log('=== What if cFromProof is the raw hash? ===\n')
console.log('Hash bytes (hex):', bytesToHex(cBytesFromHash))
console.log('cFromProof (hex):', cFromProofHex)
console.log('Match?', bytesToHex(cBytesFromHash).toLowerCase().slice(2) === cFromProofHex.toLowerCase())
console.log()

// What if we need to reverse the hash bytes?
const hashBytesReversed = new Uint8Array(cBytesFromHash).reverse()
console.log('Hash bytes reversed (hex):', bytesToHex(hashBytesReversed))
console.log('cFromProof (hex):', cFromProofHex)
console.log('Match?', bytesToHex(hashBytesReversed).toLowerCase().slice(2) === cFromProofHex.toLowerCase())
console.log()

// What if cFromProof is the hash with first byte removed?
const hashWithoutFirstByte = cBytesFromHash.slice(1)
console.log('Hash without first byte (hex):', bytesToHex(hashWithoutFirstByte))
console.log('cFromProof (hex):', cFromProofHex)
console.log('Match?', bytesToHex(hashWithoutFirstByte).toLowerCase().slice(2) === cFromProofHex.toLowerCase())
console.log()

// What if we need to pad cFromProof with leading zero?
const cFromProofWithLeadingZero = '0' + cFromProofHex
const cFromProofBytesPadded = hexToBytes(cFromProofWithLeadingZero)
console.log('cFromProof with leading zero (hex):', cFromProofWithLeadingZero)
console.log('Hash bytes (hex):', bytesToHex(cBytesFromHash))
console.log('Match?', bytesToHex(cBytesFromHash).toLowerCase().slice(2) === cFromProofWithLeadingZero.toLowerCase())
console.log()

// What if cFromProof is the hash interpreted as big-endian (raw, no reduction)?
console.log('=== What if cFromProof is hash as big-endian (raw)? ===\n')
const hashAsBigEndian = bytesToBigInt(cBytesFromHash, false)
console.log('Hash as big-endian (raw):', hashAsBigEndian.toString(16))
console.log('cFromProof as big-endian (raw):', cFromProofAsBigEndian.toString(16))
console.log('Match?', hashAsBigEndian === cFromProofAsBigEndian)
console.log()

// What if the proof was encoded with big-endian instead of little-endian?
console.log('=== What if proof c was encoded as big-endian? ===\n')
import { numberToBytes, numberToBytesLittleEndian } from '@pbnj/core'
// Try to encode expectedC as big-endian and see if it matches cFromProof
const expectedCBigInt = cFinalLittleEndian // This is the computed challenge
const expectedCAsBigEndianBytes = numberToBytes(expectedCBigInt)
console.log('expectedC (bigint):', expectedCBigInt.toString(16))
console.log('expectedC encoded as big-endian (hex):', bytesToHex(expectedCAsBigEndianBytes))
console.log('cFromProof (hex):', cFromProofHex)
console.log('Match?', bytesToHex(expectedCAsBigEndianBytes).toLowerCase().slice(2) === cFromProofHex.toLowerCase())
console.log()

// What if we decode cFromProof as if it were encoded big-endian?
console.log('=== Decoding cFromProof as if encoded big-endian ===\n')
// Pad cFromProof to 32 bytes if needed
let cFromProofBytes32 = cFromProofBytesDirect
if (cFromProofBytes32.length < 32) {
  const padded = new Uint8Array(32)
  padded.set(cFromProofBytes32, 32 - cFromProofBytes32.length)
  cFromProofBytes32 = padded
  console.log('Padded cFromProof to 32 bytes')
}
const cFromProofDecodedAsBigEndian = bytesToBigInt(cFromProofBytes32, false)
const cFromProofDecodedAsBigEndianReduced = mod(
  cFromProofDecodedAsBigEndian,
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
console.log('cFromProof decoded as big-endian (raw):', cFromProofDecodedAsBigEndian.toString(16))
console.log('cFromProof decoded as big-endian (reduced):', cFromProofDecodedAsBigEndianReduced.toString(16))
console.log('expectedC (from computation):', expectedCBigInt.toString(16))
console.log('Match?', cFromProofDecodedAsBigEndianReduced === expectedCBigInt)
console.log()

// What if cFromProof is the hash bytes directly (big-endian, no reduction)?
console.log('=== What if cFromProof is hash bytes as big-endian (no reduction)? ===\n')
const hashAsBigEndianNoReduction = bytesToBigInt(cBytesFromHash, false)
console.log('Hash as big-endian (no reduction):', hashAsBigEndianNoReduction.toString(16))
console.log('cFromProof as big-endian (no reduction):', cFromProofAsBigEndian.toString(16))
console.log('Match?', hashAsBigEndianNoReduction === cFromProofAsBigEndian)
console.log()

// What if cFromProof is actually the hash bytes with leading zero?
console.log('=== What if cFromProof is hash bytes with leading zero (big-endian)? ===\n')
const cFromProofWithLeadingZeroBytes = hexToBytes('0' + cFromProofHex)
console.log('cFromProof with leading zero (hex):', bytesToHex(cFromProofWithLeadingZeroBytes))
console.log('Hash bytes (hex):', bytesToHex(cBytesFromHash))
console.log('Bytes match?', bytesToHex(cFromProofWithLeadingZeroBytes) === bytesToHex(cBytesFromHash))
const cFromProofWithLeadingZeroAsBigEndian = bytesToBigInt(cFromProofWithLeadingZeroBytes, false)
const cFromProofWithLeadingZeroAsBigEndianReduced = mod(
  cFromProofWithLeadingZeroAsBigEndian,
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
console.log('cFromProof with leading zero as big-endian (raw):', cFromProofWithLeadingZeroAsBigEndian.toString(16))
console.log('cFromProof with leading zero as big-endian (reduced):', cFromProofWithLeadingZeroAsBigEndianReduced.toString(16))
console.log('Hash as big-endian (reduced):', mod(hashAsBigEndianNoReduction, BANDERSNATCH_PARAMS.CURVE_ORDER).toString(16))
console.log('Match (reduced)?', cFromProofWithLeadingZeroAsBigEndianReduced === mod(hashAsBigEndianNoReduction, BANDERSNATCH_PARAMS.CURVE_ORDER))
console.log()

// What if we need to pad cFromProof with leading zero and then interpret?
console.log('=== Padding cFromProof and interpreting ===\n')
const cFromProofPadded = new Uint8Array(32)
cFromProofPadded.set(cFromProofBytesDirect, 1) // Pad with leading zero
const cFromProofPaddedAsLittleEndian = bytesToBigIntLittleEndian(cFromProofPadded)
const cFromProofPaddedAsLittleEndianReduced = mod(
  cFromProofPaddedAsLittleEndian,
  BANDERSNATCH_PARAMS.CURVE_ORDER,
)
console.log('cFromProof padded (hex):', bytesToHex(cFromProofPadded))
console.log('cFromProof padded as little-endian (reduced):', cFromProofPaddedAsLittleEndianReduced.toString(16))
console.log('expectedC:', expectedCBigInt.toString(16))
console.log('Match?', cFromProofPaddedAsLittleEndianReduced === expectedCBigInt)

