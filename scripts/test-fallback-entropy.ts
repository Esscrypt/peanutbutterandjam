import { blake2bHash, hexToBytes, bytesToHex } from '@pbnjam/core'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load block 168 data (first block of epoch 14 where seal keys changed)
const dataPath = join(
  __dirname,
  '../submodules/jam-test-vectors/traces/fuzzy/00000168.json',
)
const data = JSON.parse(readFileSync(dataPath, 'utf8'))

// Get validator keys from pre-state pendingSet
const preSafroleKeyval = data.pre_state.keyvals.find((kv: any) =>
  kv.key.startsWith('0x04'),
)
const preSafroleHex = preSafroleKeyval.value.slice(2)
const validatorKeys: string[] = []
for (let i = 0; i < 6; i++) {
  const start = i * 336 * 2
  validatorKeys.push(preSafroleHex.slice(start, start + 64))
}

// Get expected seal keys
const postSafroleKeyval = data.post_state.keyvals.find((kv: any) =>
  kv.key.startsWith('0x04'),
)
const postSafroleHex = postSafroleKeyval.value.slice(2)
const ticketsStart = (2016 + 144 + 1) * 2
const expectedKeys: string[] = []
for (let phase = 0; phase < 12; phase++) {
  expectedKeys.push(
    postSafroleHex.slice(ticketsStart + phase * 64, ticketsStart + (phase + 1) * 64),
  )
}

// Map expected keys back to validator indices
const expectedSequence = expectedKeys.map((k) => validatorKeys.indexOf(k))
console.log('Expected validator sequence:', expectedSequence.join(', '))

// Block 168 entropy values
const entropies = {
  pre_accumulator:
    'c203541dc20ce00cbb5ca6acb5f831e961cd4578e5628e3e372c2e44d52eae8e',
  pre_entropy1:
    '24dba7e9e0893727698a68ba12ae16ebd476e09cf676c1e863008be8c7906b1f',
  pre_entropy2:
    '501a0d0f3932a813eb6d0ce60cc00ee34bedd88cb995dba5529ce2483b874b9a',
  pre_entropy3:
    'f13b69400c25f57e822bf46cf1a033e91b4a5e5cc143cb48160728cb669bf00f',
  post_entropy2_rotated:
    '24dba7e9e0893727698a68ba12ae16ebd476e09cf676c1e863008be8c7906b1f',
}

console.log('\nTesting each entropy with proper blake2b-256:\n')

for (const [name, entropy] of Object.entries(entropies)) {
  const calculatedSequence: number[] = []

  for (let phase = 0; phase < 12; phase++) {
    const indexBytes = new Uint8Array(4)
    new DataView(indexBytes.buffer).setUint32(0, phase, true) // little-endian
    const combined = new Uint8Array(32 + 4)
    combined.set(hexToBytes(entropy as `0x${string}`), 0)
    combined.set(indexBytes, 32)

    const [error, hashHex] = blake2bHash(combined)
    if (error) {
      console.error('Hash error:', error)
      continue
    }
    const hash = hexToBytes(hashHex as `0x${string}`)
    const decodedIndex = new DataView(hash.buffer).getUint32(0, true)
    const validatorIndex = decodedIndex % 6
    calculatedSequence.push(validatorIndex)
  }

  const matches = calculatedSequence.every((v, i) => v === expectedSequence[i])
  console.log(
    `${name}: ${calculatedSequence.join(', ')} ${matches ? '✓ MATCH!' : ''}`,
  )
}

