/**
 * Tests for Alice's certificate generation
 * 
 * These tests verify that Alice's certificate is generated correctly
 * using the JIP-5 secret key derivation.
 */

import { describe, it, expect } from 'vitest'
import { generateCertificateFromSeed, toDisplayAlternativeName } from '../src/crypto/certificates'
import { generateAlternativeName } from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'

describe('Alice Certificate Generation', () => {
  // Alice's seed from JIP-5 specification (index 0)
  const aliceSeed = '0x0000000000000000000000000000000000000000000000000000000000000000'
  
  // Expected values from JIP-5 specification for Alice (index 0)
  const expectedPublicKey = '4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace'
  // Note: The alternative name is derived from the public key that's generated through the full JIP-5 process
  // which produces the alternative name 'ebtu2...' consistently
  const expectedAlternativeNameRaw = 'ebtu2jfrnpe5qkaxsuicgivq44vzumtjvmj4mji4ykon3qwgpwgce'
  const expectedAlternativeName = '$ebtu2jfrnpe5qkaxsuicgivq44vzumtjvmj4mji4ykon3qwgpwgce'
  
  // Expected PEM formats (these will be different due to JIP-5 derivation)
  const expectedPrivateKeyPEM = '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCCZZUK+zfHngnjceVZ5yCX6yi6e0r8QG/PEojbT7XnPWQ==\n-----END PRIVATE KEY-----'
  const expectedPublicKeyPEM = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEARBj7jIW7OYU5SownVtNkNFfOYUVGICovULCT12JJms4=\n-----END PUBLIC KEY-----'
  
  // Expected base64 content
  //   const expectedPrivateKeyBase64 = 'MC4CAQAwBQYDK2VwBCCZZUK+zfHngnjceVZ5yCX6yi6e0r8QG/PEojbT7XnPWQ=='
  // const expectedPublicKeyBase64 = 'MCowBQYDK2VwAyEARBj7jIW7OYU5SownVtNkNFfOYUVGICovULCT12JJms4='

  describe('generateCertificateFromSeed for Alice', () => {
    it('should generate Alice\'s certificate with correct public key', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }
      const actualPublicKey = Buffer.from(aliceCert.certificate.publicKey).toString('hex')

      expect(actualPublicKey).toBe(expectedPublicKey)
    })

    it('should generate correct private key PEM format', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }

      expect(aliceCert.certificatePEM).toBe(expectedPrivateKeyPEM)
    })

    it('should generate correct public key PEM format', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }

      expect(aliceCert.certificatePEM).toBe(expectedPublicKeyPEM)
    })


    it('should generate alternative name with correct format', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }
      const alternativeName = aliceCert.certificate.alternativeName
      const displayAlternativeName = toDisplayAlternativeName(alternativeName)

      expect(alternativeName).toMatch(/^[a-z2-7]{52}$/) // Raw format without $e
      expect(displayAlternativeName).toMatch(/^\$e[a-z2-7]{52}$/) // Display format with $e
      expect(displayAlternativeName).toBe(expectedAlternativeName)
      expect(alternativeName).toBe(expectedAlternativeNameRaw)
    })

    it('should generate consistent alternative names', () => {
      const [cert1Error, cert1] = generateCertificateFromSeed(aliceSeed)
      if (cert1Error) {
        throw cert1Error
      }
      const [cert2Error, cert2] = generateCertificateFromSeed(aliceSeed)
      if (cert2Error) {
        throw cert2Error
      }

      expect(cert1.certificate.alternativeName).toBe(cert2.certificate.alternativeName)
      expect(cert1.certificate.alternativeName).toBe(expectedAlternativeNameRaw)
      expect(toDisplayAlternativeName(cert1.certificate.alternativeName)).toBe(expectedAlternativeName)
    })

    it('should generate certificate with correct structure', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }

      expect(aliceCert.certificate.publicKey).toHaveLength(32)
      expect(aliceCert.certificate.alternativeName).toBeDefined()
      expect(aliceCert.certificatePEM).toContain('-----BEGIN CERTIFICATE-----')
      expect(aliceCert.certificatePEM).toContain('-----END CERTIFICATE-----')
    })
  })

  describe('generateAlternativeName', () => {
    it('should generate correct alternative name for Alice\'s public key', () => {
      const testPublicKey = Buffer.from(expectedPublicKey, 'hex')
      const [alternativeNameError, alternativeName] = generateAlternativeName(testPublicKey, decodeFixedLength)
      if (alternativeNameError) {
        throw alternativeNameError
      }
      const [displayAlternativeNameError, displayAlternativeName] = toDisplayAlternativeName(alternativeName)
      if (displayAlternativeNameError) {
        throw displayAlternativeNameError
      }

      expect(alternativeName).toMatch(/^[a-z2-7]{52}$/) // Raw format without $e
      expect(displayAlternativeName).toMatch(/^\$e[a-z2-7]{52}$/) // Display format with $e
      expect(displayAlternativeName).toBe(expectedAlternativeName)
      expect(alternativeName).toBe(expectedAlternativeNameRaw)
    })

    it('should generate consistent alternative names for the same key', () => {
      const testPublicKey = Buffer.from(expectedPublicKey, 'hex')
      const [altName1Error, altName1] = generateAlternativeName(testPublicKey, decodeFixedLength)
      if (altName1Error) {
        throw altName1Error
      }
      const [altName2Error, altName2] = generateAlternativeName(testPublicKey, decodeFixedLength)
      if (altName2Error) {
        throw altName2Error
      }

      expect(altName1).toBe(altName2)
      expect(altName1).toBe(expectedAlternativeNameRaw)
      expect(toDisplayAlternativeName(altName1)).toBe(expectedAlternativeName)
    })

    it('should generate different alternative names for different keys', () => {
      const key1 = Buffer.from(expectedPublicKey, 'hex')
      const key2 = Buffer.alloc(32, 1) // Different key

      const [altName1Error, altName1] = generateAlternativeName(key1, decodeFixedLength)
      if (altName1Error) {
        throw altName1Error
      }
      const [altName2Error, altName2] = generateAlternativeName(key2, decodeFixedLength)
      if (altName2Error) {
        throw altName2Error
      }

      expect(altName1).not.toBe(altName2)
    })

    it('should use correct base32 alphabet', () => {
      const testPublicKey = Buffer.from(expectedPublicKey, 'hex')
      const [alternativeNameError, alternativeName] = generateAlternativeName(testPublicKey, decodeFixedLength)
      if (alternativeNameError) {
        throw alternativeNameError
      }
      const base32Part = alternativeName.slice(2) // Remove $e prefix
      const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567'

      for (const char of base32Part) {
        expect(base32Alphabet).toContain(char)
      }
    })
  })

  describe('PEM format validation', () => {
    it('should generate valid PEM headers and footers', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }

      expect(aliceCert.certificatePEM).toMatch(/^-----BEGIN CERTIFICATE-----\n.*\n-----END CERTIFICATE-----$/)
    })

  })

  describe('OpenSSL compatibility', () => {
    it('should generate private key that matches OpenSSL format', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }

      // Verify the private key PEM follows OpenSSL Ed25519 format
      expect(aliceCert.certificatePEM).toContain('-----BEGIN PRIVATE KEY-----')
      expect(aliceCert.certificatePEM).toContain('-----END PRIVATE KEY-----')
      expect(aliceCert.certificatePEM).toContain('MC4CAQAwBQYDK2Vw')
    })

    it('should generate public key that matches OpenSSL format', () => {
      const [aliceCertError, aliceCert] = generateCertificateFromSeed(aliceSeed)
      if (aliceCertError) {
        throw aliceCertError
      }

      // Verify the public key PEM follows OpenSSL Ed25519 format
      expect(aliceCert.certificatePEM).toContain('-----BEGIN PUBLIC KEY-----')
      expect(aliceCert.certificatePEM).toContain('-----END PUBLIC KEY-----')
      expect(aliceCert.certificatePEM).toContain('MCowBQYDK2Vw')
    })
  })
}) 