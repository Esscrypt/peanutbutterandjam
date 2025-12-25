import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeSafrole } from '@pbnjam/codec'
import { ConfigService } from '../infra/node/services/config-service'

const configService = new ConfigService('tiny')

// Block 179 pre_state (epoch 14 seal keys)
const block179 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000179.json', 'utf-8'))
const safrole179pre = block179.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))

// Block 180 post_state (epoch 15 seal keys - expected after epoch transition)
const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))
const safrole180post = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))

console.log('=== Epoch 14 Seal Keys (block 179 pre-state) ===')
const [err1, result1] = decodeSafrole(hexToBytes(safrole179pre.value), configService)
if (!err1 && result1) {
  for (let i = 0; i < result1.value.sealTickets.length; i++) {
    const key = result1.value.sealTickets[i]
    if (key instanceof Uint8Array) {
      console.log(`  [${i}]: ${bytesToHex(key).slice(0, 20)}...`)
    }
  }
}

console.log('\n=== Epoch 15 Seal Keys (block 180 post-state) ===')
const [err2, result2] = decodeSafrole(hexToBytes(safrole180post.value), configService)
if (!err2 && result2) {
  for (let i = 0; i < result2.value.sealTickets.length; i++) {
    const key = result2.value.sealTickets[i]
    if (key instanceof Uint8Array) {
      console.log(`  [${i}]: ${bytesToHex(key).slice(0, 20)}...`)
    }
  }
}

// Check if order changed
console.log('\n=== Same order? ===')
if (result1 && result2) {
  for (let i = 0; i < 12; i++) {
    const k1 = result1.value.sealTickets[i]
    const k2 = result2.value.sealTickets[i]
    const h1 = k1 instanceof Uint8Array ? bytesToHex(k1) : 'n/a'
    const h2 = k2 instanceof Uint8Array ? bytesToHex(k2) : 'n/a'
    if (h1 !== h2) {
      console.log(`  [${i}]: DIFFERENT! ${h1.slice(0,20)}... vs ${h2.slice(0,20)}...`)
    } else {
      console.log(`  [${i}]: same`)
    }
  }
}
