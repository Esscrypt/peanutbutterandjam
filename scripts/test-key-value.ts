import { blake2bHash, bytesToHex, hexToBytes } from '@pbnjam/core'

const value =
  '0xef5752d8d31a91a8b233c11eea45a42cd581a6fb1ccb48d67a422b2c5cff6db6'
const valueBytes = hexToBytes(value)
const expectedHash = '0171a0ab5cbd7e82c9744baf137918fe8d08741476a397e9dc2884'

console.log('Value (32 bytes):', value)
console.log('Length:', valueBytes.length, 'bytes')
console.log('')

// Try to verify as storage: blake(encode[4]{0xFFFFFFFF} ∥ blake(value))
const storagePrefix = new Uint8Array(4)
new DataView(storagePrefix.buffer).setUint32(0, 0xffffffff, true)
const [valueHashError, valueHash] = blake2bHash(valueBytes)
if (valueHashError) throw valueHashError
const valueHashBytes = hexToBytes(valueHash)
const storageCombined = new Uint8Array(
  storagePrefix.length + valueHashBytes.length,
)
storageCombined.set(storagePrefix, 0)
storageCombined.set(valueHashBytes, storagePrefix.length)
const [storageHashError, storageHash] = blake2bHash(storageCombined)
if (storageHashError) throw storageHashError
const storageHashBytes = hexToBytes(storageHash)
const storageHashHex = bytesToHex(storageHashBytes.slice(0, 27))
console.log('Storage verification:')
console.log('  blake(value):', valueHash)
console.log(
  '  blake(0xFFFFFFFF ∥ blake(value)) (first 27 bytes):',
  storageHashHex,
)
console.log('  Expected:', expectedHash)
console.log('  Match:', storageHashHex === expectedHash)
console.log('')

// Try to verify as preimage: blake(encode[4]{0xFFFFFFFE} ∥ blake(value))
const preimagePrefix = new Uint8Array(4)
new DataView(preimagePrefix.buffer).setUint32(0, 0xfffffffe, true)
const preimageHashBytes = hexToBytes(valueHash) // Same as valueHash
const preimageCombined = new Uint8Array(
  preimagePrefix.length + preimageHashBytes.length,
)
preimageCombined.set(preimagePrefix, 0)
preimageCombined.set(preimageHashBytes, preimagePrefix.length)
const [preimageKeyHashError, preimageKeyHash] = blake2bHash(preimageCombined)
if (preimageKeyHashError) throw preimageKeyHashError
const preimageKeyHashBytes = hexToBytes(preimageKeyHash)
const preimageKeyHashHex = bytesToHex(preimageKeyHashBytes.slice(0, 27))
console.log('Preimage verification:')
console.log('  blake(value):', valueHash)
console.log(
  '  blake(0xFFFFFFFE ∥ blake(value)) (first 27 bytes):',
  preimageKeyHashHex,
)
console.log('  Expected:', expectedHash)
console.log('  Match:', preimageKeyHashHex === expectedHash)
console.log('')

// Summary
console.log('Summary:')
console.log('  - 32-byte value could be:')
console.log('    1. Storage value (arbitrary blob)')
console.log('    2. Preimage blob (actual preimage data)')
console.log('    3. NOT a request (requests are 0, 4, 8, or 12 bytes)')
console.log('    4. NOT a preimage hash (hash is in key, not value)')
console.log('')
if (storageHashHex === expectedHash) {
  console.log('✅ This is a STORAGE value')
} else if (preimageKeyHashHex === expectedHash) {
  console.log('✅ This is a PREIMAGE blob')
} else {
  console.log('❌ This does not match storage or preimage verification')
  console.log('   It may be:')
  console.log(
    '   - A storage value with a different storage key k (not blake(value))',
  )
  console.log('   - An invalid/malformed key-value pair')
  console.log('   - From a different protocol version')
}
