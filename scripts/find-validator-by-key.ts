import { readFileSync } from 'node:fs'

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

// Find validator with key 0x151e... in the post-state active set (key 0x08)
const activeSetKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x08'))
if (activeSetKeyval) {
  // Active set is encoded as sequence of validators
  // Each validator has: bandersnatch (32) + ed25519 (32) + bls (144) + metadata (128) = 336 bytes
  const data = Buffer.from(activeSetKeyval.value.slice(2), 'hex')
  const validatorSize = 336
  const numValidators = data.length / validatorSize
  
  console.log(`=== Post-State Active Set (${numValidators} validators) ===`)
  for (let i = 0; i < numValidators; i++) {
    const offset = i * validatorSize
    const bsKey = data.slice(offset, offset + 32)
    const bsKeyHex = '0x' + bsKey.toString('hex')
    console.log(`  [${i}]: ${bsKeyHex}`)
  }
  
  // Find which validator has 0x151e...
  console.log('\nLooking for 0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b:')
  for (let i = 0; i < numValidators; i++) {
    const offset = i * validatorSize
    const bsKey = data.slice(offset, offset + 32)
    const bsKeyHex = '0x' + bsKey.toString('hex')
    if (bsKeyHex === '0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b') {
      console.log(`  Found at index ${i}`)
    }
  }
}
