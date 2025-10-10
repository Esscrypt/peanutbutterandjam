import crypto from 'node:crypto'
import type {
  QUICClientCrypto,
  QUICConfig,
  QUICServerCrypto,
} from '@infisical/quic'
import * as ed from '@noble/ed25519'
import { bytesToHex, logger, signEd25519, verifyEd25519 } from '@pbnj/core'

export const getTlsConfig = (certificateData: {
  privateKeyPEM: string
  certificatePEM: string
  alpnProtocol: string
}): QUICConfig => {
  return {
    // Minimal TLS config for QUIC testing
    key: certificateData.privateKeyPEM,
    cert: certificateData.certificatePEM,
    verifyPeer: true,
    maxIdleTimeout: 30000,
    maxRecvUdpPayloadSize: 1500,
    maxSendUdpPayloadSize: 1500,
    initialMaxData: 1000000,
    initialMaxStreamDataBidiLocal: 100000,
    initialMaxStreamDataBidiRemote: 100000,
    initialMaxStreamDataUni: 0,
    initialMaxStreamsBidi: 100,
    initialMaxStreamsUni: 0,
    disableActiveMigration: false,
    applicationProtos: [certificateData.alpnProtocol],
    maxConnectionWindow: 25165824, // 24 MiB
    maxStreamWindow: 16777216, // 16 MiB
    enableDgram: [false, 0, 0],
    enableEarlyData: false,
    readableChunkSize: 16384,
    grease: true,
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
        logger.debug('Ed25519 sign called')
        // Convert ArrayBuffer to Uint8Array for Ed25519 signing
        const keyBytes = new Uint8Array(key)
        const dataBytes = new Uint8Array(data)

        // CORRECTED: signEd25519 expects (data, privateKey) not (key, data)
        const [signError, signature] = signEd25519(dataBytes, keyBytes)
        if (signError) {
          logger.error('Ed25519 signing failed:', signError)
          return new ArrayBuffer(64) // Return zero signature on error
        }

        logger.debug('Ed25519 sign successful')
        return signature.buffer as ArrayBuffer
      },
      verify: async (
        key: ArrayBuffer,
        data: ArrayBuffer,
        sig: ArrayBuffer,
      ): Promise<boolean> => {
        logger.debug('Ed25519 verify called with parameters:', {
          keyLength: key.byteLength,
          dataLength: data.byteLength,
          sigLength: sig.byteLength,
          keyHex: bytesToHex(new Uint8Array(key)),
        })

        // Convert ArrayBuffer to Uint8Array for Ed25519 verification
        const keyBytes = new Uint8Array(key)
        const dataBytes = new Uint8Array(data)
        const sigBytes = new Uint8Array(sig)

        // The QUIC library passes: verify(privateKey, data, signature)
        // We need to derive the public key from the private key
        try {
          const publicKey = ed.getPublicKey(keyBytes)
          logger.debug('Derived public key:', bytesToHex(publicKey))

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

          logger.debug('Ed25519 verify result:', isValid)
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
        logger.debug('🎲 Generating random bytes...', {
          size: data.byteLength,
        })
        // Fill with cryptographically secure random bytes
        const randomData = new Uint8Array(data.byteLength)
        crypto.getRandomValues(randomData)
        new Uint8Array(data).set(randomData)
        logger.debug('✅ Random bytes generated successfully')
      },
    },
  }
}
