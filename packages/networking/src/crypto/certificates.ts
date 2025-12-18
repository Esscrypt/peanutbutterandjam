/**
 * X.509 Certificate Management for JAMNP-S
 *
 * Provides certificate generation, validation, and alternative name computation
 * Based on the specification in certs.md
 */

import { decodeFixedLength } from '@pbnjam/codec'
import { generateAlternativeName } from '@pbnjam/core'
import type { KeyPair, Safe } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import {
  certToPEM,
  generateCertificate,
  importEd25519KeyPair,
  keyPairEd25519ToPEM,
} from './certificate-utils'
import { generateALPNProtocol } from './tls'

export async function generateNetworkingCertificates(
  keyPair: KeyPair,
  chainHash: string,
  isBuilder = false,
): Promise<
  Safe<{ privateKeyPEM: string; certificatePEM: string; alpnProtocol: string }>
> {
  // Generate DNS alt name from the public key
  const [alternativeNameError, alternativeName] = generateAlternativeName(
    keyPair.publicKey,
    decodeFixedLength,
  )
  if (alternativeNameError) {
    return safeError(alternativeNameError)
  }

  const keyPairWebcrypto = importEd25519KeyPair(
    keyPair.privateKey,
    keyPair.publicKey,
  )

  // Generate certificate with 1 year duration and computed DNS alt name
  const certEd25519 = await generateCertificate({
    certId: '0',
    subjectKeyPair: keyPairWebcrypto,
    issuerPrivateKey: keyPairWebcrypto.privateKey,
    duration: 60 * 60 * 24 * 365, // 1 year
    dnsAltNames: [alternativeName],
  })

  // Generate real X.509 certificate using proper DER generation for QUIC/TLS transport
  const keyPairEd25519PEM = await keyPairEd25519ToPEM(keyPairWebcrypto)
  const certEd25519PEM = certToPEM(certEd25519)

  // Generate ALPN protocol string according to JAMNP-S spec
  const alpnProtocol = generateALPNProtocol(chainHash, isBuilder)

  return safeResult({
    privateKeyPEM: keyPairEd25519PEM.privateKey,
    certificatePEM: certEd25519PEM,
    alpnProtocol,
  })
}
