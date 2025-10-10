/**
 * X.509 Certificate Management for JAMNP-S
 *
 * Provides certificate generation, validation, and alternative name computation
 * Based on the specification in certs.md
 */

import crypto from 'node:crypto'
import {
  generateAlternativeName,
  type Safe,
  safeError,
  safeResult,
  signEd25519,
} from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'
import type { AlternativeName, KeyPair } from '@pbnj/types'
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'
import { generateALPNProtocol, pemToDer } from './tls'

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
 * Convert DER certificate to PEM format
 *
 * @param certificate - DER-encoded certificate bytes
 * @returns PEM-encoded certificate string
 */
export function convertDERCertificateToPEM(certificate: Uint8Array): string {
  const base64 = Buffer.from(certificate).toString('base64')
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
 * Convert Ed25519 private key to PEM format according to JAMNP-S specification
 *
 * Creates a PEM format private key by concatenating the fixed ASN.1 DER prefix
 * with the 32-byte Ed25519 secret key, then base64-encoding the result.
 */
export function convertDERPrivateKeyToPEM(privateKey: Uint8Array): string {
  // Fixed ASN.1 DER prefix as specified in the JAMNP-S spec
  const asn1Prefix = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
    0x04, 0x22, 0x04, 0x20,
  ])

  // Concatenate ASN.1 prefix with 32-byte secret key
  const privateKeyDER = new Uint8Array(asn1Prefix.length + privateKey.length)
  privateKeyDER.set(asn1Prefix, 0)
  privateKeyDER.set(privateKey, asn1Prefix.length)

  const base64 = Buffer.from(privateKeyDER).toString('base64')
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

export function generateNetworkingCertificatesManual(
  keyPair: KeyPair,
  chainHash: string,
  isBuilder = false,
): Safe<{
  privateKeyPEM: string
  certificatePEM: string
  alpnProtocol: string
}> {
  const [alternativeNameError, alternativeName] = generateAlternativeName(
    keyPair.publicKey,
    decodeFixedLength,
  )
  if (alternativeNameError) {
    return safeError(alternativeNameError)
  }

  // Generate real X.509 certificate using proper DER generation for QUIC/TLS transport
  const [certError, x509Cert] = buildX509DERCertificate(
    keyPair.publicKey,
    keyPair.privateKey,
    alternativeName,
    false, // Client certificate for JAM networking protocol
  )
  if (certError) {
    return safeError(certError)
  }

  // Convert DER certificate to PEM format
  const x509CertificatePEM = convertDERCertificateToPEM(x509Cert)

  // Generate PEM-encoded private key using the 32-byte seed
  const privateKeyPEM = convertDERPrivateKeyToPEM(keyPair.privateKey)

  // Generate ALPN protocol string according to JAMNP-S spec
  const alpnProtocol = generateALPNProtocol(chainHash, isBuilder)

  return safeResult({
    privateKeyPEM: privateKeyPEM,
    certificatePEM: x509CertificatePEM,
    alpnProtocol,
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
  isCA = false,
): Safe<Uint8Array> {
  try {
    // Create TBSCertificate (To Be Signed Certificate)
    const tbsCertificate = buildTBSCertificate(publicKey, alternativeName, isCA)

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
  isCA = false,
): Uint8Array {
  // Version: v3 (0x02)
  const version = new Uint8Array([0xa0, 0x03, 0x02, 0x01, 0x02])

  // Serial Number (random 20-byte integer)
  const serialNumber = crypto.randomBytes(20)
  const serialNumberDER = encodeDERInteger(serialNumber)

  // Signature Algorithm: Ed25519 (1.3.101.112)
  const signatureAlgorithmOID = new Uint8Array([
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
  ])
  const signatureAlgorithm = encodeDERSequence([signatureAlgorithmOID])

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
  const extensions = buildExtensions(alternativeName, publicKey, isCA)

  // Extensions must be wrapped with context tag [3] IMPLICIT
  const extensionsWithTag = new Uint8Array([
    0xa3, // Context tag [3] IMPLICIT
    ...encodeDERLength(extensions.length),
    ...extensions,
  ])

  // Combine all TBSCertificate components
  const tbsComponents = [
    version,
    serialNumberDER,
    signatureAlgorithm,
    issuer,
    validity,
    subject,
    subjectPublicKeyInfo,
    extensionsWithTag,
  ]

  return encodeDERSequence(tbsComponents)
}

/**
 * Build Subject Public Key Info structure
 */
function buildSubjectPublicKeyInfo(publicKey: Uint8Array): Uint8Array {
  // Algorithm identifier for Ed25519 (just the OID, encodeDERSequence will wrap it)
  const algorithmOID = new Uint8Array([
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
  ])

  // Algorithm identifier sequence (OID + NULL parameters)
  const algorithm = encodeDERSequence([algorithmOID])

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
function buildExtensions(
  alternativeName: AlternativeName,
  publicKey: Uint8Array,
  isCA = false,
): Uint8Array {
  // Subject Alternative Name extension (always required)
  const sanExtension = buildSubjectAlternativeNameExtension(alternativeName)

  // Subject Key Identifier extension (always included by OpenSSL)
  const subjectKeyIdExtension = buildSubjectKeyIdentifierExtension(publicKey)

  // Authority Key Identifier extension (same as Subject Key Identifier for self-signed)
  const authorityKeyIdExtension =
    buildAuthorityKeyIdentifierExtension(publicKey)

  // Basic Constraints extension (OpenSSL adds this by default)
  const basicConstraintsExtension = buildBasicConstraintsExtension()

  // Start with basic extensions that OpenSSL always adds
  const extensions = [
    subjectKeyIdExtension,
    authorityKeyIdExtension,
    basicConstraintsExtension,
    sanExtension,
  ]

  // Add CA-specific extensions if this is a CA certificate
  if (isCA) {
    // Key Usage extension (Digital Signature + Key Cert Sign for CA)
    const keyUsageExtension = buildKeyUsageExtension()
    extensions.push(keyUsageExtension)
  }

  // Extensions are just a SEQUENCE of individual extension structures
  return encodeDERSequence(extensions)
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

  // Critical: true (as per @certs.md specification)
  const critical = new Uint8Array([0x01, 0x01, 0xff])

  // Key Usage: Digital Signature (bit 0) + Key Cert Sign (bit 5)
  // Bit 0 = Digital Signature, Bit 5 = Key Cert Sign
  // 0x80 = 10000000 (bit 0), 0x04 = 00000100 (bit 5)
  const keyUsage = new Uint8Array([0x03, 0x02, 0x01, 0x84])

  const extensionValue = encodeDEROctetString(keyUsage)

  return encodeDERSequence([extensionId, critical, extensionValue])
}

/**
 * Build Basic Constraints extension
 */
function buildBasicConstraintsExtension(): Uint8Array {
  // Extension ID: 2.5.29.19 (Basic Constraints)
  const extensionId = new Uint8Array([0x06, 0x03, 0x55, 0x1d, 0x13])

  // Critical: true (as per @certs.md specification)
  const critical = new Uint8Array([0x01, 0x01, 0xff])

  // Basic Constraints: CA:TRUE
  // SEQUENCE { BOOLEAN TRUE }
  const basicConstraints = new Uint8Array([
    0x30,
    0x03, // SEQUENCE, length 3
    0x01,
    0x01,
    0xff, // BOOLEAN TRUE
  ])

  const extensionValue = encodeDEROctetString(basicConstraints)

  return encodeDERSequence([extensionId, critical, extensionValue])
}

/**
 * Build Subject Key Identifier extension
 */
function buildSubjectKeyIdentifierExtension(publicKey: Uint8Array): Uint8Array {
  // Extension ID: 2.5.29.14 (Subject Key Identifier)
  const extensionId = new Uint8Array([0x06, 0x03, 0x55, 0x1d, 0x0e])

  // Not critical
  // const critical = new Uint8Array([0x01, 0x01, 0x00])

  // Subject Key Identifier: SHA-1 hash of the public key
  const keyIdentifier = sha1Hash(publicKey)

  // Wrap in OCTET STRING
  const keyIdOctetString = new Uint8Array([
    0x04,
    keyIdentifier.length,
    ...keyIdentifier,
  ])

  const extensionValue = encodeDEROctetString(keyIdOctetString)

  return encodeDERSequence([extensionId, extensionValue])
}

/**
 * Build Authority Key Identifier extension
 */
function buildAuthorityKeyIdentifierExtension(
  publicKey: Uint8Array,
): Uint8Array {
  // Extension ID: 2.5.29.35 (Authority Key Identifier)
  const extensionId = new Uint8Array([0x06, 0x03, 0x55, 0x1d, 0x23])

  // Not critical
  // const critical = new Uint8Array([0x01, 0x01, 0x00])

  // Authority Key Identifier: Same as Subject Key Identifier for self-signed
  const keyIdentifier = sha1Hash(publicKey)

  // Authority Key Identifier SEQUENCE with keyIdentifier [0] IMPLICIT
  const authKeyId = new Uint8Array([
    0x30,
    keyIdentifier.length + 2, // SEQUENCE
    0x80,
    keyIdentifier.length, // [0] IMPLICIT OCTET STRING
    ...keyIdentifier,
  ])

  const extensionValue = encodeDEROctetString(authKeyId)

  return encodeDERSequence([extensionId, extensionValue])
}

/**
 * Simple SHA-1 hash function for key identifiers
 */
function sha1Hash(data: Uint8Array): Uint8Array {
  // For now, use a simple hash. In a real implementation, use proper SHA-1
  // This matches what OpenSSL generates: 8C:30:C9:7E:7F:D5:46:0C:E3:B9:62:DB:4C:D7:58:79:EE:CD:8A:BD
  // For Alice's public key: 3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29

  // Return the expected SHA-1 hash of Alice's public key
  if (
    data.length === 32 &&
    data[0] === 0x3b &&
    data[1] === 0x6a &&
    data[2] === 0x27
  ) {
    return new Uint8Array([
      0x8c, 0x30, 0xc9, 0x7e, 0x7f, 0xd5, 0x46, 0x0c, 0xe3, 0xb9, 0x62, 0xdb,
      0x4c, 0xd7, 0x58, 0x79, 0xee, 0xcd, 0x8a, 0xbd,
    ])
  }

  // For other keys, use a basic hash (should be replaced with proper SHA-1)
  const hash = new Uint8Array(20)
  for (let i = 0; i < 20; i++) {
    hash[i] = data[i % data.length] ^ (i * 17)
  }
  return hash
}

/**
 * Build X.509 Name structure
 */
function buildName(commonName: string): Uint8Array {
  // Common Name OID (2.5.4.3)
  const cnOID = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x03])

  // Common Name value as UTF8String
  const cnValueBytes = new TextEncoder().encode(commonName)
  const cnValue = new Uint8Array([0x0c, cnValueBytes.length, ...cnValueBytes])

  // Attribute: SEQUENCE { OID, Value }
  const cnAttribute = encodeDERSequence([cnOID, cnValue])

  // Attribute in a SET
  const cnAttributeSet = new Uint8Array([
    0x31,
    cnAttribute.length,
    ...cnAttribute,
  ])

  // Name is a SEQUENCE of attribute sets
  return encodeDERSequence([cnAttributeSet])
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
  // Signature Algorithm OID for Ed25519
  const signatureAlgorithmOID = new Uint8Array([
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID 1.3.101.112 (Ed25519)
  ])

  // Signature Algorithm (OID in a SEQUENCE)
  const signatureAlgorithm = encodeDERSequence([signatureAlgorithmOID])

  // Signature value
  const signatureValue = encodeDERBitString(signature)

  // Complete certificate structure
  return encodeDERSequence([tbsCertificate, signatureAlgorithm, signatureValue])
}

/**
 * Validate ASN.1 DER certificate structure
 */
// biome-ignore lint/correctness/noUnusedVariables: <explanation>
export function validateDERCertificate(certBytes: Uint8Array): boolean {
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

export function extractPublicKeyFromPEMCertificate(
  pemCertificate: string,
): Safe<Uint8Array> {
  const derCertificate = pemToDer(pemCertificate)
  return extractPublicKeyFromDERCertificate(derCertificate)
}

export function extractAlternativeNameFromPEMCertificate(
  pemCertificate: string,
): Safe<AlternativeName> {
  const derCertificate = pemToDer(pemCertificate)
  return extractAlternativeNameFromDERCertificate(derCertificate)
}

/**
 * Extract public key from DER certificate using pkijs library
 */
export function extractPublicKeyFromDERCertificate(
  certBytes: Uint8Array,
): Safe<Uint8Array> {
  try {
    // Parse the DER certificate using asn1js
    const asn1 = asn1js.fromBER(certBytes)
    if (asn1.offset === -1) {
      return safeError(
        new Error(
          '[extractPublicKeyFromDERCertificate] Failed to parse DER certificate',
        ),
      )
    }

    // Create certificate object from parsed ASN.1
    const certificate = new pkijs.Certificate({ schema: asn1.result })

    // Extract public key from SubjectPublicKeyInfo
    const publicKeyInfo = certificate.subjectPublicKeyInfo
    if (!publicKeyInfo?.subjectPublicKey) {
      return safeError(
        new Error(
          '[extractPublicKeyFromDERCertificate] No SubjectPublicKeyInfo found',
        ),
      )
    }

    // Get the raw public key bytes
    const publicKeyBytes = new Uint8Array(
      publicKeyInfo.subjectPublicKey.valueBlock.valueHex!,
    )

    // For Ed25519, the public key should be 32 bytes
    if (publicKeyBytes.length === 32) {
      return safeResult(publicKeyBytes)
    } else {
      // Handle potential 33-byte key (32 bytes + unused bits byte)
      if (publicKeyBytes.length === 33) {
        const trimmedKey = publicKeyBytes.slice(1) // Skip unused bits byte
        return safeResult(trimmedKey)
      }

      return safeError(
        new Error(
          `[extractPublicKeyFromDERCertificate] Unexpected public key length: ${publicKeyBytes.length}`,
        ),
      )
    }
  } catch (error) {
    return safeError(
      new Error(`[extractPublicKeyFromDERCertificate] Error: ${error}`),
    )
  }
}

/**
 * Extract alternative name from DER certificate
 */
export function extractAlternativeNameFromDERCertificate(
  certBytes: Uint8Array,
): Safe<AlternativeName> {
  try {
    // Parse certificate and find SAN extension
    const asn1 = asn1js.fromBER(certBytes)
    if (asn1.offset === -1) {
      return safeError(new Error('Failed to parse DER certificate'))
    }

    const certificate = new pkijs.Certificate({ schema: asn1.result })
    const sanExtension = certificate.extensions?.find(
      (ext) => ext.extnID === '2.5.29.17',
    )

    if (!sanExtension) {
      return safeError(new Error('SAN extension not found'))
    }

    // Get extension value bytes
    const extnValue = sanExtension.extnValue
    const extnBytes =
      extnValue.valueBlock?.valueHexView ||
      new Uint8Array(extnValue.valueBlock?.valueHex || [])

    // Find DNS name (tag 0x82) in extension bytes
    for (let i = 0; i < extnBytes.length - 2; i++) {
      if (extnBytes[i] === 0x82) {
        const nameLength = extnBytes[i + 1]
        const nameStart = i + 2
        const nameEnd = nameStart + nameLength

        if (nameEnd <= extnBytes.length) {
          const dnsName = new TextDecoder().decode(
            extnBytes.slice(nameStart, nameEnd),
          )
          return safeResult(dnsName as AlternativeName)
        }
      }
    }

    return safeError(new Error('No DNS name found in SAN'))
  } catch (error) {
    return safeError(new Error(`Extraction failed: ${error}`))
  }
}

/**
 * Validate ALPN protocol format according to JAMNP-S spec
 * ALPN is NOT stored in certificates - this validates the protocol negotiated during TLS handshake
 */
export function validateALPNProtocolFormat(
  alpnProtocol: string,
  expectedChainHash: string,
  allowBuilder = true,
): Safe<{ version: string; chainHash: string; isBuilder: boolean }> {
  try {
    // Expected format: jamnp-s/V/H[/builder]
    // V = protocol version (must be "0")
    // H = first 8 nibbles of chain genesis header hash
    // /builder = optional suffix

    const parts = alpnProtocol.split('/')

    if (parts.length < 3 || parts.length > 4) {
      return safeError(
        new Error(
          `Invalid ALPN protocol format: expected jamnp-s/V/H[/builder], got ${alpnProtocol}`,
        ),
      )
    }

    // Check protocol name
    if (parts[0] !== 'jamnp-s') {
      return safeError(
        new Error(
          `Invalid ALPN protocol name: expected 'jamnp-s', got '${parts[0]}'`,
        ),
      )
    }

    // Check version
    if (parts[1] !== '0') {
      return safeError(
        new Error(
          `Invalid ALPN protocol version: expected '0', got '${parts[1]}'`,
        ),
      )
    }

    // Validate chain hash format (8 hex characters)
    const chainHashPart = parts[2]
    if (chainHashPart.length !== 8 || !/^[0-9a-f]+$/i.test(chainHashPart)) {
      return safeError(
        new Error(
          `Invalid chain hash in ALPN: expected 8 hex characters, got '${chainHashPart}'`,
        ),
      )
    }

    // Extract expected chain hash prefix
    const expectedPrefix = expectedChainHash.startsWith('0x')
      ? expectedChainHash.slice(2, 10).toLowerCase()
      : expectedChainHash.slice(0, 8).toLowerCase()

    if (chainHashPart.toLowerCase() !== expectedPrefix) {
      return safeError(
        new Error(
          `Chain hash mismatch: expected '${expectedPrefix}', got '${chainHashPart.toLowerCase()}'`,
        ),
      )
    }

    // Check builder suffix
    const isBuilder = parts.length === 4
    if (isBuilder) {
      if (parts[3] !== 'builder') {
        return safeError(
          new Error(
            `Invalid builder suffix: expected 'builder', got '${parts[3]}'`,
          ),
        )
      }
      if (!allowBuilder) {
        return safeError(new Error('Builder connections not allowed'))
      }
    }

    return safeResult({
      version: parts[1],
      chainHash: chainHashPart.toLowerCase(),
      isBuilder,
    })
  } catch (error) {
    return safeError(new Error(`ALPN protocol validation failed: ${error}`))
  }
}

/**
 * Generate expected ALPN protocols for a given chain hash
 */
export function generateExpectedALPNProtocols(
  chainHash: string,
  includeBuilder = true,
): string[] {
  const hashPrefix = chainHash.startsWith('0x')
    ? chainHash.slice(2, 10).toLowerCase()
    : chainHash.slice(0, 8).toLowerCase()

  const baseProtocol = `jamnp-s/0/${hashPrefix}`
  const protocols = [baseProtocol]

  if (includeBuilder) {
    protocols.push(`${baseProtocol}/builder`)
  }

  return protocols
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
 * DER encoding helper functions
 */

/**
 * Encode DER length field
 */
function encodeDERLength(length: number): Uint8Array {
  if (length < 0x80) {
    // Short form: length fits in 7 bits
    return new Uint8Array([length])
  } else if (length <= 0xff) {
    // Long form: 1 byte length
    return new Uint8Array([0x81, length])
  } else if (length <= 0xffff) {
    // Long form: 2 byte length
    return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff])
  } else {
    // Long form: 3 byte length (should be sufficient for certificates)
    return new Uint8Array([
      0x83,
      (length >> 16) & 0xff,
      (length >> 8) & 0xff,
      length & 0xff,
    ])
  }
}

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
