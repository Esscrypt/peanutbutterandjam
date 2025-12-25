import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeEntropy } from '@pbnjam/codec'

// Check key 0x06 (entropy chapter) for multiple blocks
const blocks = [0, 1, 12, 179, 180]

console.log('=== Chapter 6 (Entropy) Values ===')
for (const blockNum of blocks) {
  try {
    const filename = blockNum === 0 
      ? 'submodules/jam-test-vectors/traces/fuzzy/genesis.json'
      : `submodules/jam-test-vectors/traces/fuzzy/${blockNum.toString().padStart(8, '0')}.json`
    
    const block = JSON.parse(readFileSync(filename, 'utf-8'))
    const state = blockNum === 0 ? block.state : block.pre_state
    
    // Find key 0x06 (entropy)
    const entropyKeyval = state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
    
    if (entropyKeyval) {
      const data = hexToBytes(entropyKeyval.value)
      const [error, result] = decodeEntropy(data)
      
      if (!error && result) {
        const e = result.value
        console.log(`\nBlock ${blockNum.toString().padStart(3)} pre-state entropy (key 0x06):`)
        console.log(`  accumulator: ${e.accumulator.slice(0, 30)}...`)
        console.log(`  entropy1:    ${e.entropy1.slice(0, 30)}...`)
        console.log(`  entropy2:    ${e.entropy2.slice(0, 30)}...`)
        console.log(`  entropy3:    ${e.entropy3.slice(0, 30)}...`)
      }
    }
  } catch (err) {
    console.log(`Block ${blockNum}: Could not read`)
  }
}
