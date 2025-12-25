import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeSafrole } from '@pbnjam/codec'
import { ConfigService } from '../infra/node/services/config-service'

const configService = new ConfigService('tiny')

const blocks = [178, 179, 180]
for (const blockNum of blocks) {
  const block = JSON.parse(readFileSync(`submodules/jam-test-vectors/traces/fuzzy/${blockNum.toString().padStart(8, '0')}.json`, 'utf-8'))
  const slot = block.block.header.slot
  const epoch = Math.floor(slot / 12)
  
  console.log(`\n=== Block ${blockNum} (slot ${slot}, epoch ${epoch}) ===`)
  console.log(`  author_index: ${block.block.header.author_index}`)
  console.log(`  phase: ${slot % 12}`)
  
  const safroleKeyval = block.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))
  if (safroleKeyval) {
    const [err, result] = decodeSafrole(hexToBytes(safroleKeyval.value), configService)
    if (!err && result) {
      console.log('  Pre-state seal keys [0-2]:')
      for (let i = 0; i < 3; i++) {
        const key = result.value.sealTickets[i]
        if (key instanceof Uint8Array) {
          console.log(`    [${i}]: ${bytesToHex(key).slice(0, 20)}...`)
        }
      }
    }
  }
}
