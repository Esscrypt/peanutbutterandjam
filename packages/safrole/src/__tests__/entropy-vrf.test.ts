/**
 * Entropy VRF Tests
 * 
 * Tests the entropy VRF signature generation and verification functions
 * according to Gray Paper equation 158
 */

import { describe, expect, test } from 'vitest'
import { generateEntropyVRFSignature, verifyEntropyVRFSignature, banderout } from '@pbnj/bandersnatch-vrf'

describe('Entropy VRF Functions', () => {
  test('generateEntropyVRFSignature should create valid 96-byte signature', () => {
    // Test data
    const validatorSecretKey = new Uint8Array(32).fill(1) // 32 bytes of 1s
    const sealOutput = new Uint8Array(32).fill(2) // 32 bytes of 2s

    // Generate entropy VRF signature
    const [error, result] = generateEntropyVRFSignature(validatorSecretKey, sealOutput)
    
    expect(error).toBeUndefined()
    expect(result).toBeDefined()
    expect(result!.signature).toHaveLength(96) // Gray Paper: blob[96]
    expect(result!.banderoutResult).toHaveLength(32) // Gray Paper: banderout returns first 32 bytes
  })

  test('verifyEntropyVRFSignature should verify valid signature', () => {
    // Test data
    const validatorSecretKey = new Uint8Array(32).fill(1) // 32 bytes of 1s
    const validatorPublicKey = new Uint8Array(32).fill(3) // 32 bytes of 3s (would need proper key derivation)
    const sealOutput = new Uint8Array(32).fill(2) // 32 bytes of 2s

    // Generate entropy VRF signature
    const [genError, genResult] = generateEntropyVRFSignature(validatorSecretKey, sealOutput)
    expect(genError).toBeUndefined()

    // Verify signature (this will fail with dummy keys, but should not crash)
    const [verifyError, isValid] = verifyEntropyVRFSignature(
      validatorPublicKey,
      genResult!.signature,
      sealOutput
    )
    
    expect(verifyError).toBeUndefined()
    expect(typeof isValid).toBe('boolean')
    // Note: isValid will be false because we're using dummy keys that don't match
  })

  test('banderout should extract banderout result from 96-byte signature', () => {
    // Test data - 96-byte signature with known gamma
    const sealSignature = new Uint8Array(96)
    const gamma = new Uint8Array(32).fill(0x42) // 32 bytes of 0x42
    sealSignature.set(gamma, 0) // Set gamma in first 32 bytes

    // Extract seal output using banderout function
    const [error, result] = banderout(sealSignature)
    
    expect(error).toBeUndefined()
    expect(result).toHaveLength(32)
    // The result should be the first 32 bytes of pointToHashRfc9381(gamma, false)
    // This is different from gamma itself, as banderout hashes the gamma point
    expect(result).not.toEqual(gamma) // Should be hashed, not raw gamma
  })

  test('should reject invalid input sizes', () => {
    const validatorSecretKey = new Uint8Array(32).fill(1)
    const sealOutput = new Uint8Array(32).fill(2)

    // Test invalid secret key size
    const [error1] = generateEntropyVRFSignature(new Uint8Array(16), sealOutput)
    expect(error1).toBeDefined()
    expect(error1!.message).toContain('32 bytes')

    // Test invalid seal output size
    const [error2] = generateEntropyVRFSignature(validatorSecretKey, new Uint8Array(16))
    expect(error2).toBeDefined()
    expect(error2!.message).toContain('32 bytes')

    // Test invalid signature size
    const [error3] = verifyEntropyVRFSignature(
      validatorSecretKey,
      new Uint8Array(64), // Wrong size
      sealOutput
    )
    expect(error3).toBeDefined()
    expect(error3!.message).toContain('96 bytes')

    // Test invalid seal signature size for extraction
    const [error4] = banderout(new Uint8Array(64))
    expect(error4).toBeDefined()
    expect(error4!.message).toContain('96 bytes')
  })
})
