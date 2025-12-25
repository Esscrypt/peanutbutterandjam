import { readFileSync } from 'node:fs'

const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

// Check pre and post state active sets
for (const [label, keyvals] of [['Pre-state', block180.pre_state.keyvals], ['Post-state', block180.post_state.keyvals]]) {
  const activeSetKeyval = keyvals.find((kv: any) => kv.key.startsWith('0x08'))
  if (activeSetKeyval) {
    const data = Buffer.from(activeSetKeyval.value.slice(2), 'hex')
    const validatorSize = 336
    const numValidators = data.length / validatorSize
    
    console.log(`\n=== ${label} Active Set ===`)
    for (let i = 0; i < numValidators; i++) {
      const offset = i * validatorSize
      const bsKey = data.slice(offset, offset + 32)
      console.log(`  [${i}]: ${bsKey.toString('hex').slice(0, 20)}...`)
    }
  }
}
