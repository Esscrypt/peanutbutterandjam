import { blake2bHash, bytesToHex, hexToBytes } from '@pbnjam/core'

const key = '0x0001007100a000ab5cbd7e82c9744baf137918fe8d08741476a397e9dc2884'
const value =
  '0xef5752d8d31a91a8b233c11eea45a42cd581a6fb1ccb48d67a422b2c5cff6db6'
const blakeHashFromKey =
  '0171a0ab5cbd7e82c9744baf137918fe8d08741476a397e9dc2884'

console.log('Testing storage key verification:')
console.log('Key:', key)
console.log('Value:', value)
console.log('Hash from key (first 27 bytes):', blakeHashFromKey)
console.log('')

// Gray Paper: C(s, encode[4]{0xFFFFFFFF} ∥ k) ↦ v
// State key contains: blake(encode[4]{0xFFFFFFFF} ∥ k)
// We have the value v, but we don't know k

const valueBytes = hexToBytes(value)
const [valueHashError, valueHash] = blake2bHash(valueBytes)
if (valueHashError) throw valueHashError

console.log('1. Value:', value)
console.log('2. blake(value):', valueHash)
console.log('')

// Try k = blake(v) to see if it matches
const storagePrefix = new Uint8Array(4)
new DataView(storagePrefix.buffer).setUint32(0, 0xffffffff, true)
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

console.log(
  '3. blake(encode[4]{0xFFFFFFFF} ∥ blake(value)) (first 27 bytes):',
  storageHashHex,
)
console.log('4. Hash from key:', blakeHashFromKey)
console.log('5. Match?', storageHashHex === blakeHashFromKey)
console.log('')

if (storageHashHex !== blakeHashFromKey) {
  console.log('❌ Cannot verify: k ≠ blake(v)')
  console.log(
    '   The storage key k is arbitrary and not related to the value v',
  )
  console.log('   Gray Paper: C(s, encode[4]{0xFFFFFFFF} ∥ k) ↦ v')
  console.log('   - k is the storage key (arbitrary blob chosen by service)')
  console.log('   - v is the storage value (arbitrary blob)')
  console.log('   - k and v are independent - k is NOT blake(v)')
  console.log('   - We cannot verify storage keys without knowing k')
} else {
  console.log('✅ Can verify: k = blake(v)')
  console.log('   This would mean the storage key k equals blake(value)')
}

