/**
 * Tests for JIP-5 secret key derivation
 * 
 * These tests verify that our JIP-5 implementation produces the correct
 * Ed25519 and Bandersnatch secret seeds from the test vectors.
 */

import { describe, it, expect } from 'vitest'
import { deriveSecretSeeds, generateTrivialSeed } from '@pbnj/core'
import { generateKeyPairFromSeed } from '@stablelib/ed25519'

describe('JIP-5 Secret Key Derivation', () => {
  describe('Trivial Seed Generation', () => {
    it('should generate correct trivial seeds', () => {
      // Test vector 0
      const [seed0Error, seed0] = generateTrivialSeed(0)
      if (seed0Error) {
        throw seed0Error
      }
      const expectedSeed0 = new Uint8Array(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'))
      expect(seed0).toEqual(expectedSeed0)

      // Test vector 1
      const [seed1Error, seed1] = generateTrivialSeed(1)
      if (seed1Error) {
        throw seed1Error
      }
      const expectedSeed1 = new Uint8Array(Buffer.from('0100000001000000010000000100000001000000010000000100000001000000', 'hex'))
      expect(seed1).toEqual(expectedSeed1)

      // Test vector 2
      const [seed2Error, seed2] = generateTrivialSeed(2)
      if (seed2Error) {
        throw seed2Error
      }
      const expectedSeed2 = new Uint8Array(Buffer.from('0200000002000000020000000200000002000000020000000200000002000000', 'hex'))
      expect(seed2).toEqual(expectedSeed2)
    })

    it('should reject invalid indices', () => {
      const [error1] = generateTrivialSeed(-1)
      expect(error1).toBeDefined()
      expect(error1?.message).toBe('Index must be a 32-bit unsigned integer')
      
      const [error2] = generateTrivialSeed(0x100000000)
      expect(error2).toBeDefined()
      expect(error2?.message).toBe('Index must be a 32-bit unsigned integer')
    })
  })

  describe('Secret Seed Derivation', () => {
    it('should derive correct Ed25519 secret seeds from test vectors', () => {
      // Test vector 0
      const [seed0Error, seed0] = generateTrivialSeed(0)
      if (seed0Error) {
        throw seed0Error
      }
      const [secret0Error, secret0] = deriveSecretSeeds(seed0)
      if (secret0Error) {
        throw secret0Error
      }
      const expectedSecret0 = new Uint8Array(Buffer.from('996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59', 'hex'))
      expect(secret0.ed25519SecretSeed).toEqual(expectedSecret0)

      // Test vector 1
      const [seed1Error, seed1] = generateTrivialSeed(1)
      if (seed1Error) {
        throw seed1Error
      }
      const [secret1Error, secret1] = deriveSecretSeeds(seed1)
      if (secret1Error) {
        throw secret1Error
      }
      const expectedSecret1 = new Uint8Array(Buffer.from('b81e308145d97464d2bc92d35d227a9e62241a16451af6da5053e309be4f91d7', 'hex'))
      expect(secret1.ed25519SecretSeed).toEqual(expectedSecret1)

      // Test vector 2
      const [seed2Error, seed2] = generateTrivialSeed(2)
      if (seed2Error) {
        throw seed2Error
      }
      const [secret2Error, secret2] = deriveSecretSeeds(seed2)
      if (secret2Error) {
        throw secret2Error
      }
      const expectedSecret2 = new Uint8Array(Buffer.from('0093c8c10a88ebbc99b35b72897a26d259313ee9bad97436a437d2e43aaafa0f', 'hex'))
      expect(secret2.ed25519SecretSeed).toEqual(expectedSecret2)
    })

    it('should derive correct Bandersnatch secret seeds from test vectors', () => {
      // Test vector 0
      const [seed0Error, seed0] = generateTrivialSeed(0)
      if (seed0Error) {
        throw seed0Error
      }
      const [secret0Error, secret0] = deriveSecretSeeds(seed0)
      if (secret0Error) {
        throw secret0Error
      }
      const expectedSecret0 = new Uint8Array(Buffer.from('007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799', 'hex'))
      expect(secret0.bandersnatchSecretSeed).toEqual(expectedSecret0)

      // Test vector 1
      const [seed1Error, seed1] = generateTrivialSeed(1)
      if (seed1Error) {
        throw seed1Error
      }
      const [secret1Error, secret1] = deriveSecretSeeds(seed1)
      if (secret1Error) {
        throw secret1Error
      }
      const expectedSecret1 = new Uint8Array(Buffer.from('12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac', 'hex'))
      expect(secret1.bandersnatchSecretSeed).toEqual(expectedSecret1)

      // Test vector 2
      const [seed2Error, seed2] = generateTrivialSeed(2)
      if (seed2Error) {
        throw seed2Error
      }
      const [secret2Error, secret2] = deriveSecretSeeds(seed2)
      if (secret2Error) {
        throw secret2Error
      }
      const expectedSecret2 = new Uint8Array(Buffer.from('3d71dc0ffd02d90524fda3e4a220e7ec514a258c59457d3077ce4d4f003fd98a', 'hex'))
      expect(secret2.bandersnatchSecretSeed).toEqual(expectedSecret2)
    })

    it('should reject invalid seed lengths', () => {
      const shortSeed = new Uint8Array(16)
      const [error1] = deriveSecretSeeds(shortSeed)
      expect(error1).toBeDefined()
      expect(error1?.message).toBe('Seed must be exactly 32 bytes')

      const longSeed = new Uint8Array(64)
      const [error2] = deriveSecretSeeds(longSeed)
      expect(error2).toBeDefined()
      expect(error2?.message).toBe('Seed must be exactly 32 bytes')
    })
  })

  describe('Public Key Generation from Secret Seeds', () => {
    it('should generate correct Ed25519 public keys from derived secret seeds', () => {
      // Test vector 0
      const [seed0Error, seed0] = generateTrivialSeed(0)
      if (seed0Error) {
        throw seed0Error
      }

      const [secret0Error, secret0] = deriveSecretSeeds(seed0)
      if (secret0Error) {
        throw secret0Error
      }
      const { publicKey: publicKey0 } = generateKeyPairFromSeed(secret0.ed25519SecretSeed)
      const expectedPublicKey0 = new Uint8Array(Buffer.from('4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace', 'hex'))
      expect(publicKey0).toEqual(expectedPublicKey0)

      // Test vector 1
      const [seed1Error, seed1] = generateTrivialSeed(1)
      if (seed1Error) {
        throw seed1Error
      }
      const [secret1Error, secret1] = deriveSecretSeeds(seed1)
      if (secret1Error) {
        throw secret1Error
      }
      const { publicKey: publicKey1 } = generateKeyPairFromSeed(secret1.ed25519SecretSeed)
      const expectedPublicKey1 = new Uint8Array(Buffer.from('ad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933', 'hex'))
      expect(publicKey1).toEqual(expectedPublicKey1)

      // Test vector 2
      const [seed2Error, seed2] = generateTrivialSeed(2)
      if (seed2Error) {
        throw seed2Error
      }
      const [secret2Error, secret2] = deriveSecretSeeds(seed2)
      if (secret2Error) {
        throw secret2Error
      }
      const { publicKey: publicKey2 } = generateKeyPairFromSeed(secret2.ed25519SecretSeed)
      const expectedPublicKey2 = new Uint8Array(Buffer.from('cab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341', 'hex'))
      expect(publicKey2).toEqual(expectedPublicKey2)
    })

    it('should generate correct Bandersnatch public keys from derived secret seeds', () => {
      // Note: This test assumes we have a Bandersnatch key generation function
      // For now, we'll just verify the secret seeds are correct
      // TODO: Add Bandersnatch key generation when available
      
      // Test vector 0
      const [seed0Error, seed0] = generateTrivialSeed(0)
      if (seed0Error) {
        throw seed0Error
      }
      const [secret0Error, secret0] = deriveSecretSeeds(seed0)
      if (secret0Error) {
        throw secret0Error
      }
      const expectedSecret0 = new Uint8Array(Buffer.from('007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799', 'hex'))
      expect(secret0.bandersnatchSecretSeed).toEqual(expectedSecret0)

      // Test vector 1
      const [seed1Error, seed1] = generateTrivialSeed(1)
      if (seed1Error) {
        throw seed1Error
      }
      const [secret1Error, secret1] = deriveSecretSeeds(seed1)
      if (secret1Error) {
        throw secret1Error
      }
      const expectedSecret1 = new Uint8Array(Buffer.from('12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac', 'hex'))
      expect(secret1.bandersnatchSecretSeed).toEqual(expectedSecret1)

      // Test vector 2
      const [seed2Error, seed2] = generateTrivialSeed(2)
      if (seed2Error) {
        throw seed2Error
      }
      const [secret2Error, secret2] = deriveSecretSeeds(seed2)
      if (secret2Error) {
        throw secret2Error
      }
      const expectedSecret2 = new Uint8Array(Buffer.from('3d71dc0ffd02d90524fda3e4a220e7ec514a258c59457d3077ce4d4f003fd98a', 'hex'))
      expect(secret2.bandersnatchSecretSeed).toEqual(expectedSecret2)
    })
  })

  describe('Complete Test Vectors', () => {
    it('should match all JIP-5 test vectors', () => {
      const testVectors = [
        {
          index: 0,
          seed: '0000000000000000000000000000000000000000000000000000000000000000',
          ed25519_secret_seed: '996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59',
          ed25519_public: '4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace',
          bandersnatch_secret_seed: '007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799',
          bandersnatch_public: 'ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3'
        },
        {
          index: 1,
          seed: '0100000001000000010000000100000001000000010000000100000001000000',
          ed25519_secret_seed: 'b81e308145d97464d2bc92d35d227a9e62241a16451af6da5053e309be4f91d7',
          ed25519_public: 'ad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933',
          bandersnatch_secret_seed: '12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac',
          bandersnatch_public: 'dee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91'
        },
        {
          index: 2,
          seed: '0200000002000000020000000200000002000000020000000200000002000000',
          ed25519_secret_seed: '0093c8c10a88ebbc99b35b72897a26d259313ee9bad97436a437d2e43aaafa0f',
          ed25519_public: 'cab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341',
          bandersnatch_secret_seed: '3d71dc0ffd02d90524fda3e4a220e7ec514a258c59457d3077ce4d4f003fd98a',
          bandersnatch_public: '9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66'
        }
      ]

      for (const vector of testVectors) {
        // Generate trivial seed
        const [seedError, seed] = generateTrivialSeed(vector.index)
        if (seedError) {
          throw seedError
        }
        expect(seed).toEqual(new Uint8Array(Buffer.from(vector.seed, 'hex')))

        // Derive secret seeds
        const [ed25519_secret_seedError, ed25519_secret_seed] = deriveSecretSeeds(seed)
        if (ed25519_secret_seedError) {
          throw ed25519_secret_seedError
        }
        const [bandersnatch_secret_seedError, bandersnatch_secret_seed] = deriveSecretSeeds(seed)
        if (bandersnatch_secret_seedError) {
          throw bandersnatch_secret_seedError
        }
        expect(ed25519_secret_seed.ed25519SecretSeed).toEqual(new Uint8Array(Buffer.from(vector.ed25519_secret_seed, 'hex')))
        expect(bandersnatch_secret_seed.bandersnatchSecretSeed).toEqual(new Uint8Array(Buffer.from(vector.bandersnatch_secret_seed, 'hex')))

        // Generate Ed25519 public key from secret seed
        const { publicKey: ed25519_public } = generateKeyPairFromSeed(ed25519_secret_seed.ed25519SecretSeed)
        expect(ed25519_public).toEqual(new Uint8Array(Buffer.from(vector.ed25519_public, 'hex')))

        // TODO: Add Bandersnatch public key generation when available
        // const { publicKey: bandersnatch_public } = generateBandersnatchKeyPairFromSeed(bandersnatch_secret_seed)
        // expect(bandersnatch_public).toEqual(new Uint8Array(Buffer.from(vector.bandersnatch_public, 'hex')))
      }
    })
  })
})