/**
 * Tests for dev accounts certificate generation
 * 
 * These tests verify that our certificate generation works correctly
 * with the JIP-5 secret key derivation.
 */

import { describe, it, expect } from 'vitest'
import { generateCertificateFromSeed } from '../src/crypto/certificates'
import { generateAlternativeName, generateTrivialSeed, safeError, safeResult } from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'
import type { FixedLengthSize } from '@pbnj/types'
// import { generateKeyPairFromSeed } from '@stablelib/ed25519'

describe('Dev Accounts Certificate Generation', () => {
  // Expected values from JIP-5 specification
  const devAccounts = {
    Alice: {
      index: 0,
      seed: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      ed25519_secret_seed: '0x996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59' as `0x${string}`,
      ed25519_public: '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace' as `0x${string}`,
      bandersnatch_secret_seed: '0x007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799' as `0x${string}`,
      bandersnatch_public: '0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3' as `0x${string}`
    },
    Bob: {
      index: 1,
      seed: '0x0100000001000000010000000100000001000000010000000100000001000000' as `0x${string}`,
      ed25519_secret_seed: '0xb81e308145d97464d2bc92d35d227a9e62241a16451af6da5053e309be4f91d7' as `0x${string}`,
      ed25519_public: '0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933' as `0x${string}`,
      bandersnatch_secret_seed: '0x12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac' as `0x${string}`,
      bandersnatch_public: '0xdee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91' as `0x${string}`
    },
    Carol: {
      index: 2,
      seed: '0x0200000002000000020000000200000002000000020000000200000002000000' as `0x${string}`,
      ed25519_secret_seed: '0x0093c8c10a88ebbc99b35b72897a26d259313ee9bad97436a437d2e43aaafa0f' as `0x${string}`,
      ed25519_public: '0xcab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341' as `0x${string}`,
      bandersnatch_secret_seed: '0x3d71dc0ffd02d90524fda3e4a220e7ec514a258c59457d3077ce4d4f003fd98a' as `0x${string}`,
      bandersnatch_public: '0x9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66' as `0x${string}`
    },
    David: {
      index: 3,
      seed: '0x0300000003000000030000000300000003000000030000000300000003000000' as `0x${string}`,
      ed25519_secret_seed: '0x69b3a7031787e12bfbdcac1b7a737b3e5a9f9450c37e215f6d3b57730e21001a' as `0x${string}`,
      ed25519_public: '0xf30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d' as `0x${string}`,
      bandersnatch_secret_seed: '0x107a9148b39a1099eeaee13ac0e3c6b9c256258b51c967747af0f8749398a276' as `0x${string}`,
      bandersnatch_public: '0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc' as `0x${string}`
    },
    Eve: {
      index: 4,
      seed: '0x0400000004000000040000000400000004000000040000000400000004000000' as `0x${string}`,
      ed25519_secret_seed: '0xb4de9ebf8db5428930baa5a98d26679ab2a03eae7c791d582e6b75b7f018d0d4' as `0x${string}`,
      ed25519_public: '0x8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a' as `0x${string}`,
      bandersnatch_secret_seed: '0x0bb36f5ba8e3ba602781bb714e67182410440ce18aa800c4cb4dd22525b70409' as `0x${string}`,
      bandersnatch_public: '0x151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b' as `0x${string}`
    },
    Fergie: {
      index: 5,
      seed: '0x0500000005000000050000000500000005000000050000000500000005000000' as `0x${string}`,
      ed25519_secret_seed: '0x4a6482f8f479e3ba2b845f8cef284f4b3208ba3241ed82caa1b5ce9fc6281730' as `0x${string}`,
      ed25519_public: '0xab0084d01534b31c1dd87c81645fd762482a90027754041ca1b56133d0466c06' as `0x${string}`,
      bandersnatch_secret_seed: '0x75e73b8364bf4753c5802021c6aa6548cddb63fe668e3cacf7b48cdb6824bb09' as `0x${string}`,
      bandersnatch_public: '0x2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e' as `0x${string}`
    }
  }

  describe('generateCertificateFromSeed', () => {
    it('should generate correct public keys for all dev accounts using JIP-5', async () => {
      for (const [_name, account] of Object.entries(devAccounts)) {
        // Generate certificate using the seed (which will use JIP-5 derivation internally)
        const [error, cert] = await generateCertificateFromSeed(account.seed)
        if (error) {
          throw error
        }
        
        // Verify public key matches expected value from JIP-5 exactly
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        const expectedPublicKey = account.ed25519_public.replace('0x', '')
        expect(actualPublicKey).toBe(expectedPublicKey)
        
        // Verify certificate structure
        expect(cert.certificate.publicKey).toHaveLength(32)
        expect(cert.certificate.alternativeName).toBeDefined()
      }
    })

    it('should generate consistent certificates for the same seed', async () => {
      const [error, cert1] = await generateCertificateFromSeed(devAccounts.Alice.seed)
      if (error) {
        throw error
      }
      const [error2, cert2] = await generateCertificateFromSeed(devAccounts.Alice.seed)
      if (error2) { 
        throw error2
      }
      
      expect(cert1.certificate.publicKey).toEqual(cert2.certificate.publicKey)
      expect(cert1.certificate.alternativeName).toBe(cert2.certificate.alternativeName)
    })

    it('should generate different certificates for different seeds', async () => {
      const [error, cert1] = await generateCertificateFromSeed(devAccounts.Alice.seed)
      if (error) {
        throw error
      }
      const [error2, cert2] = await generateCertificateFromSeed(devAccounts.Bob.seed)
      if (error2) {
        throw error2
      }
      
      expect(cert1.certificate.publicKey).not.toEqual(cert2.certificate.publicKey)
      expect(cert1.certificate.alternativeName).not.toBe(cert2.certificate.alternativeName)
    })

    it('should work with seeds with and without 0x prefix', async () => {
      const seedWithPrefix = devAccounts.Alice.seed
      const seedWithoutPrefix = devAccounts.Alice.seed.replace('0x', '')
      
      const [error, cert1] = await generateCertificateFromSeed(seedWithPrefix)
      if (error) {
        throw error
      }
      const [error2, cert2] = await generateCertificateFromSeed(seedWithoutPrefix as `0x${string}`)
      if (error2) {
        throw error2
      }
      
      expect(cert1.certificate.publicKey).toEqual(cert2.certificate.publicKey)
      expect(cert1.certificate.alternativeName).toBe(cert2.certificate.alternativeName)
    })
  })

  describe('Alternative Name Generation for Dev Accounts', () => {
    it('should generate correct alternative names for all dev accounts', async () => {
      for (const [_name, account] of Object.entries(devAccounts)) {
        const [error, cert] = await generateCertificateFromSeed(account.seed)
        if (error) {
          throw error
        }
        const alternativeName = cert.certificate.alternativeName
        
        // Verify format - should contain only valid base32 characters
        expect(alternativeName).toMatch(/^e[a-z2-7]+$/)
        expect(alternativeName.length).toBe(53) // 53 characters (e + 52 base32)
        
        // Verify it's consistent with direct generation from Ed25519 public key
        const publicKey = new Uint8Array(Buffer.from(account.ed25519_public.replace('0x', ''), 'hex'))
        // Create adapter function for decodeFixedLength
        const decoderAdapter = (data: Uint8Array, length: bigint) => {
          const [error, result] = decodeFixedLength(data, length as FixedLengthSize)
          if (error) {
            return safeError(error)
          }
          return safeResult({ value: result.value, remaining: result.remaining })
        }
        const directAlternativeName = generateAlternativeName(publicKey, decoderAdapter)
        expect(alternativeName).toBe(directAlternativeName)
      }
    })

    it('should generate different alternative names for different accounts', async () => {
      const [error, aliceCert] = await generateCertificateFromSeed(devAccounts.Alice.seed)
      if (error) {
        throw error
      }
      const [error2, bobCert] = await generateCertificateFromSeed(devAccounts.Bob.seed)
      if (error2) {
        throw error2
      }
      const [error3, carolCert] = await generateCertificateFromSeed(devAccounts.Carol.seed)
      if (error3) {
        throw error3
      }
      
      const aliceAltName = aliceCert.certificate.alternativeName
      const bobAltName = bobCert.certificate.alternativeName
      const carolAltName = carolCert?.certificate.alternativeName ?? ''
      
      expect(aliceAltName).not.toBe(bobAltName)
      expect(aliceAltName).not.toBe(carolAltName)
      expect(bobAltName).not.toBe(carolAltName)
      
      // All should be 53 characters (e + 52 base32)
      expect(aliceAltName.length).toBe(53)
      expect(bobAltName.length).toBe(53)
      expect(carolAltName.length).toBe(53)
    })
  })

  describe('Individual Dev Account Tests', () => {
    describe('Alice', () => {
      it('should generate correct Alice certificate', async () => {
        const [error, cert] = await generateCertificateFromSeed(devAccounts.Alice.seed)
        if (error) {
          throw error
        }
        const expectedPublicKey = devAccounts.Alice.ed25519_public.replace('0x', '')
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        
        expect(actualPublicKey).toBe(expectedPublicKey)
      })
    })

    describe('Bob', () => {
      it('should generate correct Bob certificate', async () => {
        const [error, cert] = await generateCertificateFromSeed(devAccounts.Bob.seed)
        if (error) {
          throw error
        }
        const expectedPublicKey = devAccounts.Bob.ed25519_public.replace('0x', '')
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        
        expect(actualPublicKey).toBe(expectedPublicKey)
      })
    })

    describe('Carol', () => {
      it('should generate correct Carol certificate', async () => {
        const [error, cert] = await generateCertificateFromSeed(devAccounts.Carol.seed)
        if (error) {
          throw error
        }
        const expectedPublicKey = devAccounts.Carol.ed25519_public.replace('0x', '')
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        
        expect(actualPublicKey).toBe(expectedPublicKey)
      })
    })

    describe('David', () => {
      it('should generate correct David certificate', async () => {
        const [error, cert] = await generateCertificateFromSeed(devAccounts.David.seed)
        if (error) {
          throw error
        }
        const expectedPublicKey = devAccounts.David.ed25519_public.replace('0x', '')
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        
        expect(actualPublicKey).toBe(expectedPublicKey)
      })
    })

    describe('Eve', () => {
      it('should generate correct Eve certificate', async () => {
        const [error, cert] = await generateCertificateFromSeed(devAccounts.Eve.seed)
        if (error) {
          throw error
        }
        const expectedPublicKey = devAccounts.Eve.ed25519_public.replace('0x', '')
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        
        expect(actualPublicKey).toBe(expectedPublicKey)
      })
    })

    describe('Fergie', () => {
      it('should generate correct Fergie certificate', async () => {
        const [error, cert] = await generateCertificateFromSeed(devAccounts.Fergie.seed)
        if (error) {
          throw error
        }
        const expectedPublicKey = devAccounts.Fergie.ed25519_public.replace('0x', '')
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        
        expect(actualPublicKey).toBe(expectedPublicKey)
      })
    })
  })

  describe('Alternative Name Validation', () => {
    it('should use correct base32 alphabet for all accounts', async () => {
      const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
      
      for (const [_name, account] of Object.entries(devAccounts)) {
        const [error, cert] = await generateCertificateFromSeed(account.seed)
        if (error) {
          throw error
        }
        const alternativeName = cert.certificate.alternativeName
        
        // Remove the e prefix
        const base32Part = alternativeName.slice(1)
        
        // Verify all characters are in the base32 alphabet
        for (const char of base32Part) {
          expect(base32Alphabet).toContain(char)
        }
      }
    })

    it('should generate alternative names with correct length', async () => {
      for (const [_name, account] of Object.entries(devAccounts)) {
        const [error, cert] = await generateCertificateFromSeed(account.seed)
        if (error) {
          throw error
        }
        const alternativeName = cert.certificate.alternativeName

        expect(alternativeName.length).toBe(53) // 53 characters (e + 52 base32)
      }
    })

    it('should generate specific alternative names for each dev account', async () => {
      // Test specific alternative names for each account
      const [error, aliceCert] = await generateCertificateFromSeed(devAccounts.Alice.seed)
      if (error) {
        throw error
      }
      const [error2, bobCert] = await generateCertificateFromSeed(devAccounts.Bob.seed)
      if (error2) {
        throw error2
      }
      const [error3, carolCert] = await generateCertificateFromSeed(devAccounts.Carol.seed)
      if (error3) {
        throw error3
      }
      const [error4, davidCert] = await generateCertificateFromSeed(devAccounts.David.seed)
      if (error4) {
        throw error4
      }
      const [error5, eveCert] = await generateCertificateFromSeed(devAccounts.Eve.seed)
      if (error5) {
        throw error5
      }
      const [error6, fergieCert] = await generateCertificateFromSeed(devAccounts.Fergie.seed)
      if (error6) {
        throw error6
      }

      // Log the generated alternative names for reference
      console.log('Generated alternative names:')
      console.log(`Alice: ${aliceCert.certificate.alternativeName}`)
      console.log(`Bob: ${bobCert.certificate.alternativeName}`)
      console.log(`Carol: ${carolCert.certificate.alternativeName}`)
      console.log(`David: ${davidCert.certificate.alternativeName}`)
      console.log(`Eve: ${eveCert.certificate.alternativeName}`)
      console.log(`Fergie: ${fergieCert.certificate.alternativeName}`)

      // Verify they are all different
      const altNames = [
        aliceCert.certificate.alternativeName,
        bobCert.certificate.alternativeName,
        carolCert.certificate.alternativeName,
        davidCert.certificate.alternativeName,
        eveCert.certificate.alternativeName,
        fergieCert.certificate.alternativeName
      ]

      // Check that all alternative names are unique
      const uniqueAltNames = new Set(altNames)
      expect(uniqueAltNames.size).toBe(6)

      // Verify each alternative name has the correct format
      for (const altName of altNames) {
        expect(altName).toMatch(/^e[a-z2-7]{52}$/)
        expect(altName.length).toBe(53)
      }
    })

    it('should generate consistent alternative names for the same public key', async () => {
      for (const [_name, account] of Object.entries(devAccounts)) {
        const [error, cert1] = await generateCertificateFromSeed(account.seed)
        if (error) {
          throw error
        }
        const [error2, cert2] = await generateCertificateFromSeed(account.seed)
        if (error2) {
          throw error2
        }
        
        expect(cert1.certificate.alternativeName).toBe(cert2.certificate.alternativeName)
        
        // Also test direct generation from public key
        const publicKey = new Uint8Array(Buffer.from(account.ed25519_public.replace('0x', ''), 'hex'))
        const directAltName = generateAlternativeName(publicKey, decodeFixedLength)
        
        expect(cert1.certificate.alternativeName).toBe(directAltName)
      }
    })
  })

  describe('PEM Format Validation', () => {
    it('should generate valid PEM formats for all accounts', async  () => {
      for (const [_name, account] of Object.entries(devAccounts)) {
        const [error, cert] = await generateCertificateFromSeed(account.seed)
        if (error) {
          throw error
        }
        
        expect(cert.certificatePEM).toContain('-----BEGIN CERTIFICATE-----')
        expect(cert.certificatePEM).toContain('-----END CERTIFICATE-----')
      }
    })
  })

  describe('JIP-5 Integration', () => {
    it('should correctly derive secret seeds using JIP-5', async () => {
      for (const [_name, account] of Object.entries(devAccounts)) {
        // Generate trivial seed from index
        const trivialSeed = generateTrivialSeed(account.index)
        const expectedSeed = new Uint8Array(Buffer.from(account.seed.replace('0x', ''), 'hex'))
        expect(trivialSeed).toEqual(expectedSeed)
        
        // Generate certificate using the seed
        const [error, cert] = await generateCertificateFromSeed(account.seed)
        if (error) {
          throw error
        }
        const actualPublicKey = Buffer.from(cert.certificate.publicKey).toString('hex')
        const expectedPublicKey = account.ed25519_public.replace('0x', '')
        
        expect(actualPublicKey).toBe(expectedPublicKey)
      }
    })
  })
}) 