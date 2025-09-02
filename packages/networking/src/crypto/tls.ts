/**
 * TLS 1.3 Integration for JAMNP-S
 *
 * Provides TLS 1.3 handshake with certificate authentication
 */

import {
  generateAlternativeName,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/serialization'
import type { JAMNPCertificate } from '@pbnj/types'
import packageJson from '../../package.json'

/**
 * TLS 1.3 configuration for JAMNP-S
 */
export interface TLSConfig {
  /** Certificate for this node */
  certificate: JAMNPCertificate
  /** Private key for this node */
  privateKey: Uint8Array
  /** ALPN protocols to support */
  alpnProtocols: string[]
  /** Whether to verify peer certificates */
  verifyPeer: boolean
}

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
 * Create TLS configuration for JAMNP-S
 */
export function createTLSConfig(
  certificate: JAMNPCertificate,
  privateKey: Uint8Array,
  alpnProtocols: string[],
  verifyPeer = true,
): TLSConfig {
  return {
    certificate,
    privateKey,
    alpnProtocols,
    verifyPeer,
  }
}

/**
 * Validate peer certificate during TLS handshake
 */
export function validatePeerCertificate(
  peerCertificate: JAMNPCertificate,
  expectedPublicKey?: Uint8Array,
): Safe<boolean> {
  // Basic certificate validation
  if (!validateCertificate(peerCertificate)) {
    return safeError(new Error('Invalid peer certificate'))
  }

  // Check if public key matches expected value (if provided)
  if (expectedPublicKey) {
    if (!arraysEqual(peerCertificate.publicKey, expectedPublicKey)) {
      return safeError(new Error('Public key mismatch'))
    }
  }

  const [altNameError, altName] = generateAlternativeName(
    peerCertificate.publicKey,
    decodeFixedLength,
  )
  if (altNameError) {
    return safeError(altNameError)
  }
  if (peerCertificate.alternativeName !== altName) {
    return safeError(new Error('Alternative name mismatch'))
  }

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

    if (name !== 'jamnp-s' || version !== packageJson.version) {
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

/**
 * Create TLS context for QUIC connection
 */
export function createTLSContext(config: TLSConfig): TLSConfig {
  // This would integrate with the QUIC library's TLS requirements
  // For now, we'll create a basic structure that can be extended
  return {
    certificate: config.certificate,
    privateKey: config.privateKey,
    alpnProtocols: config.alpnProtocols,
    verifyPeer: config.verifyPeer,
  }
}

/**
 * Perform TLS handshake verification
 */
export function performTLSHandshake(
  config: TLSConfig,
  peerCertificate?: JAMNPCertificate,
): Safe<TLSHandshakeResult> {
  // If we're not verifying peers, accept any valid certificate
  if (!config.verifyPeer) {
    if (peerCertificate && validateCertificate(peerCertificate)) {
      return safeResult({
        peerPublicKey: peerCertificate.publicKey,
        peerAlternativeName: peerCertificate.alternativeName,
      })
    }
  }

  // Verify peer certificate
  if (!peerCertificate) {
    return safeError(new Error('No peer certificate provided'))
  }

  if (!validatePeerCertificate(peerCertificate)) {
    return safeError(new Error('Invalid peer certificate'))
  }

  return safeResult({
    peerPublicKey: peerCertificate.publicKey,
    peerAlternativeName: peerCertificate.alternativeName,
  })
}

// Import helper functions
import { validateCertificate } from './certificates'

// Helper function to compare arrays
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}
