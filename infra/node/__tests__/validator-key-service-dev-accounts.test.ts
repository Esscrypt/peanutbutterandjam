/**
 * Unit tests for ValidatorKeyService with dev account support
 * 
 * Tests dev account key generation according to JIP-5 specification
 * Verifies that the service can generate known dev accounts (Alice, Bob, Carol, etc.)
 */

import { describe, expect, it, beforeAll } from 'bun:test'
import { ValidatorKeyService, type ValidatorKeyServiceConfig } from '../services/validator-key-service'

describe('ValidatorKeyService Dev Accounts', () => {
  let service: ValidatorKeyService

  beforeAll(async () => {
    // Initialize service with dev accounts enabled
    const config: ValidatorKeyServiceConfig = {
      enableDevAccounts: true,
      devAccountCount: 6, // Alice, Bob, Carol, David, Eve, Fergie
    }
    
    service = new ValidatorKeyService(config)
    await service.init()
  })

  describe('Dev Account Key Generation', () => {
    it('should generate keys for all dev accounts', () => {
      // Check that we have keys for all 6 dev accounts
      expect(service.getValidatorKey(0n)).toBeDefined()
      expect(service.getValidatorKey(1n)).toBeDefined()
      expect(service.getValidatorKey(2n)).toBeDefined()
      expect(service.getValidatorKey(3n)).toBeDefined()
      expect(service.getValidatorKey(4n)).toBeDefined()
      expect(service.getValidatorKey(5n)).toBeDefined()
    })

    it('should generate keys for Alice (index 0)', () => {
      const [aliceKeyError, aliceKey] = service.getValidatorKey(0n)
      expect(aliceKeyError).toBeUndefined()
      expect(aliceKey).toBeDefined()
        expect(aliceKey?.ed25519.length).toBe(32)
      expect(aliceKey?.ed25519.length).toBe(64)
      expect(aliceKey?.bls.length).toBe(144)
      expect(aliceKey?.bls.length).toBe(32)
      expect(aliceKey?.bandersnatch.length).toBe(32)
      expect(aliceKey?.bandersnatch.length).toBe(64)
      expect(aliceKey?.metadata.length).toBe(128)
    })

    it('should generate keys for Bob (index 1)', () => {
      const [bobKeyError, bobKey] = service.getValidatorKey(1n)
      expect(bobKeyError).toBeUndefined()
      expect(bobKey).toBeDefined()
      expect(bobKey?.ed25519.length).toBe(32)
      expect(bobKey?.ed25519.length).toBe(64)
      expect(bobKey?.bls.length).toBe(144)
      expect(bobKey?.bls.length).toBe(32)
      expect(bobKey?.bandersnatch.length).toBe(32)
      expect(bobKey?.bandersnatch.length).toBe(64)
      expect(bobKey?.metadata.length).toBe(128)
    })

    it('should generate keys for Carol (index 2)', () => {
      const [carolKeyError, carolKey] = service.getValidatorKey(2n)
      expect(carolKeyError).toBeUndefined()
      expect(carolKey).toBeDefined()
      expect(carolKey?.ed25519.length).toBe(32)
      expect(carolKey?.ed25519.length).toBe(64)
      expect(carolKey?.bls.length).toBe(144)
      expect(carolKey?.bls.length).toBe(32)
      expect(carolKey?.bandersnatch.length).toBe(32)
      expect(carolKey?.bandersnatch.length).toBe(64)
      expect(carolKey?.metadata.length).toBe(128)
    })

    it('should generate keys for David (index 3)', () => {
        const [davidKeyError, davidKey] = service.getValidatorKey(3n)
      expect(davidKeyError).toBeUndefined()
      expect(davidKey).toBeDefined()
        expect(davidKey?.ed25519.length).toBe(32)
      expect(davidKey?.ed25519.length).toBe(64)
      expect(davidKey?.bls.length).toBe(144)
      expect(davidKey?.bls.length).toBe(32)
      expect(davidKey?.bandersnatch.length).toBe(32)
      expect(davidKey?.bandersnatch.length).toBe(64)
      expect(davidKey?.metadata.length).toBe(128)
    })

    it('should generate keys for Eve (index 4)', () => {
      const [eveKeyError, eveKey] = service.getValidatorKey(4n)
      expect(eveKeyError).toBeUndefined()
      expect(eveKey).toBeDefined()
      expect(eveKey?.ed25519.length).toBe(32)
      expect(eveKey?.ed25519.length).toBe(64)
      expect(eveKey?.bls.length).toBe(144)
      expect(eveKey?.bls.length).toBe(32)
      expect(eveKey?.bandersnatch.length).toBe(32)
      expect(eveKey?.bandersnatch.length).toBe(64)
      expect(eveKey?.metadata.length).toBe(128)
    })

    it('should generate keys for Fergie (index 5)', () => {
      const [fergieKeyError, fergieKey] = service.getValidatorKey(5n)
      expect(fergieKeyError).toBeUndefined()
      expect(fergieKey).toBeDefined()
      expect(fergieKey?.ed25519.length).toBe(32)
      expect(fergieKey?.ed25519.length).toBe(64)
      expect(fergieKey?.bls.length).toBe(144)
      expect(fergieKey?.bls.length).toBe(32)
      expect(fergieKey?.bandersnatch.length).toBe(32)
      expect(fergieKey?.bandersnatch.length).toBe(64)
      expect(fergieKey?.metadata.length).toBe(128)
    })
  })

  describe('Dev Account Signing', () => {
    it('should sign messages with Alice\'s Ed25519 key', () => {
      const [aliceKeyError, aliceKey] = service.getValidatorKey(0n)
      expect(aliceKeyError).toBeUndefined()
      expect(aliceKey).toBeDefined()

      const message = new TextEncoder().encode('Hello from Alice!')
      const [signatureError, signature] = service.signMessage(0n, message)
      expect(signatureError).toBeUndefined()
      
      expect(signature).toBeDefined()
      expect(signature?.length).toBe(64) // Ed25519 signature length
    })

    it('should verify signatures with Alice\'s Ed25519 key', () => {
      const [aliceKeyError, aliceKey] = service.getValidatorKey(0n)
      expect(aliceKeyError).toBeUndefined()
      expect(aliceKey).toBeDefined()

      const message = new TextEncoder().encode('Hello from Alice!')
      const [signatureError, signature] = service.signMessage(0n, message)
      
      expect(signatureError).toBeUndefined()
      expect(signature).toBeDefined()
      
      const [isValidError, isValid] = service.verifySignature(0n, message, signature!)
      expect(isValidError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should sign messages with Bob\'s Ed25519 key', () => {
      const [bobKeyError, bobKey] = service.getValidatorKey(1n)
      expect(bobKeyError).toBeUndefined()
      expect(bobKey).toBeDefined()

      const message = new TextEncoder().encode('Hello from Bob!')
      const [signatureError, signature] = service.signMessage(1n, message)
      expect(signatureError).toBeUndefined()
      
      expect(signature).toBeDefined()
      expect(signature?.length).toBe(64) // Ed25519 signature length
    })
  })

  describe('Dev Account Public Key Access', () => {
    it('should return Ed25519 public keys for all dev accounts', () => {
      for (let i = 0; i < 6; i++) {
        const publicKey = service.getEd25519PublicKey(BigInt(i))
        expect(publicKey).toBeDefined()
        expect(publicKey?.length).toBe(32)
      }
    })

    it('should return BLS public keys for all dev accounts', () => {
      for (let i = 0; i < 6; i++) {
        const publicKey = service.getBLSPublicKey(BigInt(i))
        expect(publicKey).toBeDefined()
        expect(publicKey?.length).toBe(144)
      }
    })

    it('should return Bandersnatch public keys for all dev accounts', () => {
      for (let i = 0; i < 6; i++) {
        const publicKey = service.getBandersnatchPublicKey(BigInt(i))
        expect(publicKey).toBeDefined()
        expect(publicKey?.length).toBe(32)
      }
    })
  })

  describe('Configuration', () => {
    it('should respect dev account count configuration', () => {
      const limitedService = new ValidatorKeyService({
        enableDevAccounts: true,
        devAccountCount: 3, // Only Alice, Bob, Carol
      })
      
      // Initialize the service
      limitedService.init().then(() => {
        expect(limitedService.getValidatorKey(0n)).toBeDefined()
        expect(limitedService.getValidatorKey(1n)).toBeDefined()
        expect(limitedService.getValidatorKey(2n)).toBeDefined()
      })
    })

    it('should fall back to regular validator keys when dev accounts disabled', () => {
      const regularService = new ValidatorKeyService({
        enableDevAccounts: false,
        validatorCount: 5,
      })
      
      // Initialize the service
      regularService.init().then(() => {
        expect(regularService.getValidatorKey(0n)).toBeDefined()
        expect(regularService.getValidatorKey(1n)).toBeDefined()
        expect(regularService.getValidatorKey(2n)).toBeDefined()
        expect(regularService.getValidatorKey(3n)).toBeDefined()
        expect(regularService.getValidatorKey(4n)).toBeDefined()
      })
    })
  })
})
