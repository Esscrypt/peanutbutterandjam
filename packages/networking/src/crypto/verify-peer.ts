import { bytesToHex, generateAlternativeName, logger } from '@pbnj/core'
import { decodeFixedLength } from '@pbnj/codec'
import {
  extractAlternativeNameFromDERCertificate,
  extractPublicKeyFromDERCertificate,
} from './certificates-manual'

enum CryptoError {
  CloseNotify = 256,
  UnexpectedMessage = 266,
  BadRecordMac = 276,
  RecordOverflow = 278,
  HandshakeFailure = 296,
  BadCertificate = 298,
  UnsupportedCertificate = 299,
  CertificateRevoked = 300,
  CertificateExpired = 301,
  CertificateUnknown = 302,
  IllegalParameter = 303,
  UnknownCA = 304,
  AccessDenied = 305,
  DecodeError = 306,
  DecryptError = 307,
  ProtocolVersion = 326,
  InsufficientSecurity = 327,
  InternalError = 336,
  InappropriateFallback = 342,
  UserCanceled = 346,
  MissingExtension = 365,
  UnsupportedExtension = 366,
  UnrecognizedName = 368,
  BadCertificateStatusResponse = 369,
  UnknownPSKIdentity = 371,
  CertificateRequired = 372,
  NoApplicationProtocol = 376,
}

/**
 * Perform TLS handshake verification
 */
export async function verifyPeerCertificate(
  certs: Uint8Array[],
  _ca: Uint8Array[],
): Promise<CryptoError | undefined> {
  logger.debug('Starting certificate verification...')

  // Validate certificate chain is present
  if (!certs || certs.length === 0) {
    logger.debug('❌ Certificate validation failed: No certificates provided')
    return CryptoError.BadCertificate
  }

  logger.debug(`✅ Certificate chain present: ${certs.length} certificate(s)`)

  // Use the first certificate (end entity certificate) for validation
  const peerCertificate = certs[0]
  logger.debug(`Certificate size: ${peerCertificate.length} bytes`)

  const [extractPublicKeyError, certificatePublicKey] =
    extractPublicKeyFromDERCertificate(peerCertificate)
  if (extractPublicKeyError) {
    logger.debug(
      `❌ Certificate validation failed: Failed to extract public key: ${extractPublicKeyError}`,
    )
    return CryptoError.BadCertificate
  }
  logger.debug(`✅ Public key extracted: ${bytesToHex(certificatePublicKey)}`)

  const [extractAlternativeNameError, certificateAlternativeName] =
    extractAlternativeNameFromDERCertificate(peerCertificate)
  if (extractAlternativeNameError) {
    logger.debug(
      `⚠️ Alternative name extraction failed (temporarily allowed): ${extractAlternativeNameError}`,
    )
    return CryptoError.BadCertificate
  } else {
    logger.debug(`✅ Alternative name extracted: ${certificateAlternativeName}`)
  }

  const [altNameError, altName] = generateAlternativeName(
    certificatePublicKey,
    decodeFixedLength,
  )
  if (altNameError) {
    logger.debug(
      `❌ Certificate validation failed: Failed to generate expected alternative name: ${altNameError}`,
    )
    return CryptoError.BadCertificate
  }
  logger.debug(`✅ Expected alternative name: ${altName}`)

  if (certificateAlternativeName !== altName) {
    logger.debug(`❌ Certificate validation failed: Alternative name mismatch`)
    logger.debug(`  Expected: ${altName}`)
    logger.debug(`  Actual: ${certificateAlternativeName}`)
    return CryptoError.BadCertificate
  }

  logger.debug('✅ Certificate validation passed successfully')
  // Certificate validation passed
  return undefined // No error means success
}
