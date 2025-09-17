import { describe, expect, test } from 'vitest'
import { BandersnatchCurve, signMessage, verifySignature, vrfOutputToHash } from '../index.js'
import { bytesToBigInt } from '@pbnj/core'

describe('Bandersnatch VRF Signing and Verification', () => {
  test('VRF round-trip: sign and verify message', () => {
    // Generate test key pair
    const privateKey = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      privateKey[i] = i
    }

    // Generate public key
    const privateKeyBigInt = bytesToBigInt(privateKey)
    const publicKeyPoint = BandersnatchCurve.scalarMultiply(
      BandersnatchCurve.GENERATOR,
      privateKeyBigInt,
    )
    const publicKey = BandersnatchCurve.pointToBytes(publicKeyPoint)

    // Test message and context
    const context = new TextEncoder().encode('test-context')
    const message = new TextEncoder().encode('Hello, Bandersnatch VRF!')

    // Sign the message using VRF
    const [signError, vrfOutput] = signMessage(privateKey, context, message)
    
    // Check that signing succeeded
    expect(signError).toBeUndefined()
    if (signError) {
      throw new Error(`Signing failed: ${signError}`)
    }

    // Verify VRF output structure
    expect(vrfOutput.output).toBeInstanceOf(Uint8Array)
    expect(vrfOutput.output.length).toBe(32) // Compressed point
    expect(vrfOutput.proof.c).toBeInstanceOf(Uint8Array)
    expect(vrfOutput.proof.s).toBeInstanceOf(Uint8Array)
    expect(vrfOutput.proof.c.length).toBe(32) // Challenge
    expect(vrfOutput.proof.s.length).toBe(32) // Response

    // Verify the VRF signature
    const [verifyError, isValid] = verifySignature(publicKey, context, message, vrfOutput)
    
    // Check that verification succeeded
    expect(verifyError).toBeUndefined()
    if (verifyError) {
      throw new Error(`Verification failed: ${verifyError}`)
    }

    expect(isValid).toBe(true)

    // Test VRF output hash generation
    const outputHash = vrfOutputToHash(vrfOutput.output)
    expect(outputHash).toBeInstanceOf(Uint8Array)
    expect(outputHash.length).toBe(32)

    console.log('✅ VRF round-trip test passed!')
    console.log(`   Message: "${message}"`)
    console.log(`   Context: "${context}"`)
    console.log(`   VRF Output: ${Array.from(vrfOutput.output).map(b => b.toString(16).padStart(2, '0')).join('')}`)
    console.log(`   Proof C: ${Array.from(vrfOutput.proof.c).map(b => b.toString(16).padStart(2, '0')).join('')}`)
    console.log(`   Proof S: ${Array.from(vrfOutput.proof.s).map(b => b.toString(16).padStart(2, '0')).join('')}`)
  })

  test('VRF deterministic output', () => {
    const privateKey = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      privateKey[i] = i
    }

    const context = new TextEncoder().encode('deterministic-test')
    const message = new TextEncoder().encode('Deterministic VRF message')

    // Sign the same message multiple times
    const [error1, result1] = signMessage(privateKey, context, message)
    const [error2, result2] = signMessage(privateKey, context, message)
    const [error3, result3] = signMessage(privateKey, context, message)

    expect(error1).toBeUndefined()
    expect(error2).toBeUndefined()
    expect(error3).toBeUndefined()

    if (result1 && result2 && result3) {
      // VRF output should be deterministic
      expect(result1.output).toEqual(result2.output)
      expect(result1.output).toEqual(result3.output)
      
      // Proof should also be deterministic
      expect(result1.proof.c).toEqual(result2.proof.c)
      expect(result1.proof.s).toEqual(result2.proof.s)
    }
  })

  test('Different messages produce different VRF outputs', () => {
    const privateKey = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      privateKey[i] = i
    }

    const privateKeyBigInt = bytesToBigInt(privateKey)
    const publicKeyPoint = BandersnatchCurve.scalarMultiply(
      BandersnatchCurve.GENERATOR,
      privateKeyBigInt,
    )
    const publicKey = BandersnatchCurve.pointToBytes(publicKeyPoint)

    const context = new TextEncoder().encode('test-context')
    const message1 = new TextEncoder().encode('Message 1')
    const message2 = new TextEncoder().encode('Message 2')

    const [error1, result1] = signMessage(privateKey, context, message1)
    const [error2, result2] = signMessage(privateKey, context, message2)

    expect(error1).toBeUndefined()
    expect(error2).toBeUndefined()

    if (result1 && result2) {
      // Different messages should produce different VRF outputs
      expect(result1.output).not.toEqual(result2.output)
      expect(result1.proof.c).not.toEqual(result2.proof.c)
      expect(result1.proof.s).not.toEqual(result2.proof.s)

      // Both should be verifiable
      const [verifyError1, isValid1] = verifySignature(publicKey, context, message1, result1)
      const [verifyError2, isValid2] = verifySignature(publicKey, context, message2, result2)

      expect(verifyError1).toBeUndefined()
      expect(verifyError2).toBeUndefined()
      expect(isValid1).toBe(true)
      expect(isValid2).toBe(true)
    }
  })
})