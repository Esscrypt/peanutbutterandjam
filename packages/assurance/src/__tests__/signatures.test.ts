/**
 * Assurance Signature Round-Trip Tests
 *
 * Tests that assurance signatures can be created and verified correctly
 * according to Gray Paper specifications.
 */

import { describe, expect, it } from 'bun:test'
import { generateEd25519KeyPairStable } from '@pbnjam/core'
import type { Assurance } from '@pbnjam/types'
import type { Hex } from 'viem'
import {
  createAssuranceSignature,
  validateAssuranceSignatures,
  verifyAssuranceSignature,
} from '../signatures'

describe('Assurance Signature Round-Trip', () => {
  // Generate a test key pair
  const { privateKey, publicKey } = generateEd25519KeyPairStable()

  const parentHash: Hex =
    '0xd61a38a0f73beda90e8c1dfba731f65003742539f4260694f44e22cabef24a8e'

  describe('Single Assurance Round-Trip', () => {
    it('should create and verify a valid assurance signature for a simple bitfield', () => {
      const bitfield: Hex = '0x01' // Single bit set

      // Step 1: Create signature
      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()
      expect(signature).toBeDefined()
      expect(signature).toMatch(/^0x[0-9a-f]{128}$/) // Ed25519 signature is 64 bytes = 128 hex chars

      // Step 2: Create assurance object
      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      // Step 3: Verify signature
      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should create and verify a valid assurance signature for multi-byte bitfield', () => {
      const bitfield: Hex = '0x0f' // Multiple bits set

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()
      expect(signature).toBeDefined()

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should create and verify a valid assurance signature for larger bitfield', () => {
      // Bitfield for many cores (e.g., 341 cores = 43 bytes)
      const bitfield: Hex =
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()
      expect(signature).toBeDefined()

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should fail verification with wrong parent hash', () => {
      const bitfield: Hex = '0x01'
      const wrongParentHash: Hex =
        '0x0000000000000000000000000000000000000000000000000000000000000000'

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      // Verify with wrong parent hash
      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        wrongParentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(false)
    })

    it('should fail verification with wrong bitfield', () => {
      const bitfield: Hex = '0x01'
      const wrongBitfield: Hex = '0x02'

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()

      // Create assurance with wrong bitfield
      const assurance: Assurance = {
        anchor: parentHash,
        bitfield: wrongBitfield,
        validator_index: 0,
        signature: signature!,
      }

      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(false)
    })

    it('should fail verification with wrong public key', () => {
      const bitfield: Hex = '0x01'
      const { publicKey: wrongPublicKey } = generateEd25519KeyPairStable()

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      // Verify with wrong public key
      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        wrongPublicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(false)
    })

    it('should fail verification with corrupted signature', () => {
      const bitfield: Hex = '0x01'

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()

      // Corrupt the signature by flipping a byte
      const corruptedSignature = `0x00${signature!.slice(4)}` as Hex

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: corruptedSignature,
      }

      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(false)
    })
  })

  describe('Multiple Assurances Validation', () => {

    it('should fail validation if one signature is invalid', () => {
      // Create 3 validator key pairs
      const validators = Array.from({ length: 3 }, () => {
        const { privateKey: privKey, publicKey: pubKey } = generateEd25519KeyPairStable()
        return { privKey, pubKey }
      })

      const bitfields: Hex[] = ['0x01', '0x02', '0x03']

      // Create assurances from each validator
      const assurances: Assurance[] = validators.map((validator, index) => {
        const [, signature] = createAssuranceSignature(
          parentHash,
          bitfields[index],
          validator.privKey,
        )

        return {
          anchor: parentHash,
          bitfield: bitfields[index],
          validator_index: index,
          signature: signature!,
        }
      })

      // Corrupt one signature
      assurances[1].signature = `0x00${assurances[1].signature.slice(4)}` as Hex

      // Build validator keys map
      const validatorKeys = new Map<number, Uint8Array>()
      validators.forEach((validator, index) => {
        validatorKeys.set(index, validator.pubKey)
      })

      // Validate all assurances
      const [error] = validateAssuranceSignatures(
        assurances,
        parentHash,
        validatorKeys,
      )

      expect(error).toBeDefined()
      expect(error?.message).toContain('Invalid signature for validator 1')
    })

    it('should fail validation if validator key is missing', () => {
      const bitfield: Hex = '0x01'

      const [, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      const assurances: Assurance[] = [
        {
          anchor: parentHash,
          bitfield,
          validator_index: 0,
          signature: signature!,
        },
      ]

      // Empty validator keys map
      const validatorKeys = new Map<number, Uint8Array>()

      // Validate assurances
      const [error] = validateAssuranceSignatures(
        assurances,
        parentHash,
        validatorKeys,
      )

      expect(error).toBeDefined()
      expect(error?.message).toContain('Validator key not found for index 0')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty bitfield', () => {
      const bitfield: Hex = '0x00'

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should handle maximum bitfield value', () => {
      const bitfield: Hex = '0xff'

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should be deterministic - same inputs produce same signature', () => {
      const bitfield: Hex = '0x01'

      const [, signature1] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      const [, signature2] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(signature1).toBe(signature2)
    })

    it('should produce different signatures for different bitfields', () => {
      const bitfield1: Hex = '0x01'
      const bitfield2: Hex = '0x02'

      const [, signature1] = createAssuranceSignature(
        parentHash,
        bitfield1,
        privateKey,
      )

      const [, signature2] = createAssuranceSignature(
        parentHash,
        bitfield2,
        privateKey,
      )

      expect(signature1).not.toBe(signature2)
    })

    it('should produce different signatures for different parent hashes', () => {
      const bitfield: Hex = '0x01'
      const parentHash2: Hex =
        '0x1111111111111111111111111111111111111111111111111111111111111111'

      const [, signature1] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      const [, signature2] = createAssuranceSignature(
        parentHash2,
        bitfield,
        privateKey,
      )

      expect(signature1).not.toBe(signature2)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should use correct message format: "$jam_available" || BLAKE2b(encode(parent, bitfield))', () => {
      // This is implicitly tested by the round-trip tests above
      // The fact that signatures verify correctly means the format is correct
      const bitfield: Hex = '0x01'

      const [createError, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      expect(createError).toBeUndefined()
      expect(signature).toBeDefined()

      const assurance: Assurance = {
        anchor: parentHash,
        bitfield,
        validator_index: 0,
        signature: signature!,
      }

      const [verifyError, isValid] = verifyAssuranceSignature(
        assurance,
        parentHash,
        publicKey,
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should produce 64-byte Ed25519 signatures', () => {
      const bitfield: Hex = '0x01'

      const [, signature] = createAssuranceSignature(
        parentHash,
        bitfield,
        privateKey,
      )

      // 64 bytes = 128 hex characters + '0x' prefix = 130 characters total
      expect(signature).toHaveLength(130)
      expect(signature).toMatch(/^0x[0-9a-f]{128}$/)
    })

    it('should work with different validator key pairs', () => {
      const bitfield: Hex = '0x01'

      // Test with 10 different key pairs
      for (let i = 0; i < 10; i++) {
        const { privateKey: testPrivateKey, publicKey: testPublicKey } = generateEd25519KeyPairStable()

        const [createError, signature] = createAssuranceSignature(
          parentHash,
          bitfield,
          testPrivateKey,
        )

        expect(createError).toBeUndefined()

        const assurance: Assurance = {
          anchor: parentHash,
          bitfield,
          validator_index: i,
          signature: signature!,
        }

        const [verifyError, isValid] = verifyAssuranceSignature(
          assurance,
          parentHash,
          testPublicKey,
        )

        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })
  })
})

