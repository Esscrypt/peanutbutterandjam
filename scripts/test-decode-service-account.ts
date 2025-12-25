import { hexToBytes } from '@pbnjam/core'
import { decodeServiceAccount } from '../packages/codec/src/state/service-account'

const hex =
  '0xd1b097b4410b3a63446d7c57d093972a9744fcd2d74f4a5e2ec163610e6d6327ffffffffffffffff00000000000000000a000000000000000a00000000000000341802000000000004000000ffffffffffffffff000000000000000000000000'
const bytes = hexToBytes(hex)
const first89 = bytes.slice(0, 89)

console.log('Testing decodeServiceAccount with different JAM versions:')
console.log('Hex length:', bytes.length, 'bytes')
console.log('First 89 bytes length:', first89.length)
console.log('First byte:', '0x' + first89[0].toString(16).padStart(2, '0'))
console.log('')

// Test with JAM 0.7.0
console.log('=== JAM 0.7.0 ===')
try {
  const [error070, result070] = decodeServiceAccount(first89, {
    major: 0,
    minor: 7,
    patch: 0,
  })
  if (error070) {
    console.log('ERROR:', error070.message)
  } else {
    console.log('SUCCESS')
    console.log('  Codehash:', result070.value.codehash)
    console.log('  Balance:', result070.value.balance.toString())
    console.log('  MinAccGas:', result070.value.minaccgas.toString())
    console.log('  MinMemoGas:', result070.value.minmemogas.toString())
    console.log('  Octets:', result070.value.octets.toString())
    console.log('  Gratis:', result070.value.gratis.toString())
    console.log('  Items:', result070.value.items.toString())
    console.log('  Created:', result070.value.created.toString())
    console.log('  LastAcc:', result070.value.lastacc.toString())
    console.log('  Parent:', result070.value.parent.toString())
    console.log('  Remaining bytes:', result070.remaining.length)
  }
} catch (e) {
  console.log('EXCEPTION:', e instanceof Error ? e.message : String(e))
}

console.log('')

// Test with JAM 0.7.1
console.log('=== JAM 0.7.1 ===')
try {
  const [error071, result071] = decodeServiceAccount(first89, {
    major: 0,
    minor: 7,
    patch: 1,
  })
  if (error071) {
    console.log('ERROR:', error071.message)
  } else {
    console.log('SUCCESS')
    console.log('  Codehash:', result071.value.codehash)
    console.log('  Balance:', result071.value.balance.toString())
    console.log('  MinAccGas:', result071.value.minaccgas.toString())
    console.log('  MinMemoGas:', result071.value.minmemogas.toString())
    console.log('  Octets:', result071.value.octets.toString())
    console.log('  Gratis:', result071.value.gratis.toString())
    console.log('  Items:', result071.value.items.toString())
    console.log('  Created:', result071.value.created.toString())
    console.log('  LastAcc:', result071.value.lastacc.toString())
    console.log('  Parent:', result071.value.parent.toString())
    console.log('  Remaining bytes:', result071.remaining.length)
  }
} catch (e) {
  console.log('EXCEPTION:', e instanceof Error ? e.message : String(e))
}

console.log('')

// Test with JAM 0.7.2
console.log('=== JAM 0.7.2 ===')
try {
  const [error072, result072] = decodeServiceAccount(first89, {
    major: 0,
    minor: 7,
    patch: 2,
  })
  if (error072) {
    console.log('ERROR:', error072.message)
  } else {
    console.log('SUCCESS')
    console.log('  Codehash:', result072.value.codehash)
    console.log('  Balance:', result072.value.balance.toString())
    console.log('  MinAccGas:', result072.value.minaccgas.toString())
    console.log('  MinMemoGas:', result072.value.minmemogas.toString())
    console.log('  Octets:', result072.value.octets.toString())
    console.log('  Gratis:', result072.value.gratis.toString())
    console.log('  Items:', result072.value.items.toString())
    console.log('  Created:', result072.value.created.toString())
    console.log('  LastAcc:', result072.value.lastacc.toString())
    console.log('  Parent:', result072.value.parent.toString())
    console.log('  Remaining bytes:', result072.remaining.length)
  }
} catch (e) {
  console.log('EXCEPTION:', e instanceof Error ? e.message : String(e))
}

console.log('')

// Also test with 0x00 as first byte (corrected version)
console.log('=== Testing with corrected first byte (0x00) ===')
const correctedBytes = new Uint8Array(first89)
correctedBytes[0] = 0x00

console.log('JAM 0.7.0 with corrected byte:')
const [error070Corr, result070Corr] = decodeServiceAccount(correctedBytes, {
  major: 0,
  minor: 7,
  patch: 0,
})
if (error070Corr) {
  console.log('ERROR:', error070Corr.message)
} else {
  console.log('SUCCESS - Balance:', result070Corr.value.balance.toString())
}

console.log('JAM 0.7.1 with corrected byte:')
const [error071Corr, result071Corr] = decodeServiceAccount(correctedBytes, {
  major: 0,
  minor: 7,
  patch: 1,
})
if (error071Corr) {
  console.log('ERROR:', error071Corr.message)
} else {
  console.log('SUCCESS - Balance:', result071Corr.value.balance.toString())
}

console.log('JAM 0.7.2 with corrected byte:')
const [error072Corr, result072Corr] = decodeServiceAccount(correctedBytes, {
  major: 0,
  minor: 7,
  patch: 2,
})
if (error072Corr) {
  console.log('ERROR:', error072Corr.message)
} else {
  console.log('SUCCESS - Balance:', result072Corr.value.balance.toString())
}

