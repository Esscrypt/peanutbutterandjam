import { decodeFixedLength } from '@pbnjam/codec'
import { bytesToHex, generateAlternativeName, logger } from '@pbnjam/core'
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
  // Validate certificate chain is present
  if (!certs || certs.length === 0) {
    logger.error(
      '[TLS Verification] ❌ Certificate validation failed: No certificates provided',
      {
        certs: certs,
        certsLength: certs?.length,
      },
    )
    return CryptoError.BadCertificate
  }

  // Use the first certificate (end entity certificate) for validation
  const peerCertificate = certs[0]

  const [extractPublicKeyError, certificatePublicKey] =
    extractPublicKeyFromDERCertificate(peerCertificate)
  if (extractPublicKeyError) {
    logger.error(
      '[TLS Verification] ❌ Certificate validation failed: Failed to extract public key',
      {
        error:
          extractPublicKeyError instanceof Error
            ? extractPublicKeyError.message
            : String(extractPublicKeyError),
        certificateSize: peerCertificate.length,
      },
    )
    return CryptoError.BadCertificate
  }

  const [extractAlternativeNameError, certificateAlternativeName] =
    extractAlternativeNameFromDERCertificate(peerCertificate)
  if (extractAlternativeNameError) {
    logger.error('[TLS Verification] ❌ Alternative name extraction failed', {
      error:
        extractAlternativeNameError instanceof Error
          ? extractAlternativeNameError.message
          : String(extractAlternativeNameError),
      publicKey: bytesToHex(certificatePublicKey),
    })
    return CryptoError.BadCertificate
  }

  const [altNameError, altName] = generateAlternativeName(
    certificatePublicKey,
    decodeFixedLength,
  )
  if (altNameError) {
    logger.error(
      '[TLS Verification] ❌ Certificate validation failed: Failed to generate expected alternative name',
      {
        error:
          altNameError instanceof Error
            ? altNameError.message
            : String(altNameError),
        publicKey: bytesToHex(certificatePublicKey),
      },
    )
    return CryptoError.BadCertificate
  }

  if (certificateAlternativeName !== altName) {
    logger.error(
      '[TLS Verification] ❌ Certificate validation failed: Alternative name mismatch',
      {
        expected: altName,
        actual: certificateAlternativeName,
        publicKey: bytesToHex(certificatePublicKey),
        match: certificateAlternativeName === altName,
      },
    )
    return CryptoError.BadCertificate
  }

  // Certificate validation passed
  return undefined // No error means success
}
