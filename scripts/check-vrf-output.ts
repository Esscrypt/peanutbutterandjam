import { readFileSync } from 'node:fs'

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

console.log('=== Block 180 VRF Signature ===')
console.log(`entropy_source (vrf_sig): ${block180.block.header.entropy_source}`)
console.log(`slot: ${block180.block.header.slot}`)

// Check if VRF is all zeros
const vrfSig = block180.block.header.entropy_source
const isAllZeros = vrfSig === '0x' + '00'.repeat(96)
console.log(`Is VRF output all zeros? ${isAllZeros}`)
