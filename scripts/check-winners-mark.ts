import { readFileSync } from 'node:fs'

const blocks = [179, 180]

for (const blockNum of blocks) {
  const filename = `submodules/jam-test-vectors/traces/fuzzy/${blockNum.toString().padStart(8, '0')}.json`
  const block = JSON.parse(readFileSync(filename, 'utf-8'))
  const ticketsMark = block.block.header.tickets_mark
  
  console.log(`\nBlock ${blockNum}:`)
  console.log(`  timeslot: ${block.block.header.slot}`)
  console.log(`  epoch: ${Math.floor(block.block.header.slot / 12)}`)
  console.log(`  phase: ${block.block.header.slot % 12}`)
  console.log(`  tickets_mark (winnersMark): ${ticketsMark ? `${ticketsMark.length} tickets` : 'null'}`)
  console.log(`  epoch_mark: ${block.block.header.epoch_mark ? 'present' : 'null'}`)
}
