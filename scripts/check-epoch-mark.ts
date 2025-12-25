import { readFileSync } from 'node:fs'

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

console.log('=== Block 180 Epoch Mark ===')
const epochMark = block180.block.header.epoch_mark
if (epochMark) {
  console.log(`entropyAccumulator (entropy): ${epochMark.entropy}`)
  console.log(`ticketsEntropy (tickets_entropy): ${epochMark.tickets_entropy}`)
  console.log(`validators count: ${epochMark.validators?.length ?? 0}`)
} else {
  console.log('No epoch mark')
}
