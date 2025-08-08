import { generateAlternativeName } from './crypto/certificates'

const expectedPublicKey = '3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29'
const testPublicKey = Buffer.from(expectedPublicKey, 'hex')

// Debug the deserialization process
let keyInt = 0n
for (let i = 0; i < 32; i++) {
  keyInt |= BigInt(testPublicKey[i]) << BigInt(8 * i)
}

console.log('Public key (hex):', expectedPublicKey)
console.log('Deserialized integer:', keyInt.toString())
console.log('Deserialized integer (hex):', keyInt.toString(16))

// Base32 alphabet: $abcdefghijklmnopqrstuvwxyz234567
const base32Alphabet = '$abcdefghijklmnopqrstuvwxyz234567'

// Convert to base32 (52 characters)
let result = ''
let remaining = keyInt

for (let i = 0; i < 52; i++) {
  const digit = Number(remaining % 32n)
  result = base32Alphabet[digit] + result
  remaining = remaining / 32n
}

console.log('Base32 result:', result)
console.log('Final alternative name: $e' + result)

const alternativeName = generateAlternativeName(testPublicKey)
console.log('Generated alternative name:', alternativeName)
console.log('Match:', alternativeName === '$e' + result) 