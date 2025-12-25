import { readFileSync } from 'node:fs'

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

console.log('=== Block 180 Header ===')
console.log(`slot: ${block180.block.header.slot}`)
console.log(`author_index: ${block180.block.header.author_index}`)
console.log(`phase (slot % 12): ${block180.block.header.slot % 12}`)
console.log(`seal sig (first 30): ${block180.block.header.seal?.slice(0, 30)}...`)
