import { readFileSync } from 'node:fs'
import { hexToBytes } from './packages/core/src/index.ts'
import { decodeProgram } from './packages/serialization/src/pvm/blob.ts'

const testVector = JSON.parse(
  readFileSync(
    'submodules/jam-test-vectors/stf/accumulate/tiny/enqueue_and_unlock_chain_wraps-1.json',
    'utf-8',
  ),
)
const blobHex = testVector.pre_state.accounts[0].data.preimages_blob[0].blob
const blobBytes = hexToBytes(blobHex)

console.log('=== Verifying decodeProgram after removing metadata ===')
console.log('')
console.log('Gray Paper accounts.tex equation 42-43:')
console.log('  encode(var(m), c) = encode(len(m)) || encode(m) || encode(c)')
console.log('')
console.log('Total preimage blob:', blobBytes.length, 'bytes')
console.log('')

// Step 1: Decode metadata length
import { decodeNatural } from './packages/serialization/src/core/natural-number.ts'

const [lenErr, lenResult] = decodeNatural(blobBytes)
if (lenErr) {
  console.error('❌ Failed to decode metadata length:', lenErr.message)
  process.exit(1)
}

const metadataLength = Number(lenResult.value)
const lengthEncodingBytes = lenResult.consumed

console.log('Step 1: Metadata extraction')
console.log('  Metadata length encoding:', lengthEncodingBytes, 'bytes')
console.log('  Metadata length:', metadataLength, 'bytes')
console.log(
  '  Total metadata prefix:',
  lengthEncodingBytes + metadataLength,
  'bytes',
)
console.log('')

// Step 2: Remove metadata prefix (first 72 bytes: 1 + 71)
const metadataPrefixSize = lengthEncodingBytes + metadataLength
const codeBlob = blobBytes.slice(metadataPrefixSize)

console.log('Step 2: Remaining code blob after metadata')
console.log('  Code blob size:', codeBlob.length, 'bytes')
console.log(
  '  First 20 bytes (hex):',
  Array.from(codeBlob.slice(0, 20))
    .map((b) => '0x' + b.toString(16).padStart(2, '0'))
    .join(' '),
)
console.log('')

// Step 3: Attempt decodeProgram
console.log('Step 3: Attempting decodeProgram...')
console.log('')
console.log('decodeProgram expects Y function format:')
console.log('  E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c')
console.log(
  '  Where E₃ means 3-byte big-endian, E₂ means 2-byte, E₄ means 4-byte',
)
console.log('')

const [error, result] = decodeProgram(codeBlob)

if (error) {
  console.log('❌ decodeProgram FAILED:', error.message)
  console.log('')
  console.log('This means the code blob is NOT in Y function format.')
  console.log('It might be in deblob format instead.')
  console.log('')

  // Check what the first bytes look like
  if (codeBlob.length >= 3) {
    const roDataLength = (codeBlob[0] << 16) | (codeBlob[1] << 8) | codeBlob[2]
    console.log('First 3 bytes decoded as roDataLength:', roDataLength)
    if (roDataLength > codeBlob.length) {
      console.log(
        '  This is larger than the remaining blob size, so not valid.',
      )
    }
  }

  process.exit(1)
}

console.log('✅ decodeProgram SUCCEEDED!')
console.log('')
console.log('Decoded structure (Y function format):')
console.log('  Read-only data (roData):', result.value.roDataLength, 'bytes')
console.log('  Read-write data (rwData):', result.value.rwDataLength, 'bytes')
console.log(
  '  Jump table entry size (z):',
  result.value.jumpTableEntrySize,
  'bytes',
)
console.log('  Stack size (s):', result.value.stackSize, 'bytes')
console.log('  Code length:', result.value.codeSize, 'bytes')
console.log('  Total consumed:', result.consumed, 'bytes')
console.log('  Remaining:', result.remaining.length, 'bytes')
console.log('')
console.log(
  '✅ Verification successful: The code blob after metadata is in Y function format!',
)
console.log('')
console.log('Summary:')
console.log('  - Metadata prefix removed:', metadataPrefixSize, 'bytes')
console.log('  - Code blob decoded successfully using decodeProgram')
console.log(
  '  - Format confirmed: Y function format (E₃(|o|) || E₃(|w|) || ...)',
)
