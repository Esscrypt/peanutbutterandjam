/**
 * Tests for Alice's certificate generation
 * 
 * These tests verify that Alice's certificate is generated correctly
 * using the JIP-5 secret key derivation.
 */

import { describe, it, expect } from 'vitest'
import { generateAliceCertificate, generateAlternativeName } from '../src/crypto/certificates'

describe('Alice Certificate Generation', () => {
  // Expected values from JIP-5 specification for Alice (index 0)
  const expectedPublicKey = '4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace'
  const expectedAlternativeName = '$ebtu2jfrnpe5qkaxsuicgivq44vzumtjvmj4mji4ykon3qwgpwgce'
  
  // Expected PEM formats (these will be different due to JIP-5 derivation)
  const expectedPrivateKeyPEM = '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCCZZUK+zfHngnjceVZ5yCX6yi6e0r8QG/PEojbT7XnPWQ==\n-----END PRIVATE KEY-----'
  const expectedPublicKeyPEM = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEARBj7jIW7OYU5SownVtNkNFfOYUVGICovULCT12JJms4=\n-----END PUBLIC KEY-----'
  
  // Expected base64 content
  const expectedPrivateKeyBase64 = 'MC4CAQAwBQYDK2VwBCCZZUK+zfHngnjceVZ5yCX6yi6e0r8QG/PEojbT7XnPWQ=='
  const expectedPublicKeyBase64 = 'MCowBQYDK2VwAyEARBj7jIW7OYU5SownVtNkNFfOYUVGICovULCT12JJms4='

  describe('generateAliceCertificate', () => {
    it('should generate Alice\'s certificate with correct public key', () => {
      const aliceCert = generateAliceCertificate()
      const actualPublicKey = Buffer.from(aliceCert.certificate.publicKey).toString('hex')

      expect(actualPublicKey).toBe(expectedPublicKey)
    })

    it('should generate correct private key PEM format', () => {
      const aliceCert = generateAliceCertificate()

      expect(aliceCert.privateKeyPEM).toBe(expectedPrivateKeyPEM)
    })

    it('should generate correct public key PEM format', () => {
      const aliceCert = generateAliceCertificate()

      expect(aliceCert.publicKeyPEM).toBe(expectedPublicKeyPEM)
    })

    it('should generate correct base64 content for private key', () => {
      const aliceCert = generateAliceCertificate()
      const actualPrivateKeyBase64 = aliceCert.privateKeyPEM
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\n/g, '')
        .trim()

      expect(actualPrivateKeyBase64).toBe(expectedPrivateKeyBase64)
    })

    it('should generate correct base64 content for public key', () => {
      const aliceCert = generateAliceCertificate()
      const actualPublicKeyBase64 = aliceCert.publicKeyPEM
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\n/g, '')
        .trim()

      expect(actualPublicKeyBase64).toBe(expectedPublicKeyBase64)
    })

    it('should generate alternative name with correct format', () => {
      const aliceCert = generateAliceCertificate()
      const alternativeName = aliceCert.certificate.alternativeName

      expect(alternativeName).toMatch(/^\$e[a-z2-7]{52}$/)
      expect(alternativeName).toBe(expectedAlternativeName)
    })

    it('should generate consistent alternative names', () => {
      const cert1 = generateAliceCertificate()
      const cert2 = generateAliceCertificate()

      expect(cert1.certificate.alternativeName).toBe(cert2.certificate.alternativeName)
      expect(cert1.certificate.alternativeName).toBe(expectedAlternativeName)
    })

    it('should generate certificate with correct structure', () => {
      const aliceCert = generateAliceCertificate()

      expect(aliceCert.certificate.publicKey).toHaveLength(32)
      expect(aliceCert.certificate.alternativeName).toBeDefined()
      expect(aliceCert.privateKeyPEM).toContain('-----BEGIN PRIVATE KEY-----')
      expect(aliceCert.publicKeyPEM).toContain('-----BEGIN PUBLIC KEY-----')
    })
  })

  describe('generateAlternativeName', () => {
    it('should generate correct alternative name for Alice\'s public key', () => {
      const testPublicKey = Buffer.from(expectedPublicKey, 'hex')
      const alternativeName = generateAlternativeName(testPublicKey)

      expect(alternativeName).toMatch(/^\$e[a-z2-7]{52}$/)
      expect(alternativeName).toBe(expectedAlternativeName)
    })

    it('should generate consistent alternative names for the same key', () => {
      const testPublicKey = Buffer.from(expectedPublicKey, 'hex')
      const altName1 = generateAlternativeName(testPublicKey)
      const altName2 = generateAlternativeName(testPublicKey)

      expect(altName1).toBe(altName2)
      expect(altName1).toBe(expectedAlternativeName)
    })

    it('should generate different alternative names for different keys', () => {
      const key1 = Buffer.from(expectedPublicKey, 'hex')
      const key2 = Buffer.alloc(32, 1) // Different key

      const altName1 = generateAlternativeName(key1)
      const altName2 = generateAlternativeName(key2)

      expect(altName1).not.toBe(altName2)
    })

    it('should use correct base32 alphabet', () => {
      const testPublicKey = Buffer.from(expectedPublicKey, 'hex')
      const alternativeName = generateAlternativeName(testPublicKey)
      const base32Part = alternativeName.slice(2) // Remove $e prefix
      const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567'

      for (const char of base32Part) {
        expect(base32Alphabet).toContain(char)
      }
    })
  })

  describe('PEM format validation', () => {
    it('should generate valid PEM headers and footers', () => {
      const aliceCert = generateAliceCertificate()

      expect(aliceCert.privateKeyPEM).toMatch(/^-----BEGIN PRIVATE KEY-----\n.*\n-----END PRIVATE KEY-----$/)
      expect(aliceCert.publicKeyPEM).toMatch(/^-----BEGIN PUBLIC KEY-----\n.*\n-----END PUBLIC KEY-----$/)
    })

    it('should contain valid base64 content', () => {
      const aliceCert = generateAliceCertificate()

      const privateKeyContent = aliceCert.privateKeyPEM
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\n/g, '')
        .trim()

      const publicKeyContent = aliceCert.publicKeyPEM
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\n/g, '')
        .trim()

      expect(privateKeyContent).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
      expect(publicKeyContent).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    })
  })

  describe('OpenSSL compatibility', () => {
    it('should generate private key that matches OpenSSL format', () => {
      const aliceCert = generateAliceCertificate()

      // Verify the private key PEM follows OpenSSL Ed25519 format
      expect(aliceCert.privateKeyPEM).toContain('-----BEGIN PRIVATE KEY-----')
      expect(aliceCert.privateKeyPEM).toContain('-----END PRIVATE KEY-----')
      expect(aliceCert.privateKeyPEM).toContain('MC4CAQAwBQYDK2Vw')
    })

    it('should generate public key that matches OpenSSL format', () => {
      const aliceCert = generateAliceCertificate()

      // Verify the public key PEM follows OpenSSL Ed25519 format
      expect(aliceCert.publicKeyPEM).toContain('-----BEGIN PUBLIC KEY-----')
      expect(aliceCert.publicKeyPEM).toContain('-----END PUBLIC KEY-----')
      expect(aliceCert.publicKeyPEM).toContain('MCowBQYDK2Vw')
    })
  })
}) 