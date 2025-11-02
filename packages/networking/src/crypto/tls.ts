/**
 * TLS 1.3 Integration for JAMNP-S
 *
 * Provides TLS 1.3 handshake with certificate authentication
 */

import { generateAlternativeName } from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'
import type { Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { validateDERCertificate } from './certificates-manual'

/**
 * TLS handshake result
 */
export interface TLSHandshakeResult {
  /** Peer's public key (if verification succeeded) */
  peerPublicKey?: Uint8Array
  /** Peer's alternative name (if verification succeeded) */
  peerAlternativeName?: string
}

/**
 * Validate peer certificate during TLS handshake
 */
export function validatePeerCertificate(
  peerCertificate: Uint8Array,
  parsedPeerPublicKey: Uint8Array,
  parsedPeerAlternativeName: string,
  _chainHash: string,
  _isBuilder = false,
): Safe<boolean> {
  // Basic certificate validation
  if (!validateDERCertificate(peerCertificate)) {
    return safeError(
      new Error('[validatePeerCertificate] Invalid peer certificate'),
    )
  }

  const [altNameError, altName] = generateAlternativeName(
    parsedPeerPublicKey,
    decodeFixedLength,
  )
  if (altNameError) {
    return safeError(altNameError)
  }
  if (parsedPeerAlternativeName !== altName) {
    return safeError(
      new Error('[validatePeerCertificate] Alternative name mismatch'),
    )
  }

  //TODO: check if this is a known public key using the validator set manager
  //TODO: validate the chain hash against the genesis header hash
  //TODO: validate the isBuilder against the node type

  // validate the target ALPN protocol

  return safeResult(true)
}

/**
 * Generate ALPN protocol identifier for JAMNP-S
 * Format: jamnp-s/V/H or jamnp-s/V/H/builder
 * Where V is protocol version (0) and H is first 8 nibbles of genesis header hash
 */
export function generateALPNProtocol(
  chainHash: string,
  isBuilder = false,
): string {
  // Protocol version is always 0 per Gray Paper specification
  const protocolVersion = '0'
  // Take first 8 nibbles (4 bytes) of chain hash in lowercase hex
  const hashPrefix = chainHash.startsWith('0x')
    ? chainHash.slice(2, 10)
    : chainHash.slice(0, 8)
  const base = `jamnp-s/${protocolVersion}/${hashPrefix.toLowerCase()}`
  return isBuilder ? `${base}/builder` : base
}

/**
 * Parse ALPN protocol identifier
 */
export function parseALPNProtocol(protocol: string): {
  name: string
  version: string
  chainHash: string
  isBuilder: boolean
} | null {
  try {
    const parts = protocol.split('/')
    if (parts.length < 3 || parts.length > 4) {
      return null
    }

    const [name, version, chainHash, builder] = parts

    if (name !== 'jamnp-s' || version !== '0') {
      return null
    }

    if (chainHash.length !== 8) {
      return null
    }

    const isBuilder = builder === 'builder'

    return {
      name,
      version,
      chainHash,
      isBuilder,
    }
  } catch (_error) {
    return null
  }
}

// expectedChainHash should be based on the genesis header hash (from genesis manager)
// expectedIsBuilder should be based on the node type (from node config)
export function validateALPNProtocol(
  protocol: string,
  expectedChainHash: string,
  expectedIsBuilder: boolean,
): Safe<boolean> {
  const parts = protocol.split('/')
  if (parts.length < 3 || parts.length > 4) {
    return safeError(
      new Error('[validateALPNProtocol] Invalid ALPN protocol parts'),
    )
  }

  const [name, version, chainHash, builder] = parts

  if (name !== 'jamnp-s' || version !== '0') {
    return safeError(new Error('[validateALPNProtocol] Invalid ALPN protocol'))
  }

  if (chainHash.length !== 8) {
    return safeError(
      new Error('[validateALPNProtocol] Invalid Chain hash length'),
    )
  }

  const isBuilder = builder === 'builder'
  if (isBuilder !== expectedIsBuilder) {
    return safeError(new Error('[validateALPNProtocol] Builder mismatch'))
  }
  if (chainHash !== expectedChainHash) {
    return safeError(new Error('[validateALPNProtocol] Chain hash mismatch'))
  }
  return safeResult(true)
}

/**
 * Check preferred initiator logic according to JAMNP-S spec
 * true means local should initiate
 */
export function shouldLocalInitiate(
  localKey: Uint8Array,
  remoteKey: Uint8Array,
): boolean {
  // P(a,b) = a when (a[31] > 127) ⊕ (b[31] > 127) ⊕ (a < b), b otherwise
  const aHigh = localKey[31] > 127
  const bHigh = remoteKey[31] > 127
  const aLessThanB = compareKeysLexicographically(localKey, remoteKey) < 0

  const xor1 = aHigh !== bHigh
  const xor2 = xor1 !== aLessThanB

  return xor2 // true means local should initiate
}

/**
 * Compare two Ed25519 keys lexicographically
 */
function compareKeysLexicographically(
  keyA: Uint8Array,
  keyB: Uint8Array,
): number {
  for (let i = 0; i < Math.min(keyA.length, keyB.length); i++) {
    if (keyA[i] < keyB[i]) return -1
    if (keyA[i] > keyB[i]) return 1
  }
  return keyA.length - keyB.length
}

/**
 * Extract raw private key bytes from PEM format
 */
export function extractPrivateKeyFromPEM(pemString: string): Uint8Array {
  // Remove PEM headers and footers
  const pemContent = pemString
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, '')
    .replace(/-----END EC PRIVATE KEY-----/g, '')
    .replace(/\s/g, '') // Remove whitespace

  // Decode base64
  const keyBytes = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

  // For PKCS#8 format, we need to extract the actual Ed25519 key
  // This is a simplified extraction - in production you'd want proper ASN.1 parsing
  if (pemString.includes('BEGIN PRIVATE KEY')) {
    // PKCS#8 format - extract the raw key from the ASN.1 structure
    // This is a simplified approach - the actual key is typically at the end
    // For Ed25519, the private key is 32 bytes
    return keyBytes.slice(-32)
  } else {
    // Assume raw key format
    return keyBytes
  }
}

/**
 * Convert PEM certificate to DER bytes
 */
export function pemToDer(pemString: string): Uint8Array {
  // Add debugging to see what we're receiving
  if (typeof pemString !== 'string') {
    throw new Error(
      `pemToDer expected string but received ${typeof pemString}: ${pemString}`,
    )
  }

  // Remove PEM headers and footers
  const base64String = pemString
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n/g, '')
    .trim()

  // Convert base64 to bytes
  const binaryString = atob(base64String)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}
