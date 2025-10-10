/**
 * Quick test for simplified extractAlternativeNameFromDERCertificate
 */

import { readFileSync } from 'node:fs'
import { extractAlternativeNameFromDERCertificate } from '../src/crypto/certificates-manual'

async function testSimplifiedExtraction(): Promise<void> {
  console.log('Testing simplified extractAlternativeNameFromDERCertificate...')

  try {
    // Read the certificate file
    const pemCert = readFileSync('/tmp/alice_cert.pem', 'utf8')

    // Convert PEM to DER
    const pemContent = pemCert
      .replace(/-----BEGIN CERTIFICATE-----\n?/, '')
      .replace(/\n?-----END CERTIFICATE-----/, '')
      .replace(/\n/g, '')

    const derBytes = new Uint8Array(Buffer.from(pemContent, 'base64'))

    // Extract alternative name
    const [error, altName] = extractAlternativeNameFromDERCertificate(derBytes)

    if (error) {
      console.error('❌ Failed:', error)
    } else {
      console.log('✅ Success:', altName)
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

if (import.meta.main) {
  testSimplifiedExtraction()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
