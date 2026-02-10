import crypto from 'node:crypto'
import type {
  QUICClientCrypto,
  QUICServerConfigInput,
  QUICServerCrypto,
} from '@infisical/quic'
import * as ed from '@noble/ed25519'
import { logger, signEd25519, verifyEd25519 } from '@pbnjam/core'
import { verifyPeerCertificate } from './verify-peer'

export const getTlsConfig = (certificateData: {
  privateKeyPEM: string
  certificatePEM: string
  alpnProtocol: string
}): QUICServerConfigInput => {
  return {
    // Minimal TLS config for QUIC testing
    key: certificateData.privateKeyPEM,
    cert: certificateData.certificatePEM,
    verifyPeer: true,
    maxIdleTimeout: 6000,
    keepAliveIntervalTime: 3000,
    verifyCallback: verifyPeerCertificate,
    applicationProtos: [certificateData.alpnProtocol],
  }
}

// Create server crypto using CORRECTED Ed25519 operations
export const getServerCrypto = (privateKey: Uint8Array): QUICServerCrypto => {
  return {
    key: privateKey.buffer as ArrayBuffer,
    ops: {
      sign: async (
        key: ArrayBuffer,
        data: ArrayBuffer,
      ): Promise<ArrayBuffer> => {
        // Convert ArrayBuffer to Uint8Array for Ed25519 signing
        const keyBytes = new Uint8Array(key)
        const dataBytes = new Uint8Array(data)

        // CORRECTED: signEd25519 expects (data, privateKey) not (key, data)
        const [signError, signature] = signEd25519(dataBytes, keyBytes)
        if (signError) {
          logger.error('Ed25519 signing failed:', signError)
          return new ArrayBuffer(64) // Return zero signature on error
        }

        return signature.buffer as ArrayBuffer
      },
      verify: async (
        key: ArrayBuffer,
        data: ArrayBuffer,
        sig: ArrayBuffer,
      ): Promise<boolean> => {
        // Convert ArrayBuffer to Uint8Array for Ed25519 verification
        const keyBytes = new Uint8Array(key)
        const dataBytes = new Uint8Array(data)
        const sigBytes = new Uint8Array(sig)

        // The QUIC library passes: verify(privateKey, data, signature)
        // We need to derive the public key from the private key
        try {
          const publicKey = ed.getPublicKey(keyBytes)

          // Now verify with the derived public key
          const [isValidError, isValid] = verifyEd25519(
            dataBytes,
            sigBytes,
            publicKey, // Use derived public key
          )
          if (isValidError) {
            logger.error('Ed25519 verification failed:', isValidError)
            return false
          }

          return isValid
        } catch (error) {
          logger.error('Failed to derive public key:', error)
          return false
        }
      },
    },
  }
}

export const getClientCrypto = (): QUICClientCrypto => {
  return {
    ops: {
      randomBytes: async (data: ArrayBuffer) => {
        // Fill with cryptographically secure random bytes
        const randomData = new Uint8Array(data.byteLength)
        crypto.getRandomValues(randomData)
        new Uint8Array(data).set(randomData)
      },
    },
  }
}
