import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeEntropy } from '@pbnjam/codec'

const block179 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000179.json', 'utf-8'))

// Get key 0x02
const key02 = block179.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x02'))
// Get key 0x06
const key06 = block179.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))

if (key02) {
  console.log('=== Key 0x02 Analysis ===')
  console.log(`Key: ${key02.key}`)
  console.log(`Value length: ${(key02.value.length - 2) / 2} bytes`)
  
  const data02 = hexToBytes(key02.value)
  console.log(`\nFirst 128 bytes (4 x 32-byte hashes):`)
  for (let i = 0; i < 4; i++) {
    console.log(`  [${i}]: ${bytesToHex(data02.slice(i * 32, (i + 1) * 32))}`)
  }
  
  // Try decoding as entropy
  const [entropyError, entropyResult] = decodeEntropy(data02)
  if (!entropyError && entropyResult) {
    console.log('\n✅ Decoded as ENTROPY successfully!')
    console.log(`  accumulator: ${entropyResult.value.accumulator}`)
    console.log(`  entropy1: ${entropyResult.value.entropy1}`)
    console.log(`  entropy2: ${entropyResult.value.entropy2}`)
    console.log(`  entropy3: ${entropyResult.value.entropy3}`)
  }
}

if (key06) {
  console.log('\n\n=== Key 0x06 Analysis ===')
  console.log(`Key: ${key06.key}`)
  console.log(`Value length: ${(key06.value.length - 2) / 2} bytes`)
  
  const data06 = hexToBytes(key06.value)
  console.log(`\nFirst 128 bytes (4 x 32-byte hashes):`)
  for (let i = 0; i < Math.min(4, Math.floor(data06.length / 32)); i++) {
    console.log(`  [${i}]: ${bytesToHex(data06.slice(i * 32, (i + 1) * 32))}`)
  }
}

console.log('\n\n=== Conclusion ===')
console.log('If key 0x02 contains 4 identical 32-byte hashes, it is likely ENTROPY stored in the wrong chapter!')
console.log('The StateService expects:')
console.log('  - Chapter 2 (0x02) = authqueue')
console.log('  - Chapter 6 (0x06) = entropy')
console.log('But the test vector may use a different numbering!')
