import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeSafrole } from '@pbnjam/codec'
import { ConfigService } from '../infra/node/services/config-service'

const configService = new ConfigService('tiny')

// Read block 180 post_state (expected)
const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))
const safroleKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))

// Read block 179 pre_state (what's loaded at start)
const block179 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000179.json', 'utf-8'))
const safrole179Keyval = block179.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))

console.log('=== Block 179 Pre-State (epoch 14) Seal Keys ===')
if (safrole179Keyval) {
  const data = hexToBytes(safrole179Keyval.value)
  const [err, result] = decodeSafrole(data, configService)
  if (!err && result) {
    console.log('Seal keys:')
    for (let i = 0; i < result.value.sealTickets.length; i++) {
      const key = result.value.sealTickets[i]
      if (key instanceof Uint8Array) {
        console.log(`  [${i}]: ${bytesToHex(key)}`)
      }
    }
  }
}

console.log('\n=== Block 180 Post-State (epoch 15) Seal Keys ===')
if (safroleKeyval) {
  const data = hexToBytes(safroleKeyval.value)
  const [err, result] = decodeSafrole(data, configService)
  if (!err && result) {
    console.log('Seal keys:')
    for (let i = 0; i < result.value.sealTickets.length; i++) {
      const key = result.value.sealTickets[i]
      if (key instanceof Uint8Array) {
        console.log(`  [${i}]: ${bytesToHex(key)}`)
      }
    }
  }
}

// Check if they're the same
console.log('\n=== Are epoch 14 and epoch 15 seal keys the same? ===')
const data179 = hexToBytes(safrole179Keyval.value)
const data180 = hexToBytes(safroleKeyval.value)
const [err179, result179] = decodeSafrole(data179, configService)
const [err180, result180] = decodeSafrole(data180, configService)
if (result179 && result180) {
  const keys179 = result179.value.sealTickets.map((k: any) => k instanceof Uint8Array ? bytesToHex(k) : JSON.stringify(k))
  const keys180 = result180.value.sealTickets.map((k: any) => k instanceof Uint8Array ? bytesToHex(k) : JSON.stringify(k))
  const same = keys179.join(',') === keys180.join(',')
  console.log(`Same? ${same}`)
}
