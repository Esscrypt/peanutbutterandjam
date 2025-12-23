import { decodeVariableSequence } from '@pbnjam/codec'
import { hexToBytes } from '@pbnjam/core'
import { safeError, safeResult } from '@pbnjam/types'

const key = '0x0001007100a000ab5cbd7e82c9744baf137918fe8d08741476a397e9dc2884'
const value =
  '0xef5752d8d31a91a8b233c11eea45a42cd581a6fb1ccb48d67a422b2c5cff6db6'

console.log('Testing specific key-value pair:')
console.log('Key:', key)
console.log('Value:', value)
console.log('')

const valueBytes = hexToBytes(value)
console.log('Value length:', valueBytes.length, 'bytes')
console.log('')

// Try to decode as request (what determineKeyType does)
console.log('Step 1: Attempting to decode as request...')
const [requestError, requestResult] = decodeVariableSequence<bigint>(
  valueBytes,
  (data) => {
    if (data.length < 4) {
      return safeError(new Error('Insufficient data for timeslot'))
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const timeslot = BigInt(view.getUint32(0, true))
    return safeResult({
      value: timeslot,
      remaining: data.slice(4),
      consumed: 4,
    })
  },
)

if (requestError) {
  console.log('❌ Request decoding FAILED:', requestError.message)
  console.log('   → This is NOT a request')
  console.log('   → Moving to next check (preimage/storage)')
} else {
  console.log('✅ Request decoding SUCCEEDED')
  console.log('   Timeslots decoded:', requestResult.value.length)
  console.log('   Length check (<=3)?', requestResult.value.length <= 3)
  if (requestResult.value.length <= 3) {
    console.log('   ⚠️  WOULD be identified as REQUEST!')
  } else {
    console.log('   → Too many timeslots, NOT a request')
  }
}

console.log('')
console.log('Conclusion:')
if (requestError) {
  console.log('This key-value pair is NOT identified as a request.')
  console.log('The determineKeyType function correctly rejects it.')
} else if (requestResult.value.length > 3) {
  console.log('This key-value pair is NOT identified as a request.')
  console.log('It decodes as a sequence but has too many timeslots (>3).')
} else {
  console.log('⚠️  This key-value pair WOULD be identified as a request!')
  console.log('This might be a false positive.')
}


