import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeSafrole } from '@pbnjam/codec'
import { ConfigService } from '../infra/node/services/config-service'

const configService = new ConfigService('tiny')
const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

console.log('Block 180 header:')
console.log(`  slot: ${block180.block.header.slot}`)
console.log(`  author_index: ${block180.block.header.author_index}`)
console.log(`  phase: ${block180.block.header.slot % 12}`)

// Get post-state seal keys
const safroleKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))
if (safroleKeyval) {
  const [err, result] = decodeSafrole(hexToBytes(safroleKeyval.value), configService)
  if (!err && result) {
    console.log('\n=== Post-State Seal Keys ===')
    for (let i = 0; i < result.value.sealTickets.length; i++) {
      const key = result.value.sealTickets[i]
      if (key instanceof Uint8Array) {
        console.log(`  [${i}]: ${bytesToHex(key)}`)
      }
    }
  }
}

// The seal key validation checks that seal key at phase == validator BS key at authorIndex
// So for slot 180 (phase 0), the seal key at index 0 should be the BS key of validator 5
// Let's see what key validator 5 has - it should be 0x2105...
console.log('\n=== Expected ===')
console.log('For block 180 to validate:')
console.log('  - Phase 0 seal key should match validator 5 BS key')
console.log('  - Error says validator 5 BS key is: 0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e')
console.log('  - But our phase 0 seal key is: 0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b')
