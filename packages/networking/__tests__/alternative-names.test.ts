/**
 * Tests for alternative name generation
 * 
 * These tests verify that our alternative name generation produces
 * the correct values for each dev account based on their Ed25519 public keys.
 */

import { describe, it, expect } from 'vitest'
import { generateAlternativeName } from '@pbnj/core'

describe('generateAlternativeName', () => {
  it('should generate alternative names according to Gray Paper specification', () => {
    // Test cases with Ed25519 public keys and expected Gray Paper results
    const testCases = [
      {
        name: 'Alice',
        publicKey: new Uint8Array(Buffer.from('4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace', 'hex')),
        expected: 'ebtu2jfrnpe5qkaxsuicgivq44vzumtjvmj4mji4ykon3qwgpwgce'
      },
      {
        name: 'Bob',
        publicKey: new Uint8Array(Buffer.from('ad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933', 'hex')),
        expected: 'eam6zscpjicvtmuzamzfthx37ybnyn7hfpv5my4hfkbyt2b5sje5n'
      },
      {
        name: 'Charlie',
        publicKey: new Uint8Array(Buffer.from('cab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341', 'hex')),
        expected: 'eaqpdxaahkchs322m5gb4tabwu4mmfg5xu4mkto7a6qocex73tmwk'
      },
      {
        name: 'Dave',
        publicKey: new Uint8Array(Buffer.from('f30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d', 'hex')),
        expected: 'ebdi2smdheq63c6n3dbxjrezlwb2xvroh3m4xo22mvm4iizckkcxt'
      },
      {
        name: 'Eve',
        publicKey: new Uint8Array(Buffer.from('8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a', 'hex')),
        expected: 'eakxt4ybtao33awnc7cviklvwdb2s5smtvby6iic7n3esn5bv3del'
      },
      {
        name: 'Ferdie',
        publicKey: new Uint8Array(Buffer.from('ab0084d01534b31c1dd87c81645fd762482a90027754041ca1b56133d0466c06', 'hex')),
        expected: 'eabtmi3idgynvueoaivdxakicusdc25pwjal43aorzmzucxiiiafl'
      }
    ]

    for (const testCase of testCases) {
      const result = generateAlternativeName(testCase.publicKey)
      expect(result).toBe(testCase.expected)
    }
  })

  it('should handle edge cases', () => {
    // Test with all zeros
    const zeroKey = new Uint8Array(32)
    const zeroResult = generateAlternativeName(zeroKey)
    expect(zeroResult).toMatch(/^e[a-z2-7]{52}$/)

    // Test with all ones
    const onesKey = new Uint8Array(32).fill(255)
    const onesResult = generateAlternativeName(onesKey)
    expect(onesResult).toMatch(/^e[a-z2-7]{52}$/)
  })
}) 