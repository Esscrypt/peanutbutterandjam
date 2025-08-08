/**
 * TLS 1.3 Integration for JAMNP-S
 *
 * Provides TLS 1.3 handshake with certificate authentication
 */

import type { Bytes, JAMNPCertificate } from '@pbnj/types'
import packageJson from '../../package.json' assert { type: 'json' }

/**
 * TLS 1.3 configuration for JAMNP-S
 */
export interface TLSConfig {
  /** Certificate for this node */
  certificate: JAMNPCertificate
  /** Private key for this node */
  privateKey: Bytes
  /** ALPN protocols to support */
  alpnProtocols: string[]
  /** Whether to verify peer certificates */
  verifyPeer: boolean
}

/**
 * TLS handshake result
 */
export interface TLSHandshakeResult {
  /** Whether handshake was successful */
  success: boolean
  /** Peer's public key (if verification succeeded) */
  peerPublicKey?: Bytes
  /** Peer's alternative name (if verification succeeded) */
  peerAlternativeName?: string
  /** Error message (if handshake failed) */
  error?: string
}

/**
 * Create TLS configuration for JAMNP-S
 */
export function createTLSConfig(
  certificate: JAMNPCertificate,
  privateKey: Bytes,
  alpnProtocols: string[],
  verifyPeer: boolean = true
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
  expectedPublicKey?: Bytes
): boolean {
  try {
    // Basic certificate validation
    if (!validateCertificate(peerCertificate)) {
      return false
    }
    
    // Check if public key matches expected value (if provided)
    if (expectedPublicKey) {
      if (!arraysEqual(peerCertificate.publicKey, expectedPublicKey)) {
        return false
      }
    }
    
    // Verify alternative name consistency
    const expectedName = generateAlternativeName(peerCertificate.publicKey)
    if (peerCertificate.alternativeName !== expectedName) {
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

/**
 * Generate ALPN protocol identifier for JAMNP-S
 */
export function generateALPNProtocol(
  chainHash: string,
  isBuilder: boolean = false
): string {
  const base = `jamnp-s/${packageJson.version}/${chainHash}`
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
  } catch (error) {
    return null
  }
}

/**
 * Create TLS context for QUIC connection
 */
export function createTLSContext(config: TLSConfig): any {
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
  peerCertificate?: JAMNPCertificate
): TLSHandshakeResult {
  try {
    // If we're not verifying peers, accept any valid certificate
    if (!config.verifyPeer) {
      if (peerCertificate && validateCertificate(peerCertificate)) {
        return {
          success: true,
          peerPublicKey: peerCertificate.publicKey,
          peerAlternativeName: peerCertificate.alternativeName,
        }
      }
      return {
        success: true,
      }
    }
    
    // Verify peer certificate
    if (!peerCertificate) {
      return {
        success: false,
        error: 'No peer certificate provided',
      }
    }
    
    if (!validatePeerCertificate(peerCertificate)) {
      return {
        success: false,
        error: 'Invalid peer certificate',
      }
    }
    
    return {
      success: true,
      peerPublicKey: peerCertificate.publicKey,
      peerAlternativeName: peerCertificate.alternativeName,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Import helper functions
import { validateCertificate, generateAlternativeName } from './certificates'

// Helper function to compare arrays
function arraysEqual(a: Bytes, b: Bytes): boolean {
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