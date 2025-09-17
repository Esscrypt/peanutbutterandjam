import { describe, expect, test } from 'vitest'
import { BandersnatchCurve, signMessage, verifySignature } from '../index.js'
import { bytesToBigInt } from '@pbnj/core'

describe('Bandersnatch VRF Simple Round-trip Test', () => {
  test('Single VRF round-trip: sign and verify', () => {
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
    const context = new TextEncoder().encode('simple-test-context')
    const message = new TextEncoder().encode('Simple VRF test message')

    // Sign the message using VRF
    const [signError, vrfOutput] = signMessage(privateKey, context, message)
    
    // Check that signing succeeded
    if (signError) {
      console.error('Signing error:', signError)
      throw new Error(`Signing failed: ${signError}`)
    }
    expect(signError).toBeUndefined()

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

    console.log('✅ VRF round-trip test passed!')
    console.log(`   Message: "${message}"`)
    console.log(`   Context: "${context}"`)
    console.log(`   VRF Output: ${Array.from(vrfOutput.output).map(b => b.toString(16).padStart(2, '0')).join('')}`)
    console.log(`   Proof C: ${Array.from(vrfOutput.proof.c).map(b => b.toString(16).padStart(2, '0')).join('')}`)
    console.log(`   Proof S: ${Array.from(vrfOutput.proof.s).map(b => b.toString(16).padStart(2, '0')).join('')}`)
  })
})
