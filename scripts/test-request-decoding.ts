import { decodeNatural, decodeVariableSequence } from '@pbnjam/codec'
import { hexToBytes } from '@pbnjam/core'
import { safeError, safeResult } from '@pbnjam/types'

const value =
  '0xef5752d8d31a91a8b233c11eea45a42cd581a6fb1ccb48d67a422b2c5cff6db6'
const valueBytes = hexToBytes(value)

console.log('Value length:', valueBytes.length, 'bytes')
console.log('')

// Try to decode as variable sequence (what determineKeyType does)
const [requestError, requestResult] = decodeVariableSequence<bigint>(
  valueBytes,
  (data) => {
    if (data.length < 4) {
      return safeError(new Error('Insufficient data for timeslot'))
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const timeslot = BigInt(view.getUint32(0, true)) // little-endian
    return safeResult({
      value: timeslot,
      remaining: data.slice(4),
      consumed: 4,
    })
  },
)

if (requestError) {
  console.log('❌ Request decoding error:', requestError.message)
} else {
  console.log('✅ Request decoding succeeded')
  console.log('  Decoded timeslots:', requestResult.value.length)
  console.log(
    '  Timeslots:',
    requestResult.value.map((t) => t.toString()),
  )
  console.log('  Consumed bytes:', requestResult.consumed)
  console.log('  Remaining bytes:', requestResult.remaining.length)
  console.log(
    '  Is valid request (0-3 timeslots)?',
    requestResult.value.length <= 3,
  )
}

console.log('')
console.log('First few bytes as hex:')
console.log(
  Array.from(valueBytes.slice(0, 20))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' '),
)
console.log('')

// Check what the length prefix would be
const [lengthError, lengthResult] = decodeNatural(valueBytes)
if (!lengthError && lengthResult) {
  console.log('Length prefix decoded:')
  console.log('  Length value:', lengthResult.value.toString())
  console.log('  Length prefix bytes:', lengthResult.consumed)
  console.log(
    '  Expected total bytes for',
    lengthResult.value.toString(),
    'timeslots:',
    Number(lengthResult.value) * 4,
  )
  console.log('  Actual value length:', valueBytes.length)
  console.log('  Would be valid request?', Number(lengthResult.value) <= 3)
}
