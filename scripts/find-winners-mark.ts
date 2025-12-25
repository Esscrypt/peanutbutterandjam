import { readFileSync } from 'node:fs'

// Check when winnersMark appears in the first 200 blocks
console.log('=== Blocks with tickets_mark (winnersMark) ===')
for (let blockNum = 1; blockNum <= 200; blockNum++) {
  try {
    const filename = `submodules/jam-test-vectors/traces/fuzzy/${blockNum.toString().padStart(8, '0')}.json`
    const block = JSON.parse(readFileSync(filename, 'utf-8'))
    const ticketsMark = block.block.header.tickets_mark
    
    if (ticketsMark && ticketsMark.length > 0) {
      const slot = block.block.header.slot
      const epoch = Math.floor(slot / 12)
      const phase = slot % 12
      console.log(`Block ${blockNum}: slot ${slot}, epoch ${epoch}, phase ${phase} - ${ticketsMark.length} tickets`)
    }
  } catch (err) {
    break
  }
}
