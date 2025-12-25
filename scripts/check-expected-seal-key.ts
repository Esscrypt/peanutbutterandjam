import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeSafrole, decodeActiveSet } from '@pbnjam/codec'
import { ConfigService } from '../infra/node/services/config-service'

const configService = new ConfigService('tiny')
const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

// Get post-state active set
const activeSetKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x08'))
if (activeSetKeyval) {
  const [err, result] = decodeActiveSet(hexToBytes(activeSetKeyval.value), configService)
  if (!err && result) {
    console.log('=== Post-State Active Set (validator BS keys) ===')
    for (let i = 0; i < result.value.length; i++) {
      console.log(`  [${i}]: ${result.value[i].bandersnatch.slice(0, 20)}...`)
    }
    
    // Block 180's author_index is 5
    console.log(`\nValidator at authorIndex 5: ${result.value[5]?.bandersnatch}`)
  }
}

// Get post-state seal keys
const safroleKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))
if (safroleKeyval) {
  const [err, result] = decodeSafrole(hexToBytes(safroleKeyval.value), configService)
  if (!err && result) {
    console.log('\n=== Post-State Seal Keys ===')
    for (let i = 0; i < Math.min(3, result.value.sealTickets.length); i++) {
      const key = result.value.sealTickets[i]
      if (key instanceof Uint8Array) {
        console.log(`  [${i}]: ${bytesToHex(key)}`)
      }
    }
    
    // Phase 0
    const phase0Key = result.value.sealTickets[0]
    if (phase0Key instanceof Uint8Array) {
      console.log(`\nSeal key at phase 0: ${bytesToHex(phase0Key)}`)
    }
  }
}
