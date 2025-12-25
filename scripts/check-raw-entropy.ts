import { readFileSync } from 'node:fs'

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

const entropyKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
const raw = entropyKeyval.value

console.log('Raw entropy keyval:')
console.log('  Length:', (raw.length - 2) / 2, 'bytes')
console.log('  First 32 bytes (accumulator):', raw.slice(2, 66))
console.log('  Next 32 bytes (entropy1):', raw.slice(66, 130))
console.log('  Next 32 bytes (entropy2):', raw.slice(130, 194))
console.log('  Next 32 bytes (entropy3):', raw.slice(194, 258))
