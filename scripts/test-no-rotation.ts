// Test what seal keys F() produces with the non-rotated entropy
import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { generateFallbackKeySequence } from '@pbnjam/safrole'
import { ConfigService } from '../infra/node/services/config-service'
import { ValidatorSetManager } from '../infra/node/services/validator-set'
import { EventBusService } from '@pbnjam/core'
import { SealKeyService } from '../infra/node/services/seal-key'
import { EntropyService } from '../infra/node/services/entropy'
import { TicketService } from '../infra/node/services/ticket-service'
import { ClockService } from '../infra/node/services/clock-service'

const configService = new ConfigService('tiny')
const eventBusService = new EventBusService()

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

// Get pre-state active set (key 0x08)
const activeSetKeyval = block180.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x08'))
const activeSetData = Buffer.from(activeSetKeyval.value.slice(2), 'hex')
const validatorSize = 336
const numValidators = activeSetData.length / validatorSize

// Extract BS keys
const bsKeys: Uint8Array[] = []
for (let i = 0; i < numValidators; i++) {
  const offset = i * validatorSize
  bsKeys.push(activeSetData.slice(offset, offset + 32))
}

console.log('=== Active Set BS Keys ===')
for (let i = 0; i < bsKeys.length; i++) {
  console.log(`  [${i}]: ${bytesToHex(bsKeys[i]).slice(0, 20)}...`)
}

// Test F() with pre-rotation entropy2
const preRotationEntropy2 = hexToBytes('0x24dba7e9e0893727698a68ba12ae16ebd476e09cf676c1e863008be8c7906b1f')
console.log('\n=== F() with pre-rotation entropy2 (0x24dba7e9...) ===')

// Create a mock validator set manager
const mockValidatorSetManager = {
  getActiveValidators: () => {
    const map = new Map()
    for (let i = 0; i < bsKeys.length; i++) {
      map.set(i, { bandersnatch: bytesToHex(bsKeys[i]) })
    }
    return map
  }
}

const [err1, keys1] = generateFallbackKeySequence(
  preRotationEntropy2,
  mockValidatorSetManager as any,
  configService
)

if (!err1 && keys1) {
  console.log('Generated seal keys:')
  for (let i = 0; i < Math.min(6, keys1.length); i++) {
    console.log(`  [${i}]: ${bytesToHex(keys1[i])}`)
  }
}

// Test F() with post-rotation entropy2 (= old entropy1)
const postRotationEntropy2 = hexToBytes('0xc203541dc20ce00cbb5ca6acb5f831e961cd4578e5628e3e372c2e44d52eae8e')
console.log('\n=== F() with post-rotation entropy2 (0xc203541dc...) ===')

const [err2, keys2] = generateFallbackKeySequence(
  postRotationEntropy2,
  mockValidatorSetManager as any,
  configService
)

if (!err2 && keys2) {
  console.log('Generated seal keys:')
  for (let i = 0; i < Math.min(6, keys2.length); i++) {
    console.log(`  [${i}]: ${bytesToHex(keys2[i])}`)
  }
}

// Show expected seal keys from post-state
console.log('\n=== Expected seal keys (from post-state) ===')
import { decodeSafrole } from '@pbnjam/codec'
const safroleKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))
const [err3, result] = decodeSafrole(hexToBytes(safroleKeyval.value), configService)
if (!err3 && result) {
  for (let i = 0; i < Math.min(6, result.value.sealTickets.length); i++) {
    const key = result.value.sealTickets[i]
    if (key instanceof Uint8Array) {
      console.log(`  [${i}]: ${bytesToHex(key)}`)
    }
  }
}
