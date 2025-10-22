/**
 * Unit tests for audit signature generation and verification
 * 
 * Tests round-trip functionality between generateAnnouncementSignature and verifyAnnouncementSignature
 * Cross-validates against Gray Paper Eq. 82 specification
 */

import { describe, expect, it } from 'bun:test'
import { generateAnnouncementSignature, verifyAnnouncementSignature } from './audit-signature'
import type { AuditAnnouncement, Hex } from '@pbnj/types'
import { generateEd25519KeyPairStable, bytesToHex } from '@pbnj/core'

describe('Audit Signature Round-Trip Tests', () => {
  // Generate proper Ed25519 key pair for testing
  const { privateKey: validatorSecretKeyFull, publicKey: validatorPublicKeyBytes } = generateEd25519KeyPairStable()
  // Ed25519 signing uses only the first 32 bytes of the private key (the seed)
  const validatorSecretKey = validatorSecretKeyFull.slice(0, 32)
  const validatorPublicKey = bytesToHex(validatorPublicKeyBytes) as Hex
  const headerHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex
  const tranche = 0n
  
  const workReports = [
    {
      coreIndex: 1n,
      workReportHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex
    },
    {
      coreIndex: 42n,
      workReportHash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex
    }
  ]

  it('should generate announcement signature successfully', () => {
    // Step 1: Generate signature
    const result = generateAnnouncementSignature(
      validatorSecretKey,
      workReports,
      tranche,
      headerHash
    )

    console.log('Generate result:', result)
    
    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(2)
    
    const [error, signature] = result
    expect(error).toBeUndefined() // Safe<T> uses undefined for success
    expect(signature).toBeDefined()
    expect(signature?.length).toBe(130) // 0x + 64 bytes = 130 chars
  })

  it('should fail with invalid secret key length', () => {
    const invalidSecretKey = new Uint8Array(16) // Wrong length

    const result = generateAnnouncementSignature(
      invalidSecretKey,
      workReports,
      tranche,
      headerHash
    )

    const [error, signature] = result
    expect(error).toBeDefined()
    expect(error?.message).toContain('32 bytes')
    expect(signature).toBeUndefined() // Safe<T> uses undefined for error case
  })

  it('should fail with empty work reports', () => {
    const result = generateAnnouncementSignature(
      validatorSecretKey,
      [], // Empty work reports
      tranche,
      headerHash
    )

    const [error, signature] = result
    expect(error).toBeDefined()
    expect(error?.message).toContain('empty')
    expect(signature).toBeUndefined() // Safe<T> uses undefined for error case
  })

  it('should complete round-trip: generate and verify announcement signature', () => {
    // Step 1: Generate signature
    const [generateError, signature] = generateAnnouncementSignature(
      validatorSecretKey,
      workReports,
      tranche,
      headerHash
    )

    expect(generateError).toBeUndefined()
    expect(signature).toBeDefined()
    expect(signature?.length).toBe(130) // 0x + 64 bytes = 130 chars

    // Step 2: Create announcement object for verification
    const announcement: AuditAnnouncement = {
      headerHash,
      tranche,
      evidence: '0x' + '0'.repeat(192), // Mock audit evidence
      announcement: {
        validatorIndex: 0,
        workReports,
        signature: signature!
      }
    }

    // Step 3: Mock validator set manager
    const mockValidatorSetManager = {
      getValidatorAtIndex: (index: number) => [
        undefined, // No error
        { ed25519: validatorPublicKey, bandersnatch: '0x' + '0'.repeat(64) }
      ]
    }

    // Step 4: Verify signature
    const [verifyError, isValid] = verifyAnnouncementSignature(
      announcement,
      0, // validator index
      mockValidatorSetManager as any
    )

    expect(verifyError).toBeUndefined()
    expect(isValid).toBe(true)
  })

  it('should reject invalid announcement signature', () => {
    // Generate valid signature
    const [generateError, signature] = generateAnnouncementSignature(
      validatorSecretKey,
      workReports,
      tranche,
      headerHash
    )

    expect(generateError).toBeUndefined()

    // Create announcement with wrong signature
    const announcement: AuditAnnouncement = {
      headerHash,
      tranche,
      evidence: '0x' + '0'.repeat(192),
      announcement: {
        validatorIndex: 0,
        workReports,
        signature: '0x' + '1'.repeat(128) // Wrong signature
      }
    }

    const mockValidatorSetManager = {
      getValidatorAtIndex: (index: number) => [
        undefined,
        { ed25519: validatorPublicKey, bandersnatch: '0x' + '0'.repeat(64) }
      ]
    }

    const [verifyError, isValid] = verifyAnnouncementSignature(
      announcement,
      0,
      mockValidatorSetManager as any
    )

    expect(verifyError).toBeUndefined()
    expect(isValid).toBe(false)
  })

  it('should handle different tranche numbers correctly', () => {
    const tranches = [0n, 1n, 42n, 1000n]

    for (const testTranche of tranches) {
      const [generateError, signature] = generateAnnouncementSignature(
        validatorSecretKey,
        workReports,
        testTranche,
        headerHash
      )

      expect(generateError).toBeUndefined()
      expect(signature).toBeDefined()

      // Verify the signature works for this tranche
      const announcement: AuditAnnouncement = {
        headerHash,
        tranche: testTranche,
        evidence: '0x' + '0'.repeat(192),
        announcement: {
          validatorIndex: 0,
          workReports,
          signature: signature!
        }
      }

      const mockValidatorSetManager = {
        getValidatorAtIndex: (index: number) => [
          undefined,
          { ed25519: validatorPublicKey, bandersnatch: '0x' + '0'.repeat(64) }
        ]
      }

      const [verifyError, isValid] = verifyAnnouncementSignature(
        announcement,
        0,
        mockValidatorSetManager as any
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    }
  })
})
