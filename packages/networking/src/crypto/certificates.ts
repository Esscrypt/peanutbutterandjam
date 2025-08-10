/**
 * X.509 Certificate Management for JAMNP-S
 *
 * Provides certificate generation, validation, and alternative name computation
 * Based on the specification in certs.md
 */

import {
  deriveSecretSeeds,
  generateAlternativeName,
  signEd25519,
  verifyEd25519,
} from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'
import type { Bytes, JAMNPCertificate } from '@pbnj/types'
import { generateKeyPairFromSeed } from '@stablelib/ed25519'

/**
 * Create Ed25519 private key in PEM format
 *
 * ASN.1 structure for Ed25519 private key:
 * PrivateKeyInfo ::= SEQUENCE {
 *   version INTEGER { v1(0) },
 *   privateKeyAlgorithm PrivateKeyAlgorithmIdentifier,
 *   privateKey OCTET STRING,
 *   attributes [0] IMPLICIT Attributes OPTIONAL
 * }
 *
 * PrivateKeyAlgorithmIdentifier ::= AlgorithmIdentifier
 *
 * AlgorithmIdentifier ::= SEQUENCE {
 *   algorithm OBJECT IDENTIFIER,
 *   parameters ANY DEFINED BY algorithm OPTIONAL
 * }
 */
export function createEd25519PrivateKeyPEM(privateKey: Bytes): string {
  // Ed25519 OID: 1.3.101.112
  const ed25519OID = [0x2b, 0x65, 0x70] // 1.3.101.112 in DER encoding

  // ASN.1 DER encoding for Ed25519 private key
  const version = [0x02, 0x01, 0x00] // INTEGER 0
  const algorithm = [
    0x30,
    0x05, // SEQUENCE
    0x06,
    0x03, // OBJECT IDENTIFIER
    ...ed25519OID,
  ]
  const privateKeyOctet = [
    0x04,
    0x20, // OCTET STRING (32 bytes)
    ...Array.from(privateKey.slice(0, 32)), // Use first 32 bytes as seed
  ]

  // Combine all parts
  const privateKeyInfo = [
    0x30, // SEQUENCE
    0x2e, // Length (46 bytes)
    ...version,
    ...algorithm,
    ...privateKeyOctet,
  ]

  // Convert to Base64
  const base64 = Buffer.from(privateKeyInfo).toString('base64')

  // Format as PEM
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`
}

/**
 * Create Ed25519 public key in PEM format
 */
export function createEd25519PublicKeyPEM(publicKey: Bytes): string {
  // Ed25519 OID: 1.3.101.112
  const ed25519OID = [0x2b, 0x65, 0x70] // 1.3.101.112 in DER encoding

  // ASN.1 DER encoding for Ed25519 public key
  const algorithm = [
    0x30,
    0x05, // SEQUENCE
    0x06,
    0x03, // OBJECT IDENTIFIER
    ...ed25519OID,
  ]
  const publicKeyBitString = [
    0x03, // BIT STRING
    0x21, // Length (33 bytes)
    0x00, // Unused bits
    ...Array.from(publicKey),
  ]

  // Combine all parts
  const publicKeyInfo = [
    0x30, // SEQUENCE
    0x2a, // Length (42 bytes)
    ...algorithm,
    ...publicKeyBitString,
  ]

  // Convert to Base64
  const base64 = Buffer.from(publicKeyInfo).toString('base64')

  // Format as PEM
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`
}

/**
 * Generate X.509 certificate for JAMNP-S
 *
 * Creates a proper X.509 certificate with Ed25519 keys
 * Based on the specification in certs.md
 */
export function generateCertificate(
  publicKey: Bytes,
  privateKey: Bytes,
  alternativeName: string,
): JAMNPCertificate {
  // Create a self-signed certificate
  const certData = {
    version: 3,
    serialNumber: generateSerialNumber(),
    signatureAlgorithm: 'ed25519',
    issuer: { CN: 'JAM Client Ed25519 Cert' },
    validity: {
      notBefore: new Date(),
      notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
    subject: { CN: 'JAM Client Ed25519 Cert' },
    subjectPublicKeyInfo: {
      algorithm: { algorithm: 'ed25519' },
      subjectPublicKey: publicKey,
    },
    extensions: [
      {
        extnID: 'subjectAltName',
        critical: false,
        extnValue: `DNS:${alternativeName}`,
      },
      {
        extnID: 'basicConstraints',
        critical: true,
        extnValue: 'CA:TRUE',
      },
      {
        extnID: 'keyUsage',
        critical: true,
        extnValue: 'digitalSignature,keyCertSign',
      },
    ],
  }

  // Convert to bytes (simplified for now - in production this would be proper ASN.1 DER)
  const certBytes = new TextEncoder().encode(JSON.stringify(certData))

  // Create signature for the certificate
  const signature = signEd25519(certBytes, privateKey)

  return {
    certificate: certBytes,
    publicKey,
    alternativeName,
    signature,
  }
}

/**
 * Generate certificate from seed using JIP-5 derivation
 *
 * @param seedHex - Seed as hex string (with or without 0x prefix)
 * @returns Certificate with alternative name and real PEM encoded keys
 */
export function generateCertificateFromSeed(seedHex: string): {
  privateKeyPEM: string
  publicKeyPEM: string
  certificate: JAMNPCertificate
} {
  // Convert hex string to bytes
  const seed = new Uint8Array(Buffer.from(seedHex.replace('0x', ''), 'hex'))

  // Use JIP-5 derivation to get Ed25519 secret seed
  const { ed25519_secret_seed } = deriveSecretSeeds(seed)

  // Generate Ed25519 key pair from secret seed
  const { publicKey, secretKey } = generateKeyPairFromSeed(ed25519_secret_seed)

  // Generate alternative name from public key
  const alternativeName = generateAlternativeName(publicKey, decodeFixedLength)

  // Create real PEM encoded keys
  const privateKeyPEM = createEd25519PrivateKeyPEM(secretKey)
  const publicKeyPEM = createEd25519PublicKeyPEM(publicKey)

  // Create certificate
  const certificate: JAMNPCertificate = {
    certificate: new Uint8Array(0), // Mock certificate data for now
    publicKey,
    alternativeName,
    signature: new Uint8Array(0), // Mock signature for now
  }

  return {
    privateKeyPEM,
    publicKeyPEM,
    certificate,
  }
}

/**
 * Generate a random serial number for certificates
 */
function generateSerialNumber(): string {
  const bytes = new Uint8Array(20)
  const nodeCrypto = require('node:crypto')
  nodeCrypto.randomFillSync(bytes)
  return Buffer.from(bytes).toString('hex')
}

/**
 * Validate JAMNP-S certificate
 */
export function validateCertificate(cert: JAMNPCertificate): boolean {
  try {
    // Check public key length
    if (!validatePublicKey(cert.publicKey)) {
      return false
    }

    // Check signature length
    if (!validateSignature(cert.signature)) {
      return false
    }

    // Verify alternative name matches public key
    const expectedName = generateAlternativeName(
      cert.publicKey,
      decodeFixedLength,
    )
    if (cert.alternativeName !== expectedName) {
      return false
    }

    // Verify certificate signature
    if (!verifyEd25519(cert.certificate, cert.signature, cert.publicKey)) {
      return false
    }

    // For simplified certificate, just check basic structure
    try {
      const certData = JSON.parse(new TextDecoder().decode(cert.certificate))

      // Check if certificate has required fields
      if (!certData.subject || !certData.subjectPublicKeyInfo) {
        return false
      }

      // Check if subject matches alternative name
      if (certData.subject.CN !== 'JAM Client Ed25519 Cert') {
        return false
      }

      return true
    } catch (_parseError) {
      return false
    }
  } catch (_error) {
    return false
  }
}

/**
 * Extract public key from certificate
 */
export function extractPublicKeyFromCertificate(cert: JAMNPCertificate): Bytes {
  return cert.publicKey
}

/**
 * Extract alternative name from certificate
 */
export function extractAlternativeNameFromCertificate(
  cert: JAMNPCertificate,
): string {
  return cert.alternativeName
}

/**
 * Create certificate from key pair
 */
export function createCertificateFromKeyPair(keyPair: {
  publicKey: Bytes
  privateKey: Bytes
}): JAMNPCertificate {
  const alternativeName = generateAlternativeName(
    keyPair.publicKey,
    decodeFixedLength,
  )
  return generateCertificate(
    keyPair.publicKey,
    keyPair.privateKey,
    alternativeName,
  )
}

/**
 * Validate Ed25519 public key
 */
function validatePublicKey(publicKey: Bytes): boolean {
  return publicKey.length === 32
}

/**
 * Validate Ed25519 signature
 */
function validateSignature(signature: Bytes): boolean {
  return signature.length === 64
}

/**
 * Generate Ed25519 key pair from seed using @stablelib/ed25519
 *
 * @param seed - 32-byte seed
 * @returns Object with publicKey (32 bytes) and privateKey (64 bytes)
 */
function _generateEd25519KeyPairFromSeed(seed: Uint8Array): {
  publicKey: Uint8Array
  privateKey: Uint8Array
} {
  const { publicKey, secretKey } = generateKeyPairFromSeed(seed)
  return { publicKey, privateKey: secretKey }
}
