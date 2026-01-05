/**
 * Tests for alternative name generation
 * 
 * These tests verify that our alternative name generation produces
 * the correct values for each dev account based on their Ed25519 public keys.
 */

import { describe, it, expect } from 'vitest'
import { generateAlternativeName } from '@pbnjam/core'
import { decodeFixedLength } from '@pbnjam/codec'

describe('generateAlternativeName', () => {
  it('should generate alternative names according to Gray Paper specification', () => {
    // Test cases with Ed25519 public keys and expected Gray Paper results
    const testCases = [
      {
        name: 'Alice',
        publicKey: new Uint8Array(Buffer.from('4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace', 'hex')),
        expected: 'eecgwpgwq3noky4ijm4jmvjtmuzv44qvigciusxakq5epnrfj2utb'
      },
      {
        name: 'Bob',
        publicKey: new Uint8Array(Buffer.from('ad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933', 'hex')),
        expected: 'en5ejs5b2tybkfh4ym5vpfh7nynby73xhtfzmazumtvcijpcsz6ma'
      },
      {
        name: 'Charlie',
        publicKey: new Uint8Array(Buffer.from('cab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341', 'hex')),
        expected: 'ekwmt37xecoq6a7otkm4ux5gfmm4uwbat4bg5m223shckhaaxdpqa'
      },
      {
        name: 'Dave',
        publicKey: new Uint8Array(Buffer.from('f30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d', 'hex')),
        expected: 'etxckkczii4mvm22ox4m3horvx2bwlzerjxbd3n6c36qehdms2idb'
      },
      {
        name: 'Eve',
        publicKey: new Uint8Array(Buffer.from('8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a', 'hex')),
        expected: 'eled3vb5nse3n7cii6ybvtms5s2bdwvlkivc7cnwa33oatby4txka'
      },
      {
        name: 'Ferdie',
        publicKey: new Uint8Array(Buffer.from('ab0084d01534b31c1dd87c81645fd762482a90027754041ca1b56133d0466c06', 'hex')),
        expected: 'elfaiiixcuzmzroa34lajwp52cdsucikaxdviaoeuvnygdi3imtba'
      }
    ]

    for (const testCase of testCases) {
      const [resultError, result] = generateAlternativeName(testCase.publicKey, decodeFixedLength)
      if (resultError) {
        throw resultError
      }
      expect(result).toBe(testCase.expected)
    }
  })

  it('should handle edge cases', () => {
    // Test with all zeros
    const zeroKey = new Uint8Array(32)
    const [zeroResultError, zeroResult] = generateAlternativeName(zeroKey, decodeFixedLength)
    if (zeroResultError) {
      throw zeroResultError
    }
    expect(zeroResult).toMatch(/^e[a-z2-7]{52}$/)

    // Test with all ones
    const onesKey = new Uint8Array(32).fill(255)
    const [onesResultError, onesResult] = generateAlternativeName(onesKey, decodeFixedLength)
    if (onesResultError) {
      throw onesResultError
    }
    expect(onesResult).toMatch(/^e[a-z2-7]{52}$/)
  })
}) 