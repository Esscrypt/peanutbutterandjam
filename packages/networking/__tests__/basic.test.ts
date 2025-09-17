/**
 * Basic tests for JAMNP-S networking implementation
 */

import { describe, it, expect } from 'vitest'
import { generateEd25519KeyPairStable as generateEd25519KeyPair, signEd25519, verifyEd25519 } from '@pbnj/core'
import { generateCertificate, validateCertificate } from '../src/crypto/certificates'
import { generateAlternativeName } from '@pbnj/core'
import { generateALPNProtocol, parseALPNProtocol } from '../src/crypto/tls'
import { decodeFixedLength } from '@pbnj/serialization'

describe('JAMNP-S Networking Implementation', () => {
  describe('Key Management', () => {
    it('should generate Ed25519 key pairs', () => {
      const keyPair = generateEd25519KeyPair()
      
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.publicKey.length).toBe(32)
      expect(keyPair.privateKey.length).toBe(64) // Ed25519 private key is 64 bytes (32 bytes seed + 32 bytes public key)
    })

    it('should sign and verify data with Ed25519', () => {
      const keyPair = generateEd25519KeyPair()
      const data = new TextEncoder().encode('Hello, JAMNP-S!')
      
      const [signatureError, signature] = signEd25519(data, keyPair.privateKey)
      if (signatureError) {
        throw signatureError
      }
      const isValid = verifyEd25519(data, signature, keyPair.publicKey)
      
      expect(signature).toBeInstanceOf(Uint8Array)
      expect(signature.length).toBe(64)
      expect(isValid).toBe(true)
    })

    it('should reject invalid signatures', () => {
      const keyPair = generateEd25519KeyPair()
      const data = new TextEncoder().encode('Hello, JAMNP-S!')
      const wrongData = new TextEncoder().encode('Wrong data!')
      
      const [signatureError, signature] = signEd25519(data, keyPair.privateKey)
      if (signatureError) {
        throw signatureError
      }
      const isValid = verifyEd25519(wrongData, signature, keyPair.publicKey)
      
      expect(isValid).toBe(false)
    })
  })

  describe('Certificate Management', () => {
        it('should generate alternative names from Ed25519 public keys', () => {
      const keyPair = generateEd25519KeyPair()
      const [alternativeNameError, alternativeName] = generateAlternativeName(keyPair.publicKey, decodeFixedLength)
      if (alternativeNameError) {
        throw alternativeNameError
      }

      expect(alternativeName).toBeTypeOf('string')
      expect(alternativeName.startsWith('$e')).toBe(false) // Raw format doesn't have $e prefix
      expect(alternativeName.length).toBe(52) // 52 characters without $e prefix
    })

    it('should generate consistent alternative names for the same key', () => {
      const keyPair = generateEd25519KeyPair()
      const [name1Error, name1] = generateAlternativeName(keyPair.publicKey, decodeFixedLength)
      if (name1Error) {
        throw name1Error
      }
      const [name2Error, name2] = generateAlternativeName(keyPair.publicKey, decodeFixedLength)
      if (name2Error) {
        throw name2Error
      }
      
      expect(name1).toBe(name2)
    })

    it('should generate different alternative names for different keys', () => {
      const keyPair1 = generateEd25519KeyPair()
      const keyPair2 = generateEd25519KeyPair()

      const [name1Error, name1] = generateAlternativeName(keyPair1.publicKey, decodeFixedLength)
      if (name1Error) {
        throw name1Error
      }
      const [name2Error, name2] = generateAlternativeName(keyPair2.publicKey, decodeFixedLength)
      if (name2Error) {
        throw name2Error
      }
      
      expect(name1).not.toBe(name2)
    })

    it('should generate and validate certificates', () => {
      const keyPair = generateEd25519KeyPair()
        const [alternativeNameError, alternativeName] = generateAlternativeName(keyPair.publicKey, decodeFixedLength)
      if (alternativeNameError) {
        throw alternativeNameError
      }
      
      const [certificateError, certificate] = generateCertificate(
        keyPair.publicKey,
        keyPair.privateKey,
        alternativeName
      )
      if (certificateError) {
        throw certificateError
      }

      expect(certificate.certificate).toBeInstanceOf(Uint8Array)
      expect(certificate.publicKey).toEqual(keyPair.publicKey)
      expect(certificate.alternativeName).toBe(alternativeName)
      expect(certificate.signature).toBeInstanceOf(Uint8Array)
      expect(certificate.signature.length).toBe(64)
      
      const [isValidError, isValid] = validateCertificate(certificate)
      if (isValidError) {
        throw isValidError
      }

      expect(isValid).toBe(true)
    })
  })

  describe('TLS Integration', () => {
    it('should generate ALPN protocol identifiers', () => {
      const chainHash = '12345678'
      const protocol = generateALPNProtocol(chainHash)
      const builderProtocol = generateALPNProtocol(chainHash, true)
      
      expect(protocol).toBe('jamnp-s/0/12345678')
      expect(builderProtocol).toBe('jamnp-s/0/12345678/builder')
    })

    it('should parse ALPN protocol identifiers', () => {
      const validProtocol = 'jamnp-s/0/12345678'
      const validBuilderProtocol = 'jamnp-s/0/12345678/builder'
      const invalidProtocol = 'invalid/protocol'
      
      const parsed1 = parseALPNProtocol(validProtocol)
      const parsed2 = parseALPNProtocol(validBuilderProtocol)
      const parsed3 = parseALPNProtocol(invalidProtocol)
      
      expect(parsed1).toEqual({
        name: 'jamnp-s',
        version: '0',
        chainHash: '12345678',
        isBuilder: false,
      })
      
      expect(parsed2).toEqual({
        name: 'jamnp-s',
        version: '0',
        chainHash: '12345678',
        isBuilder: true,
      })
      
      expect(parsed3).toBeNull()
    })
  })

}) 