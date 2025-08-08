/**
 * Dictionary Serialization Tests
 *
 * Tests for Gray Paper dictionary encoding implementation
 */

import { encodeDictionary, decodeDictionary, type DictionaryEntry } from '../src/core/dictionary'

/**
 * Simple test function to verify dictionary encoding
 */
export function testDictionaryEncoding() {
  console.log('🧪 Testing Dictionary Encoding...')

  // Test data
  const testEntries: DictionaryEntry[] = [
    {
      key: new Uint8Array([1, 2, 3]),
      value: new Uint8Array([10, 20, 30])
    },
    {
      key: new Uint8Array([0, 1, 2]),
      value: new Uint8Array([5, 15, 25])
    },
    {
      key: new Uint8Array([2, 3, 4]),
      value: new Uint8Array([15, 25, 35])
    }
  ]

  try {
    // Encode dictionary
    console.log('📝 Encoding dictionary...')
    const encoded = encodeDictionary(testEntries)
    console.log('✅ Encoded length:', encoded.length)

    // Decode dictionary
    console.log('📖 Decoding dictionary...')
    const { value: decoded, remaining } = decodeDictionary(encoded, 3, 3)
    console.log('✅ Decoded entries:', decoded.length)

    // Verify results
    if (decoded.length === testEntries.length) {
      console.log('✅ Entry count matches')
    } else {
      console.log('❌ Entry count mismatch')
      return false
    }

    // Check that entries are sorted by key
    const sortedOriginal = [...testEntries].sort((a, b) => {
      const keyA = Array.from(a.key).join(',')
      const keyB = Array.from(b.key).join(',')
      return keyA.localeCompare(keyB)
    })

    for (let i = 0; i < decoded.length; i++) {
      const original = sortedOriginal[i]
      const decodedEntry = decoded[i]
      
      const keyMatch = original.key.every((byte, index) => byte === decodedEntry.key[index])
      const valueMatch = original.value.every((byte, index) => byte === decodedEntry.value[index])
      
      if (!keyMatch || !valueMatch) {
        console.log('❌ Entry mismatch at index', i)
        return false
      }
    }

    console.log('✅ All entries match')
    console.log('✅ Dictionary encoding test passed!')
    return true

  } catch (error) {
    console.error('❌ Dictionary encoding test failed:', error)
    return false
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDictionaryEncoding()
} 