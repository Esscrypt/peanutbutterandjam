import { readFileSync } from 'node:fs'
import { hexToBytes } from '@pbnjam/core'
import { decodeEntropy } from '@pbnjam/codec'

const blocks = [179, 180]

for (const blockNum of blocks) {
  const block = JSON.parse(readFileSync(`submodules/jam-test-vectors/traces/fuzzy/${blockNum.toString().padStart(8, '0')}.json`, 'utf-8'))
  
  console.log(`\n=== Block ${blockNum} ===`)
  console.log(`Slot: ${block.block.header.slot}, Epoch: ${Math.floor(block.block.header.slot / 12)}`)
  console.log(`epoch_mark: ${block.block.header.epoch_mark ? 'present' : 'null'}`)
  
  const entropyPre = block.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
  const entropyPost = block.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
  
  if (entropyPre) {
    const [err, result] = decodeEntropy(hexToBytes(entropyPre.value))
    if (!err && result) {
      console.log('Pre-state:')
      console.log(`  accumulator: ${result.value.accumulator.slice(0, 30)}...`)
      console.log(`  entropy1: ${result.value.entropy1.slice(0, 30)}...`)
      console.log(`  entropy2: ${result.value.entropy2.slice(0, 30)}...`)
      console.log(`  entropy3: ${result.value.entropy3.slice(0, 30)}...`)
    }
  }
  
  if (entropyPost) {
    const [err, result] = decodeEntropy(hexToBytes(entropyPost.value))
    if (!err && result) {
      console.log('Post-state:')
      console.log(`  accumulator: ${result.value.accumulator.slice(0, 30)}...`)
      console.log(`  entropy1: ${result.value.entropy1.slice(0, 30)}...`)
      console.log(`  entropy2: ${result.value.entropy2.slice(0, 30)}...`)
      console.log(`  entropy3: ${result.value.entropy3.slice(0, 30)}...`)
    }
  }
}
