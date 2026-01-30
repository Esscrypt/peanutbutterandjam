/**
 * Basic tests for JAMNP-S networking implementation
 */

import { describe, it, expect } from 'vitest'
import { generateEd25519KeyPairStable as generateEd25519KeyPair, signEd25519, verifyEd25519 } from '@pbnjam/core'
import { generateAlternativeName } from '@pbnjam/core'
import { generateALPNProtocol, parseALPNProtocol } from '../src/crypto/tls'
import { decodeFixedLength } from '@pbnjam/codec'

describe('JAMNP-S Networking Implementation', () => {
  describe('Key Management', () => {
    it('should generate Ed25519 key pairs', () => {
      const keyPair = generateEd25519KeyPair()
      
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.publicKey.length).toBe(32)
      expect(keyPair.privateKey.length).toBe(32) // Ed25519 private key is 32-byte seed (@noble/ed25519)
    })

    it('should sign and verify data with Ed25519', () => {
      const keyPair = generateEd25519KeyPair()
      const data = new TextEncoder().encode('Hello, JAMNP-S!')
      
      const [signatureError, signature] = signEd25519(data, keyPair.privateKey)
      if (signatureError) {
        throw signatureError
      }
      const [verifyError, isValid] = verifyEd25519(data, signature, keyPair.publicKey)
      if (verifyError) {
        throw verifyError
      }
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
      const [verifyError, isValid] = verifyEd25519(wrongData, signature, keyPair.publicKey)
      if (verifyError) {
        throw verifyError
      }
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
      expect(alternativeName.startsWith('e')).toBe(true) // dev-accounts format: "e" + 52-char base32
      expect(alternativeName.length).toBe(53) // "e" prefix + 52 characters
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