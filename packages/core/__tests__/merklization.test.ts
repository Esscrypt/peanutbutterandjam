/**
 * Merklization Tests
 * 
 * Tests the Gray Paper merklization implementation against test vectors
 */

import { describe, expect, it } from 'vitest'
import { merklizeHex, verifyTestVectors, type TrieInput } from '../src/merklization'
import trieTestVectors from './trie.json'

describe('Merklization', () => {
  describe('Test Vector Verification', () => {
    it('should pass all test vectors from trie.json', () => {
      const results = verifyTestVectors(trieTestVectors as Array<{ input: TrieInput; output: `0x${string}` }>)
      
      // Check if all tests passed
      const failedTests = results.filter(result => !result.passed)
      
      if (failedTests.length > 0) {
        console.error('Failed test vectors:')
        failedTests.forEach((result, index) => {
          console.error(`Test ${index}:`)
          console.error(`  Expected: ${result.expected}`)
          console.error(`  Actual:   ${result.actual}`)
        })
      }
      
      expect(failedTests.length).toBe(0)
    })

    it('should handle empty input correctly', () => {
      const result = merklizeHex({})
      expect(result).toBe('0000000000000000000000000000000000000000000000000000000000000000')
    })

    it('should handle single key-value pair', () => {
      const input: TrieInput = {
        '16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8ec': ''
      }
      const result = merklizeHex(input)
      expect(result).toBe('17d7a1c738dfa055bc810110004585ca79be323586764e14179ee20e54376592')
    })

    it('should handle multiple key-value pairs', () => {
      const input: TrieInput = {
        'f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3': '22c62f84ee5775d1e75ba6519f6dfae571eb1888768f2a203281579656b6a29097f7c7e2cf44e38da9a541d9b4c773db8b71e1d3',
        'f3a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3': '44d0b26211d9d4a44e375207'
      }
      const result = merklizeHex(input)
      expect(result).toBe('b9c99f66e5784879a178795b63ae178f8a49ee113652a122cd4b3b2a321418c1')
    })
  })

  describe('Edge Cases', () => {
    it('should handle values of different lengths', () => {
      const input: TrieInput = {
        '645eece27fdce6fd3852790131a50dc5b2dd655a855421b88700e6eb43279ad9': '72', // 1 byte
        '3dbc5f775f6156957139100c343bb5ae6589af7398db694ab6c60630a9ed0fcd': '4227b4a465084852cd87d8f23bec0db6fa7766b9685ab5e095ef9cda9e15e49d', // 32 Uint8Array
        'd44438ec54b3f4d9771a43ed435f21b53a4f1f42be4c34b5d998bb9d53adc517': '2bdea5ab5a70d42dbd29c5944a90aa6f1774815854a21d9af07a9ca98d936150c0' // > 32 Uint8Array
      }
      const result = merklizeHex(input)
      // This should work without throwing errors
      expect(result).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should handle keys with different bit patterns', () => {
      const input: TrieInput = {
        '27a30d678b05b75bd7c5ce723d7dbe919c9ee57d03f687c6097228ae37d7db81': 'ec568a22939875f3aba1c9d5751a8bf1114716dc12ca18389e30cca648d490c9f23817bb54135c12',
        '27a20d678b05b75bd7c5ce723d7dbe919c9ee57d03f687c6097228ae37d7db81': 'e8a9e5097a500730bc63cb'
      }
      const result = merklizeHex(input)
      expect(result).toBe('846fd6a4c1913db012ee6bf3184b85db4b9d9c3f429305c9c60ae610f6bd2d0b')
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should implement branch node encoding correctly (GP 286)', () => {
      // Test that branch nodes are encoded as specified in the Gray Paper
      // This is tested indirectly through the test vectors
      const input: TrieInput = {
        '8e758c6d2b87bd72bb121e82801a212717d730343ed555bd8757f3f976eb5476': '74e30dd46bb8dcae80e82f7585a5d652e00cbf1b43a8873f6977b7891cbca312aaac17b7c6ab',
        '80542dacde2838f3383f47eca425ca657d4bb7814368be746cf57ea6df2f7da1': '384905461e004f92366ceb267347688aa01e9f8cd362'
      }
      const result = merklizeHex(input)
      expect(result).toBe('e79ee404bb7caf984f99f7a5d997200a306b0302fa08262b380662562d693313')
    })

    it('should implement leaf node encoding correctly (GP 287)', () => {
      // Test embedded-value leaf (value <= 32 Uint8Array)
      const embeddedInput: TrieInput = {
        '645eece27fdce6fd3852790131a50dc5b2dd655a855421b88700e6eb43279ad9': '72'
      }
      const embeddedResult = merklizeHex(embeddedInput)
      expect(embeddedResult).toBe('75978696ab7bd70492c2abbecf26fd03eb2c41e0d83daf968f45c20f566b9a9b')

      // Test regular leaf (value > 32 Uint8Array)
      const regularInput: TrieInput = {
        'd44438ec54b3f4d9771a43ed435f21b53a4f1f42be4c34b5d998bb9d53adc517': '2bdea5ab5a70d42dbd29c5944a90aa6f1774815854a21d9af07a9ca98d936150c0'
      }
      const regularResult = merklizeHex(regularInput)
      expect(regularResult).toBe('de6ffcbc0c3c6e3e5b6ef8f7ba875b77707f502228db0b6b9173b3f659b8edb6')
    })

    it('should implement merklization function correctly (GP 289)', () => {
      // Test the main merklization function with multiple test cases
      const testCases = [
        { input: {} as TrieInput, expected: '0000000000000000000000000000000000000000000000000000000000000000' },
        { 
          input: { '16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8ec': '' } as TrieInput,
          expected: '17d7a1c738dfa055bc810110004585ca79be323586764e14179ee20e54376592'
        },
        {
          input: {
            'f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3': '22c62f84ee5775d1e75ba6519f6dfae571eb1888768f2a203281579656b6a29097f7c7e2cf44e38da9a541d9b4c773db8b71e1d3',
            'f3a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3': '44d0b26211d9d4a44e375207'
          } as TrieInput,
          expected: 'b9c99f66e5784879a178795b63ae178f8a49ee113652a122cd4b3b2a321418c1'
        }
      ]

      testCases.forEach(({ input, expected }) => {
        const result = merklizeHex(input)
        expect(result).toBe(expected)
      })
    })
  })
}) 