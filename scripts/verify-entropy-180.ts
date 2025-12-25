import { readFileSync } from 'node:fs'
import { hexToBytes } from '@pbnjam/core'
import { decodeEntropy } from '@pbnjam/codec'

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

console.log('=== Block 180 Post-State Entropy (Chapter 6) ===')
const entropyKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
if (entropyKeyval) {
  const [err, result] = decodeEntropy(hexToBytes(entropyKeyval.value))
  if (!err && result) {
    console.log('  accumulator:', result.value.accumulator)
    console.log('  entropy1:', result.value.entropy1)
    console.log('  entropy2:', result.value.entropy2)
    console.log('  entropy3:', result.value.entropy3)
  }
  console.log('\nRaw value:', entropyKeyval.value)
}
