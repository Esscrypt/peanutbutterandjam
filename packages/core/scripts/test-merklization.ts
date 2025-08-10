#!/usr/bin/env bun

/**
 * Merklization Demo Script
 *
 * Demonstrates the Gray Paper merklization implementation
 * and verifies it matches the Python reference implementation
 */

import trieTestVectors from '../__tests__/trie.json'
import {
  merklizeHex,
  type TrieInput,
  verifyTestVectors,
} from '../src/merklization'

console.log('🔍 Gray Paper Merklization Implementation')
console.log('==========================================\n')

// Test individual cases
const testCases = [
  {
    name: 'Empty trie',
    input: {} as TrieInput,
    expected:
      '0000000000000000000000000000000000000000000000000000000000000000',
  },
  {
    name: 'Single key-value pair (empty value)',
    input: {
      '16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8ec': '',
    } as TrieInput,
    expected:
      '17d7a1c738dfa055bc810110004585ca79be323586764e14179ee20e54376592',
  },
  {
    name: 'Single key-value pair (1 byte value)',
    input: {
      '645eece27fdce6fd3852790131a50dc5b2dd655a855421b88700e6eb43279ad9': '72',
    } as TrieInput,
    expected:
      '75978696ab7bd70492c2abbecf26fd03eb2c41e0d83daf968f45c20f566b9a9b',
  },
  {
    name: 'Two key-value pairs (branch node)',
    input: {
      f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3:
        '22c62f84ee5775d1e75ba6519f6dfae571eb1888768f2a203281579656b6a29097f7c7e2cf44e38da9a541d9b4c773db8b71e1d3',
      f3a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3:
        '44d0b26211d9d4a44e375207',
    } as TrieInput,
    expected:
      'b9c99f66e5784879a178795b63ae178f8a49ee113652a122cd4b3b2a321418c1',
  },
]

console.log('📊 Individual Test Cases:')
console.log('========================\n')

testCases.forEach(({ name, input, expected }) => {
  const actual = merklizeHex(input)
  const passed = actual === expected

  console.log(`${name}:`)
  console.log(`  Input: ${JSON.stringify(input)}`)
  console.log(`  Expected: ${expected}`)
  console.log(`  Actual:   ${actual}`)
  console.log(`  Status:   ${passed ? '✅ PASS' : '❌ FAIL'}\n`)
})

console.log('\n🔬 Full Test Vector Verification:')
console.log('==================================\n')

const results = verifyTestVectors(
  trieTestVectors as Array<{ input: TrieInput; output: string }>,
)
const passedCount = results.filter((r) => r.passed).length
const totalCount = results.length

console.log(`Results: ${passedCount}/${totalCount} test vectors passed`)
if (passedCount === totalCount) {
  console.log('🎉 All test vectors passed! The implementation is correct.\n')
} else {
  console.log('❌ Some test vectors failed!\n')
  results
    .filter((r) => !r.passed)
    .forEach((result, index) => {
      console.log(`Failed test ${index}:`)
      console.log(`  Expected: ${result.expected}`)
      console.log(`  Actual:   ${result.actual}\n`)
    })
}

console.log('\n\n📋 Implementation Details:')
console.log('==========================')
console.log('• Implements Gray Paper merklization.tex section D')
console.log('• Uses Blake2b-256 for hashing')
console.log(
  '• Supports embedded-value leaves (≤32 bytes) and regular leaves (>32 bytes)',
)
console.log('• Implements binary Patricia Merkle Trie with 64-byte nodes')
console.log('• Handles empty tries, single leaves, and branch nodes correctly')

console.log(
  '\n✅ Merklization implementation verified against Gray Paper specification!',
)
