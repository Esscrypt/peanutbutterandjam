/**
 * Audit Signature Tests
 *
 * Tests the audit signature generation and verification functions
 * Validates compliance with Gray Paper auditing.tex specification
 */

import { describe, expect, it, beforeAll } from 'bun:test'
import {
  generateTranche0AuditSignature,
  generateTrancheNAuditSignature,
  verifyTranche0AuditSignature,
  verifyTrancheNAuditSignature,
} from '../src/audit-signature'
import { logger, type Hex, generateDevAccountValidatorKeyPair } from '@pbnj/core'
import type { WorkReport, AuditAnnouncement, IValidatorSetManager, ValidatorKeyTuple } from '@pbnj/types'
import { generateAnnouncementSignature, verifyAnnouncementSignature } from '../src/announcement'

beforeAll(() => {
  logger.init()
})

describe('Audit Signature Functions', () => {
  const blockHeaderVrfOutput = new Uint8Array(32).fill(3)
  const trancheNumber = 1n
  
  // Generate Alice's key pair using the keypair service
  const [aliceKeyPairError, aliceKeyPair] = generateDevAccountValidatorKeyPair(0) // Alice is index 0
  if (aliceKeyPairError) {
    throw new Error(`Failed to generate Alice's key pair: ${aliceKeyPairError.message}`)
  }
  
  // Create a minimal mock validator set manager that only implements the methods we need
  const mockValidatorSetManager: IValidatorSetManager = {
    getValidatorAtIndex: (index: number): [Error, undefined] | [undefined, ValidatorKeyTuple] => {
      if (index === 0) {
        // Return Alice's keys - convert Uint8Array to Hex string
        return [undefined, {
          ed25519: `0x${Array.from(aliceKeyPair.ed25519KeyPair.publicKey).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex,
          bandersnatch: `0x${Array.from(aliceKeyPair.bandersnatchKeyPair.publicKey).map(b => b.toString(16).padStart(2, '0')).join('')}` as Hex,
        }] as const
      }
      return [new Error(`Validator at index ${index} not found`), undefined] as const
    },
    // Mock other required methods (not used in our tests)
    getActiveValidatorKeys: () => [],
    getValidatorIndex: () => [new Error('Not implemented'), undefined] as const,
    getActiveValidators: () => new Map(),
    getPendingValidators: () => new Map(),
    setStagingSet: () => {},
    setActiveSet: () => {},
    setPreviousSet: () => {},
  } as unknown as IValidatorSetManager

  const mockWorkReport: WorkReport = {
    package_spec: {
      hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      length: 1000n,
      erasure_root: '0x2222222222222222222222222222222222222222222222222222222222222222',
      exports_root: '0x3333333333333333333333333333333333333333333333333333333333333333',
      exports_count: 5n,
    },
    context: {
      anchor: '0x4444444444444444444444444444444444444444444444444444444444444444',
      state_root: '0x5555555555555555555555555555555555555555555555555555555555555555',
      beefy_root: '0x6666666666666666666666666666666666666666666666666666666666666666',
      lookup_anchor: '0x7777777777777777777777777777777777777777777777777777777777777777',
      lookup_anchor_slot: 1000000n,
      prerequisites: [],
    },
    core_index: 0n,
    authorizer_hash: '0x8888888888888888888888888888888888888888888888888888888888888888',
    auth_gas_used: 5000n,
    auth_output: '0x9999999999999999999999999999999999999999999999999999999999999999',
    segment_root_lookup: [],
    results: [],
  }

  describe('Round Trip Tests', () => {
    it('should complete round trip for generateAnnouncementSignature and verifyAnnouncementSignature', () => {
      // Test data
      const testWorkReports = [
        {
          coreIndex: 0n,
          workReportHash: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
        },
        {
          coreIndex: 1n,
          workReportHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
        },
        {
          coreIndex: 2n,
          workReportHash: '0x3333333333333333333333333333333333333333333333333333333333333333' as const,
        },
      ]

      const testTranche = 2n
      const testHeaderHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      // Step 1: Generate announcement signature using Alice's Ed25519 private key
      const [genError, signature] = generateAnnouncementSignature(
        aliceKeyPair.ed25519KeyPair.privateKey,
        testWorkReports,
        testTranche,
        testHeaderHash,
      )

      expect(genError).toBeUndefined()
      expect(signature).toBeDefined()
      expect(typeof signature).toBe('string')
      expect(signature!.startsWith('0x')).toBe(true)
      expect(signature!.length).toBe(130) // 64 bytes * 2 + '0x' prefix

      // Step 2: Create announcement object with the generated signature
      const announcement: AuditAnnouncement = {
        headerHash: testHeaderHash,
        tranche: testTranche,
        announcement: {
          workReports: testWorkReports,
          signature: signature!,
        },
        evidence: new Uint8Array(96).fill(1),
      }

      // Step 3: Verify the announcement signature
      const [verifyError, isValid] = verifyAnnouncementSignature(
        announcement,
        0, // validator index (Alice)
        mockValidatorSetManager,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)

      // Step 4: Verify that tampering with the signature makes verification fail
      const tamperedAnnouncement: AuditAnnouncement = {
        ...announcement,
        announcement: {
          ...announcement.announcement,
          signature: '0x' + 'f'.repeat(128) as Hex, // Tampered signature
        },
      }

      const [tamperError, tamperValid] = verifyAnnouncementSignature(
        tamperedAnnouncement,
        0,
        mockValidatorSetManager,
      )

      expect(tamperError).toBeUndefined()
      expect(tamperValid).toBe(false)

      // Step 5: Verify that tampering with the message makes verification fail
      const tamperedMessageAnnouncement: AuditAnnouncement = {
        ...announcement,
        tranche: 999n, // Tampered tranche number
      }

      const [messageError, messageValid] = verifyAnnouncementSignature(
        tamperedMessageAnnouncement,
        0,
        mockValidatorSetManager,
      )

      expect(messageError).toBeUndefined()
      expect(messageValid).toBe(false)
    })

    it('should complete round trip for audit signature generation and verification', () => {
      // Test tranche 0 round trip (uses Alice's Bandersnatch private key)
      const [gen0Error, gen0Result] = generateTranche0AuditSignature(
        aliceKeyPair.bandersnatchKeyPair.privateKey,
        blockHeaderVrfOutput,
      )
      expect(gen0Error).toBeUndefined()
      expect(gen0Result).toBeDefined()

      const [verify0Error, verify0Valid] = verifyTranche0AuditSignature(
        aliceKeyPair.bandersnatchKeyPair.publicKey,
        gen0Result!.signature,
        blockHeaderVrfOutput,
      )
      expect(verify0Error).toBeUndefined()
      expect(verify0Valid).toBe(true)

      // Test tranche N round trip (uses Alice's Bandersnatch private key)
      const [genNError, genNResult] = generateTrancheNAuditSignature(
        aliceKeyPair.bandersnatchKeyPair.privateKey,
        blockHeaderVrfOutput,
        mockWorkReport,
        trancheNumber,
      )
      expect(genNError).toBeUndefined()
      expect(genNResult).toBeDefined()

      const [verifyNError, verifyNValid] = verifyTrancheNAuditSignature(
        aliceKeyPair.bandersnatchKeyPair.publicKey,
        genNResult!.signature,
        blockHeaderVrfOutput,
        mockWorkReport,
        trancheNumber,
      )
      expect(verifyNError).toBeUndefined()
      expect(verifyNValid).toBe(true)
    })

  })

})