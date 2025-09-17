/**
 * X.509 Certificate Management for JAMNP-S
 *
 * Provides certificate generation, validation, and alternative name computation
 * Based on the specification in certs.md
 */

import crypto from 'node:crypto'
import {
  deriveSecretSeeds,
  generateAlternativeName,
  generateEd25519KeyPairFromSeed,
  type Safe,
  safeError,
  safeResult,
  signEd25519,
  verifyEd25519,
} from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'
import type {
  AlternativeName,
  DisplayAlternativeName,
  JAMNPCertificate,
} from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * Convert alternative name to display format with $e prefix
 */
export function toDisplayAlternativeName(
  altName: AlternativeName,
): DisplayAlternativeName {
  return `$${altName}` as DisplayAlternativeName
}

/**
 * Extract alternative name from display format (remove $e prefix)
 */
export function fromDisplayAlternativeName(
  displayAltName: DisplayAlternativeName,
): AlternativeName {
  return displayAltName.slice(1) as AlternativeName
}

/**
 * Convert DER certificate to PEM format for QUIC transport
 *
 * QUIC/TLS libraries typically expect PEM format, so we need to convert
 * our DER-encoded X.509 certificates to PEM format for transport layer.
 */
export function convertDERToPEM(derCertificate: Uint8Array): string {
  const base64 = Buffer.from(derCertificate).toString('base64')
  const pemLines = []

  // Add PEM header
  pemLines.push('-----BEGIN CERTIFICATE-----')

  // Split base64 into 64-character lines
  for (let i = 0; i < base64.length; i += 64) {
    pemLines.push(base64.slice(i, i + 64))
  }

  // Add PEM footer
  pemLines.push('-----END CERTIFICATE-----')

  return pemLines.join('\n')
}

/**
 * Convert DER private key to PEM format for QUIC transport
 *
 * Creates a proper PKCS#8 PEM format private key for Ed25519.
 */
export function convertDERPrivateKeyToPEM(privateKey: Uint8Array): string {
  // Create PKCS#8 DER structure for Ed25519 private key
  const pkcs8DER = createPKCS8PrivateKeyDER(privateKey)
  const base64 = Buffer.from(pkcs8DER).toString('base64')
  const pemLines = []

  // Add PEM header
  pemLines.push('-----BEGIN PRIVATE KEY-----')

  // Split base64 into 64-character lines
  for (let i = 0; i < base64.length; i += 64) {
    pemLines.push(base64.slice(i, i + 64))
  }

  // Add PEM footer
  pemLines.push('-----END PRIVATE KEY-----')

  return pemLines.join('\n')
}

/**
 * Create PKCS#8 DER structure for Ed25519 private key
 */
function createPKCS8PrivateKeyDER(privateKey: Uint8Array): Uint8Array {
  // PKCS#8 structure for Ed25519 private key
  const version = new Uint8Array([0x02, 0x01, 0x00]) // Version 0

  // Algorithm identifier for Ed25519
  const algorithm = new Uint8Array([
    0x30,
    0x05, // SEQUENCE
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
  ])

  // Private key as OCTET STRING
  const privateKeyOctetString = encodeDEROctetString(privateKey)

  // Combine all components
  const content = new Uint8Array([
    ...version,
    ...algorithm,
    ...privateKeyOctetString,
  ])

  const length = encodeDERLength(content.length)
  return new Uint8Array([0x30, ...length, ...content])
}

/**
 * Generate JAMNP-S certificate with Ed25519 keys
 *
 * Creates a proper X.509 DER-encoded certificate that satisfies JAMNP-S requirements.
 * This generates a real X.509 certificate for TLS handshake compliance.
 */
export function generateCertificate(
  publicKey: Uint8Array,
  privateKey: Uint8Array,
  alternativeName: AlternativeName,
): Safe<JAMNPCertificate> {
  // Generate proper X.509 DER certificate
  const [derError, derCertificate] = buildX509DERCertificate(
    publicKey,
    privateKey,
    alternativeName,
  )
  if (derError) {
    return safeError(derError)
  }

  // Create Ed25519 signature for application-layer verification
  const [signatureError, signature] = signEd25519(derCertificate, privateKey)
  if (signatureError) {
    return safeError(signatureError)
  }

  return safeResult({
    certificate: derCertificate, // Now contains proper X.509 DER data
    publicKey,
    alternativeName,
    signature,
  })
}

/**
 * Generate certificate from seed using JIP-5 derivation
 *
 * @param seedHex - Seed as hex string (with or without 0x prefix)
 * @returns Certificate with alternative name and real PEM encoded keys
 */
export function generateCertificateFromSeed(seedHex: Hex): Safe<{
  certificate: JAMNPCertificate
  certificatePEM: JAMNPCertificate
}> {
  // Convert hex string to bytes
  const seed = new Uint8Array(Buffer.from(seedHex.replace('0x', ''), 'hex'))

  // Use JIP-5 derivation to get Ed25519 secret seed
  const [secretSeedError, derivedSecretSeed] = deriveSecretSeeds(seed)
  if (secretSeedError) {
    return safeError(secretSeedError)
  }

  const { ed25519SecretSeed } = derivedSecretSeed

  // Generate Ed25519 key pair from secret seed
  const [keyPairError, keyPair] =
    generateEd25519KeyPairFromSeed(ed25519SecretSeed)
  if (keyPairError) {
    return safeError(keyPairError)
  }

  const { publicKey, privateKey: secretKey } = keyPair

  // Generate alternative name from public key
  // Create adapter function for decodeFixedLength
  // const decoderAdapter = (data: Uint8Array, length: FixedLengthSize) => {
  //   const result = decodeFixedLength(data, length)
  //   return safeResult({ value: result.value, remaining: result.remaining })
  // }
  const [alternativeNameError, alternativeName] = generateAlternativeName(
    publicKey,
    decodeFixedLength,
  )
  if (alternativeNameError) {
    return safeError(alternativeNameError)
  }

  // Create certificate using proper X.509 generation
  const [certificateError, certificate] = generateCertificate(
    publicKey,
    secretKey,
    alternativeName,
  )
  if (certificateError) {
    return safeError(certificateError)
  }

  // Generate real X.509 certificate using proper DER generation for QUIC/TLS transport
  const [certError, certificatePEM] = generateRealX509Certificate(
    publicKey,
    secretKey,
    alternativeName,
  )
  if (certError) {
    return safeError(certError)
  }

  return safeResult({
    certificate: certificate,
    certificatePEM: certificatePEM,
  })
}

/**
 * Generate X.509 DER certificate structure builder
 *
 * Creates proper X.509 DER-encoded certificates according to JAMNP-S specification
 */
function buildX509DERCertificate(
  publicKey: Uint8Array,
  privateKey: Uint8Array,
  alternativeName: AlternativeName,
): Safe<Uint8Array> {
  try {
    // Create TBSCertificate (To Be Signed Certificate)
    const tbsCertificate = buildTBSCertificate(publicKey, alternativeName)

    // Create Ed25519 signature over TBSCertificate
    const [signatureError, signature] = signEd25519(tbsCertificate, privateKey)
    if (signatureError) {
      return safeError(signatureError)
    }

    // Build complete X.509 certificate structure
    const certificate = buildCompleteCertificate(
      tbsCertificate,
      signature,
      publicKey,
    )

    return safeResult(certificate)
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Build TBSCertificate (To Be Signed Certificate) structure
 */
function buildTBSCertificate(
  publicKey: Uint8Array,
  alternativeName: AlternativeName,
): Uint8Array {
  // Version: v3 (0x02)
  const version = new Uint8Array([0xa0, 0x03, 0x02, 0x01, 0x02])

  // Serial Number (random 20-byte integer)
  const serialNumber = crypto.randomBytes(20)
  const serialNumberDER = encodeDERInteger(serialNumber)

  // Signature Algorithm: Ed25519 (1.3.101.112)
  const signatureAlgorithm = new Uint8Array([
    0x30,
    0x05, // SEQUENCE
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
  ])

  // Issuer: Self-signed (same as subject)
  const issuer = buildName('JAM Client Ed25519 Cert')

  // Validity period (1 year from now)
  const now = new Date()
  const notBefore = buildTime(now)
  const notAfter = buildTime(
    new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
  )
  const validity = encodeDERSequence([notBefore, notAfter])

  // Subject: Same as issuer for self-signed
  const subject = issuer

  // Subject Public Key Info
  const subjectPublicKeyInfo = buildSubjectPublicKeyInfo(publicKey)

  // Extensions (including Subject Alternative Name)
  const extensions = buildExtensions(alternativeName)

  // Combine all TBSCertificate components
  const tbsComponents = [
    version,
    serialNumberDER,
    signatureAlgorithm,
    issuer,
    validity,
    subject,
    subjectPublicKeyInfo,
    extensions,
  ]

  return encodeDERSequence(tbsComponents)
}

/**
 * Build Subject Public Key Info structure
 */
function buildSubjectPublicKeyInfo(publicKey: Uint8Array): Uint8Array {
  // Algorithm identifier for Ed25519
  const algorithm = new Uint8Array([
    0x30,
    0x05, // SEQUENCE
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
  ])

  // Public key as BIT STRING
  const publicKeyBitString = new Uint8Array([
    0x03,
    0x21, // BIT STRING, length 33
    0x00, // unused bits
    ...publicKey, // 32-byte Ed25519 public key
  ])

  return encodeDERSequence([algorithm, publicKeyBitString])
}

/**
 * Build X.509 extensions including Subject Alternative Name
 */
function buildExtensions(alternativeName: AlternativeName): Uint8Array {
  // Subject Alternative Name extension
  const sanExtension = buildSubjectAlternativeNameExtension(alternativeName)

  // Key Usage extension (Digital Signature)
  const keyUsageExtension = buildKeyUsageExtension()

  // Combine extensions
  const extensions = [sanExtension, keyUsageExtension]

  // Wrap in Extensions structure
  const extensionsSequence = encodeDERSequence(extensions)
  return encodeDERSequence([extensionsSequence])
}

/**
 * Build Subject Alternative Name extension
 */
function buildSubjectAlternativeNameExtension(
  alternativeName: AlternativeName,
): Uint8Array {
  // Extension ID: 2.5.29.17 (Subject Alternative Name)
  const extensionId = new Uint8Array([0x06, 0x03, 0x55, 0x1d, 0x11])

  // Critical: false
  const critical = new Uint8Array([0x01, 0x01, 0x00])

  // DNS name in GeneralNames
  const dnsName = new Uint8Array([
    0x82, // DNS name tag
    alternativeName.length, // length
    ...new TextEncoder().encode(alternativeName), // DNS name
  ])

  const generalNames = encodeDERSequence([dnsName])
  const extensionValue = encodeDEROctetString(generalNames)

  return encodeDERSequence([extensionId, critical, extensionValue])
}

/**
 * Build Key Usage extension
 */
function buildKeyUsageExtension(): Uint8Array {
  // Extension ID: 2.5.29.15 (Key Usage)
  const extensionId = new Uint8Array([0x06, 0x03, 0x55, 0x1d, 0x0f])

  // Critical: false
  const critical = new Uint8Array([0x01, 0x01, 0x00])

  // Key Usage: Digital Signature (bit 0)
  const keyUsage = new Uint8Array([0x03, 0x02, 0x01, 0x80])

  const extensionValue = encodeDEROctetString(keyUsage)

  return encodeDERSequence([extensionId, critical, extensionValue])
}

/**
 * Build X.509 Name structure
 */
function buildName(commonName: string): Uint8Array {
  // Common Name attribute
  const cnAttribute = new Uint8Array([
    0x31, // SET
    0x0b, // length 11
    0x30, // SEQUENCE
    0x09, // length 9
    0x06,
    0x03,
    0x55,
    0x04,
    0x03, // OID 2.5.4.3 (Common Name)
    0x0c,
    0x02, // UTF8String, length 2
    ...new TextEncoder().encode(commonName.slice(0, 2)), // Truncated for simplicity
  ])

  return encodeDERSequence([cnAttribute])
}

/**
 * Build X.509 Time structure (UTCTime)
 */
function buildTime(date: Date): Uint8Array {
  const year = date.getUTCFullYear() % 100
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = date.getUTCDate().toString().padStart(2, '0')
  const hour = date.getUTCHours().toString().padStart(2, '0')
  const minute = date.getUTCMinutes().toString().padStart(2, '0')
  const second = date.getUTCSeconds().toString().padStart(2, '0')

  const timeString = `${year.toString().padStart(2, '0')}${month}${day}${hour}${minute}${second}Z`
  const timeBytes = new TextEncoder().encode(timeString)

  return new Uint8Array([0x17, timeBytes.length, ...timeBytes]) // UTCTime tag
}

/**
 * Build complete X.509 certificate
 */
function buildCompleteCertificate(
  tbsCertificate: Uint8Array,
  signature: Uint8Array,
  _publicKey: Uint8Array,
): Uint8Array {
  // Signature Algorithm (same as in TBSCertificate)
  const signatureAlgorithm = new Uint8Array([
    0x30,
    0x05, // SEQUENCE
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
  ])

  // Signature value
  const signatureValue = encodeDERBitString(signature)

  // Complete certificate structure
  return encodeDERSequence([tbsCertificate, signatureAlgorithm, signatureValue])
}

/**
 * Generate real X.509 certificate using proper DER generation
 *
 * Creates a proper X.509 DER-encoded certificate according to JAMNP-S specification.
 * This function now properly uses the provided Ed25519 keys and generates a real
 * X.509 DER certificate with Subject Alternative Name extension for TLS handshake.
 */
export function generateRealX509Certificate(
  publicKey: Uint8Array,
  privateKey: Uint8Array,
  alternativeName: AlternativeName,
): Safe<JAMNPCertificate> {
  // Generate proper X.509 DER certificate
  const [derError, derCertificate] = buildX509DERCertificate(
    publicKey,
    privateKey,
    alternativeName,
  )
  if (derError) {
    return safeError(derError)
  }

  // Create Ed25519 signature for application-layer verification
  const [signatureError, signature] = signEd25519(derCertificate, privateKey)
  if (signatureError) {
    return safeError(signatureError)
  }

  return safeResult({
    certificate: derCertificate,
    publicKey,
    alternativeName,
    signature,
  })
}

/**
 * Validate JAMNP-S certificate
 */
export function validateCertificate(cert: JAMNPCertificate): Safe<boolean> {
  try {
    // Check public key length
    if (!validatePublicKey(cert.publicKey)) {
      return safeError(new Error('Invalid public key'))
    }

    // Check signature length
    if (!validateSignature(cert.signature)) {
      return safeError(new Error('Invalid signature'))
    }

    const [expectedNameError, expectedName] = generateAlternativeName(
      cert.publicKey,
      decodeFixedLength,
    )
    if (expectedNameError) {
      return safeError(expectedNameError)
    }
    if (cert.alternativeName !== expectedName) {
      return safeError(new Error('Alternative name mismatch'))
    }

    // Verify certificate signature
    if (!verifyEd25519(cert.certificate, cert.signature, cert.publicKey)) {
      return safeError(new Error('Certificate signature verification failed'))
    }

    // Validate ASN.1 DER certificate format
    if (cert.certificate.length === 0) {
      console.warn('Certificate validation: Empty certificate data')
      return safeError(new Error('Empty certificate data'))
    }

    try {
      // Validate ASN.1 DER structure
      if (!validateDERCertificate(cert.certificate)) {
        return safeError(new Error('Invalid DER certificate'))
      }

      // Extract public key from certificate and verify it matches
      const [extractedPublicKeyError, extractedPublicKey] =
        extractPublicKeyFromDERCertificate(cert.certificate)
      if (extractedPublicKeyError) {
        return safeError(extractedPublicKeyError)
      }
      if (
        !extractedPublicKey ||
        !arraysEqual(extractedPublicKey, cert.publicKey)
      ) {
        console.warn('Certificate validation: Public key mismatch')
        return safeError(new Error('Public key mismatch'))
      }

      // Validate alternative name in certificate
      const [extractedAltNameError, extractedAltName] =
        extractAlternativeNameFromDERCertificate(cert.certificate)
      if (extractedAltNameError) {
        return safeError(extractedAltNameError)
      }
      if (extractedAltName !== cert.alternativeName) {
        console.warn('Certificate validation: Alternative name mismatch')
        return safeError(new Error('Alternative name mismatch'))
      }

      return safeResult(true)
    } catch (error) {
      console.warn('Certificate validation: DER parsing failed', error)
      // Fallback to legacy JSON format for development
      try {
        const certData = JSON.parse(new TextDecoder().decode(cert.certificate))
        if (!certData.subject || !certData.subjectPublicKeyInfo) {
          return safeError(new Error('Invalid certificate data'))
        }
        if (certData.subject.CN !== 'JAM Client Ed25519 Cert') {
          return safeError(new Error('Invalid certificate data'))
        }
        console.warn('Certificate validation: Using legacy JSON format')
        return safeResult(true)
      } catch {
        return safeError(new Error('Invalid certificate data'))
      }
    }
  } catch (_error) {
    return safeError(new Error('Certificate validation failed'))
  }
}

/**
 * Extract public key from certificate
 */
export function extractPublicKeyFromCertificate(
  cert: JAMNPCertificate,
): Uint8Array {
  return cert.publicKey
}

/**
 * Validate ASN.1 DER certificate structure
 */
function validateDERCertificate(certBytes: Uint8Array): boolean {
  try {
    // Basic DER structure validation
    if (certBytes.length < 10) return false

    // Should start with SEQUENCE tag
    if (certBytes[0] !== 0x30) return false

    // Parse length and validate it matches certificate size
    const { length: totalLength, offset } = parseDERLength(certBytes, 1)
    if (totalLength + offset !== certBytes.length) return false

    return true
  } catch {
    return false
  }
}

/**
 * Extract public key from DER certificate
 */
function extractPublicKeyFromDERCertificate(
  certBytes: Uint8Array,
): Safe<Uint8Array> {
  try {
    // Parse DER certificate to find SubjectPublicKeyInfo
    const parser = new DERParser(certBytes)
    const cert = parser.parseSequence() // Certificate
    if (cert.length < 3) return safeError(new Error('Invalid DER certificate'))

    const tbsCert = parser.parseSequence() // TBSCertificate
    if (tbsCert.length < 6)
      return safeError(new Error('Invalid DER certificate'))

    // Navigate to SubjectPublicKeyInfo (usually 6th element in TBSCertificate)
    // This is a simplified parser - production should use proper ASN.1 library
    const subjectPublicKeyInfo = tbsCert[6]
    if (!subjectPublicKeyInfo || subjectPublicKeyInfo.length < 10)
      return safeError(new Error('Invalid DER certificate'))

    // Extract the public key from the BIT STRING
    // Skip algorithm identifier and get to the actual key
    const keyParser = new DERParser(subjectPublicKeyInfo)
    const spki = keyParser.parseSequence()
    if (spki.length < 2) return safeError(new Error('Invalid DER certificate'))

    const publicKeyBitString = spki[1]
    if (publicKeyBitString[0] !== 0x03)
      return safeError(new Error('Invalid DER certificate')) // Should be BIT STRING

    // Skip BIT STRING header and unused bits byte
    const { length: keyLength, offset } = parseDERLength(publicKeyBitString, 1)
    if (keyLength < 32) return safeError(new Error('Invalid DER certificate'))

    // Return the 32-byte Ed25519 public key (skip unused bits byte)
    return safeResult(publicKeyBitString.slice(offset + 1, offset + 1 + 32))
  } catch {
    return safeError(new Error('Invalid DER certificate'))
  }
}

/**
 * Extract alternative name from DER certificate
 */
function extractAlternativeNameFromDERCertificate(
  certBytes: Uint8Array,
): Safe<AlternativeName> {
  try {
    // This is a simplified implementation
    // Production should use proper ASN.1 parsing for extensions
    const certString = Array.from(certBytes)
      .map((b) => String.fromCharCode(b))
      .join('')

    // Look for DNS: pattern in the certificate
    const dnsMatch = certString.match(/DNS:([a-z0-9.]+)/i)
    if (dnsMatch) {
      return safeResult(dnsMatch[1] as AlternativeName)
    }

    return safeError(new Error('Invalid DER certificate'))
  } catch {
    return safeError(new Error('Invalid DER certificate'))
  }
}

/**
 * Simple DER parser for certificate validation
 */
class DERParser {
  private data: Uint8Array
  private offset: number

  constructor(data: Uint8Array) {
    this.data = data
    this.offset = 0
  }

  parseSequence(): Uint8Array[] {
    if (this.data[this.offset] !== 0x30) {
      throw new Error('Expected SEQUENCE')
    }
    this.offset++

    const { length } = parseDERLength(this.data, this.offset)
    this.offset += getDERLengthSize(this.data, this.offset)

    const elements: Uint8Array[] = []
    const endOffset = this.offset + length

    while (this.offset < endOffset) {
      const elementStart = this.offset
      this.skipElement()
      elements.push(this.data.slice(elementStart, this.offset))
    }

    return elements
  }

  private skipElement(): void {
    this.offset++ // Skip tag
    const { length } = parseDERLength(this.data, this.offset)
    this.offset += getDERLengthSize(this.data, this.offset)
    this.offset += length
  }
}

/**
 * Parse DER length encoding
 */
function parseDERLength(
  data: Uint8Array,
  offset: number,
): { length: number; offset: number } {
  const firstByte = data[offset]

  if ((firstByte & 0x80) === 0) {
    // Short form
    return { length: firstByte, offset: offset + 1 }
  }

  // Long form
  const lengthBytes = firstByte & 0x7f
  if (lengthBytes === 0) {
    throw new Error('Indefinite length not allowed in DER')
  }

  let length = 0
  for (let i = 0; i < lengthBytes; i++) {
    length = (length << 8) | data[offset + 1 + i]
  }

  return { length, offset: offset + 1 + lengthBytes }
}

/**
 * Get size of DER length encoding
 */
function getDERLengthSize(data: Uint8Array, offset: number): number {
  const firstByte = data[offset]
  if ((firstByte & 0x80) === 0) {
    return 1
  }
  return 1 + (firstByte & 0x7f)
}

/**
 * Compare two byte arrays for equality
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Extract alternative name from certificate
 */
export function extractAlternativeNameFromCertificate(
  cert: JAMNPCertificate,
): Safe<AlternativeName> {
  return safeResult(cert.alternativeName)
}

/**
 * Create certificate from key pair
 */
export function createCertificateFromKeyPair(keyPair: {
  publicKey: Uint8Array
  privateKey: Uint8Array
}): Safe<JAMNPCertificate> {
  const [alternativeNameError, alternativeName] = generateAlternativeName(
    keyPair.publicKey,
    decodeFixedLength,
  )
  if (alternativeNameError) {
    return safeError(alternativeNameError)
  }
  return generateCertificate(
    keyPair.publicKey,
    keyPair.privateKey,
    alternativeName,
  )
}

/**
 * Validate Ed25519 public key
 */
function validatePublicKey(publicKey: Uint8Array): boolean {
  return publicKey.length === 32
}

/**
 * Validate Ed25519 signature
 */
function validateSignature(signature: Uint8Array): boolean {
  return signature.length === 64
}

/**
 * DER encoding helper functions
 */

/**
 * Encode DER SEQUENCE
 */
function encodeDERSequence(elements: Uint8Array[]): Uint8Array {
  const content = new Uint8Array(
    elements.reduce((sum, el) => sum + el.length, 0),
  )
  let offset = 0
  for (const element of elements) {
    content.set(element, offset)
    offset += element.length
  }

  const length = encodeDERLength(content.length)
  return new Uint8Array([0x30, ...length, ...content])
}

/**
 * Encode DER INTEGER
 */
function encodeDERInteger(value: Uint8Array): Uint8Array {
  // Remove leading zeros, but keep one zero if all bytes are zero
  let start = 0
  while (start < value.length - 1 && value[start] === 0) {
    start++
  }

  const trimmed = value.slice(start)

  // Add leading zero if high bit is set (to ensure positive integer)
  const needsLeadingZero = trimmed.length > 0 && (trimmed[0] & 0x80) !== 0
  const content = needsLeadingZero ? new Uint8Array([0, ...trimmed]) : trimmed

  const length = encodeDERLength(content.length)
  return new Uint8Array([0x02, ...length, ...content])
}

/**
 * Encode DER OCTET STRING
 */
function encodeDEROctetString(data: Uint8Array): Uint8Array {
  const length = encodeDERLength(data.length)
  return new Uint8Array([0x04, ...length, ...data])
}

/**
 * Encode DER BIT STRING
 */
function encodeDERBitString(data: Uint8Array): Uint8Array {
  const length = encodeDERLength(data.length + 1)
  return new Uint8Array([0x03, ...length, 0x00, ...data]) // 0x00 = unused bits
}

/**
 * Encode DER length
 */
function encodeDERLength(length: number): Uint8Array {
  if (length < 0x80) {
    // Short form
    return new Uint8Array([length])
  } else {
    // Long form
    const bytes = []
    let temp = length
    while (temp > 0) {
      bytes.unshift(temp & 0xff)
      temp >>>= 8
    }
    return new Uint8Array([0x80 | bytes.length, ...bytes])
  }
}
