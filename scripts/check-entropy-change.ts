import { readFileSync } from 'node:fs'
import { hexToBytes } from '@pbnjam/core'
import { decodeEntropy } from '@pbnjam/codec'

// Block 179 pre_state (before epoch transition)
const block179 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000179.json', 'utf-8'))

// Block 180 pre_state (right before block 180, after epoch transition from 179)
const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

console.log('=== Block 179 Pre-State (epoch 14, before block 179) ===')
const entropy179 = block179.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
if (entropy179) {
  const [err, result] = decodeEntropy(hexToBytes(entropy179.value))
  if (!err && result) {
    console.log(`entropy1: ${result.value.entropy1}`)
    console.log(`entropy2: ${result.value.entropy2}`)
  }
}

console.log('\n=== Block 180 Pre-State (epoch 15, after epoch transition) ===')
const entropy180 = block180.pre_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
if (entropy180) {
  const [err, result] = decodeEntropy(hexToBytes(entropy180.value))
  if (!err && result) {
    console.log(`entropy1: ${result.value.entropy1}`)
    console.log(`entropy2: ${result.value.entropy2}`)
  }
}

console.log('\n=== Block 180 Post-State (after block 180) ===')
const entropy180post = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x06'))
if (entropy180post) {
  const [err, result] = decodeEntropy(hexToBytes(entropy180post.value))
  if (!err && result) {
    console.log(`entropy1: ${result.value.entropy1}`)
    console.log(`entropy2: ${result.value.entropy2}`)
  }
}
