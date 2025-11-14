/**
 * Test decoding service stats from the hex
 */

import { hexToBytes } from '@pbnj/core'
import { decodeActivity } from '@pbnj/codec'
import { ConfigService } from '../../services/config-service'

const hex = '0x010000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000810e9f1d000000000000000001000000000000019f1d0000000001a710'

const configService = new ConfigService('tiny')

// Convert hex to bytes
const bytes = hexToBytes(hex)

// Decode activity
const [error, result] = decodeActivity(bytes, configService)

if (error) {
  console.error('Error decoding activity:', error.message)
  process.exit(1)
}

console.log('Decoded Activity:')
console.log('==================\n')
console.log('Service Stats Count:', result.value.serviceStats.size)
console.log('Service Stats:', JSON.stringify(
  Array.from(result.value.serviceStats.entries()).map(([id, stats]) => ({
    serviceId: id.toString(),
    stats,
  })),
  (_, v) => typeof v === 'bigint' ? v.toString() : v === undefined ? null : v,
  2
))

console.log('\nRemaining bytes:', result.remaining.length)
if (result.remaining.length > 0) {
  console.log('Remaining hex:', Array.from(result.remaining).map(b => b.toString(16).padStart(2, '0')).join(''))
}


