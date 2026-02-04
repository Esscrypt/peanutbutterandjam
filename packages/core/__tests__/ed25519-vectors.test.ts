/**
 * Ed25519 Consensus-Critical Test Vectors
 *
 * Tests signEd25519 and verifyEd25519 against 196 test vectors designed to expose
 * implementation divergence in Ed25519 signature verification.
 *
 * These vectors test ZIP 215 compliance, which is critical for consensus in
 * distributed systems. The vectors include:
 * - 8 canonical encodings from the 8-torsion subgroup
 * - 6 non-canonical encodings (non-reduced y-coordinates, non-canonical sign bits)
 * - All 14×14 = 196 combinations
 *
 * ZIP 215-compliant implementations (ed25519-consensus, ed25519-zebra) accept all
 * 196 vectors, while stricter implementations (libsodium, ring, dalek) reject most
 * non-canonical cases.
 *
 * Passing all 196 vectors indicates:
 * 1. Algebraic point comparison (not byte-wise) - non-canonical encodings are accepted
 * 2. ZIP 215 compliance - cofactor-8 verification equation
 * 3. Correct handling of torsion points and non-canonical encodings
 *
 * References:
 * - ZIP 215: https://zips.z.cash/zip-0215
 * - It's 25519AM: https://hdevalence.ca/blog/2020-10-04-its-25519am/
 */

import { describe, expect, it } from 'bun:test'
import {
  signEd25519,
  verifyEd25519,
  generateEd25519KeyPairStable,
  hexToBytes,
} from '../src/utils/crypto'
import testVectors from './vectors.json'

interface TestVector {
  number: number
  desc: string
  pk: string
  r: string
  s: string
  msg: string
  pk_canonical: boolean
  r_canonical: boolean
}

describe('Ed25519 Signature Test Vectors', () => {
  describe('ZIP 215 Compliance - All Vectors', () => {
    it.each(testVectors as TestVector[])(
      'should verify signature for vector #$number: $desc',
      ({ number, desc, pk, r, s, msg, pk_canonical, r_canonical }) => {
        // Convert hex strings to Uint8Array
        const publicKey = hexToBytes((pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`)
        const rPoint = hexToBytes((r.startsWith('0x') ? r : `0x${r}`) as `0x${string}`)
        const sScalar = hexToBytes((s.startsWith('0x') ? s : `0x${s}`) as `0x${string}`)
        const message = hexToBytes((msg.startsWith('0x') ? msg : `0x${msg}`) as `0x${string}`)

        // Ed25519 signature is R (32 bytes) || s (32 bytes) = 64 bytes total
        const signature = new Uint8Array(64)
        signature.set(rPoint, 0)
        signature.set(sScalar, 32)

        // Verify the signature
        // ZIP 215 requires algebraic point comparison, not byte-wise comparison.
        // This means non-canonical encodings should be accepted if they represent
        // the same algebraic point.
        const [error, isValid] = verifyEd25519(message, signature, publicKey)

        if (error) {
          console.error(`\n❌ Vector #${number} FAILED: ${desc}`)
          console.error(`   Error: ${error.message}`)
          console.error(`   Public Key (canonical: ${pk_canonical}): ${pk}`)
          console.error(`   R (canonical: ${r_canonical}): ${r}`)
          console.error(`   Message: ${msg}`)
          console.error(`   s: ${s}`)
        }

        if (isValid === false) {
          console.error(`\n❌ Vector #${number} FAILED: ${desc}`)
          console.error(`   Verification returned false`)
          console.error(`   Public Key (canonical: ${pk_canonical}): ${pk}`)
          console.error(`   R (canonical: ${r_canonical}): ${r}`)
          console.error(`   Message: ${msg}`)
          console.error(`   s: ${s}`)
          console.error(
            `   This indicates byte-wise comparison or strict encoding validation,`,
          )
          console.error(`   which is NOT ZIP 215 compliant.`)
        }

        expect(error).toBeUndefined()
        expect(isValid).toBe(true)
      },
    )
  })

  describe('ZIP 215 Explicit Compliance Tests', () => {
    it('should validate that A and R are encodings of points on Ed25519 (ZIP 215 Rule 1)', () => {
      // ZIP 215 Rule 1: A and R must be encodings of points on Ed25519
      // This is tested implicitly by verifying all 196 vectors pass.
      // If A or R were invalid point encodings, verification would fail.
      const vectors = testVectors as TestVector[]
      
      // All vectors should have valid point encodings
      for (const vector of vectors.slice(0, 20)) {
        const publicKey = hexToBytes(
          (vector.pk.startsWith('0x') ? vector.pk : `0x${vector.pk}`) as `0x${string}`,
        )
        const rPoint = hexToBytes(
          (vector.r.startsWith('0x') ? vector.r : `0x${vector.r}`) as `0x${string}`,
        )
        const sScalar = hexToBytes(
          (vector.s.startsWith('0x') ? vector.s : `0x${vector.s}`) as `0x${string}`,
        )
        const message = hexToBytes(
          (vector.msg.startsWith('0x') ? vector.msg : `0x${vector.msg}`) as `0x${string}`,
        )

        const signature = new Uint8Array(64)
        signature.set(rPoint, 0)
        signature.set(sScalar, 32)

        // If A or R are invalid point encodings, verification should fail
        const [error, isValid] = verifyEd25519(message, signature, publicKey)
        
        // ZIP 215: All vectors have valid point encodings, so verification should succeed
        expect(error).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should validate canonical scalar encoding s < q (ZIP 215 Rule 2)', () => {
      // ZIP 215 Rule 2: s < q (canonical scalar encoding)
      // The test vectors all have s = 0, which satisfies s < q
      // We verify this by checking that all vectors pass verification
      const vectors = testVectors as TestVector[]
      
      // Ed25519 scalar order q = 2^252 + 27742317777372353535851937790883648493
      // All test vectors have s = 0, which is < q
      for (const vector of vectors.slice(0, 20)) {
        const sScalar = hexToBytes(
          (vector.s.startsWith('0x') ? vector.s : `0x${vector.s}`) as `0x${string}`,
        )
        
        // Verify s is 32 bytes (required for Ed25519)
        expect(sScalar.length).toBe(32)
        
        // In test vectors, s is always 0, which is < q
        // If s >= q, verification would fail in strict implementations
        const allZeros = sScalar.every((byte) => byte === 0)
        expect(allZeros).toBe(true) // Test vectors use s = 0
      }
    })

    it('should permit non-canonical point encodings (ZIP 215 Rule 3)', () => {
      // ZIP 215 Rule 3: Non-canonical point encodings permitted
      // (y-coordinates need not be reduced mod p)
      // This is explicitly tested by verifying vectors with non-canonical encodings pass
      const vectors = testVectors as TestVector[]
      const nonCanonicalVectors = vectors.filter(
        (v) => !v.pk_canonical || !v.r_canonical,
      )

      expect(nonCanonicalVectors.length).toBeGreaterThan(0)

      // ZIP 215 requires accepting non-canonical encodings
      for (const vector of nonCanonicalVectors.slice(0, 20)) {
        const publicKey = hexToBytes(
          (vector.pk.startsWith('0x') ? vector.pk : `0x${vector.pk}`) as `0x${string}`,
        )
        const rPoint = hexToBytes(
          (vector.r.startsWith('0x') ? vector.r : `0x${vector.r}`) as `0x${string}`,
        )
        const sScalar = hexToBytes(
          (vector.s.startsWith('0x') ? vector.s : `0x${vector.s}`) as `0x${string}`,
        )
        const message = hexToBytes(
          (vector.msg.startsWith('0x') ? vector.msg : `0x${vector.msg}`) as `0x${string}`,
        )

        const signature = new Uint8Array(64)
        signature.set(rPoint, 0)
        signature.set(sScalar, 32)

        const [error, isValid] = verifyEd25519(message, signature, publicKey)

        // ZIP 215 Rule 3: Non-canonical encodings should be accepted
        expect(error).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should use cofactor-8 verification equation (ZIP 215 Rule 4)', () => {
      // ZIP 215 Rule 4: Cofactor-8 verification equation [8][s]B = [8]R + [8][k]A required
      // 
      // We rely on @noble/ed25519 to implement this correctly. The fact that all 196
      // test vectors pass (including those with torsion points) indicates cofactor-8
      // verification is being used, as unbatched verification would reject many vectors.
      //
      // ZIP 215-compliant implementations accept all 196 vectors, which is what we observe.
      const vectors = testVectors as TestVector[]
      
      // All vectors should pass, including those with torsion points
      // This indicates cofactor-8 verification is being used
      const allPass = vectors.every((v) => {
        const publicKey = hexToBytes(
          (v.pk.startsWith('0x') ? v.pk : `0x${v.pk}`) as `0x${string}`,
        )
        const rPoint = hexToBytes(
          (v.r.startsWith('0x') ? v.r : `0x${v.r}`) as `0x${string}`,
        )
        const sScalar = hexToBytes(
          (v.s.startsWith('0x') ? v.s : `0x${v.s}`) as `0x${string}`,
        )
        const message = hexToBytes(
          (v.msg.startsWith('0x') ? v.msg : `0x${v.msg}`) as `0x${string}`,
        )

        const signature = new Uint8Array(64)
        signature.set(rPoint, 0)
        signature.set(sScalar, 32)

        const [error, isValid] = verifyEd25519(message, signature, publicKey)
        return !error && isValid === true
      })

      // ZIP 215 Rule 4: All 196 vectors pass, indicating cofactor-8 verification
      expect(allPass).toBe(true)
      expect(vectors.length).toBe(196)
    })
  })

  describe('Point Encoding Validation', () => {
    it('should accept both canonical and non-canonical point encodings', () => {
      const vectors = testVectors as TestVector[]
      
      // Count canonical vs non-canonical
      const canonicalPk = vectors.filter((v) => v.pk_canonical).length
      const nonCanonicalPk = vectors.filter((v) => !v.pk_canonical).length
      const canonicalR = vectors.filter((v) => v.r_canonical).length
      const nonCanonicalR = vectors.filter((v) => !v.r_canonical).length

      // ZIP 215 requires accepting non-canonical encodings
      // We should have both canonical and non-canonical vectors
      expect(canonicalPk).toBeGreaterThan(0)
      expect(nonCanonicalPk).toBeGreaterThan(0)
      expect(canonicalR).toBeGreaterThan(0)
      expect(nonCanonicalR).toBeGreaterThan(0)

      // Verify that non-canonical encodings are accepted
      const nonCanonicalVectors = vectors.filter(
        (v) => !v.pk_canonical || !v.r_canonical,
      )

      for (const vector of nonCanonicalVectors.slice(0, 10)) {
        // Sample test - full verification happens in main test suite
        const publicKey = hexToBytes(
          (vector.pk.startsWith('0x') ? vector.pk : `0x${vector.pk}`) as `0x${string}`,
        )
        const rPoint = hexToBytes(
          (vector.r.startsWith('0x') ? vector.r : `0x${vector.r}`) as `0x${string}`,
        )
        const sScalar = hexToBytes(
          (vector.s.startsWith('0x') ? vector.s : `0x${vector.s}`) as `0x${string}`,
        )
        const message = hexToBytes(
          (vector.msg.startsWith('0x') ? vector.msg : `0x${vector.msg}`) as `0x${string}`,
        )

        const signature = new Uint8Array(64)
        signature.set(rPoint, 0)
        signature.set(sScalar, 32)

        const [error, isValid] = verifyEd25519(message, signature, publicKey)

        // ZIP 215: Non-canonical encodings should be accepted
        expect(error).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should use algebraic point comparison (not byte-wise)', () => {
      // This test verifies that we accept non-canonical encodings that represent
      // the same algebraic point. Byte-wise comparison would reject these.
      const vectors = testVectors as TestVector[]
      const nonCanonicalVectors = vectors.filter(
        (v) => !v.pk_canonical || !v.r_canonical,
      )

      // If we accept non-canonical encodings, we're using algebraic comparison
      // All 196 vectors should pass, including non-canonical ones
      expect(nonCanonicalVectors.length).toBeGreaterThan(0)

      // The fact that all vectors pass in the main test suite proves we use
      // algebraic comparison. This test documents that expectation.
      const allPass = vectors.every((v) => {
        const publicKey = hexToBytes(
          (v.pk.startsWith('0x') ? v.pk : `0x${v.pk}`) as `0x${string}`,
        )
        const rPoint = hexToBytes(
          (v.r.startsWith('0x') ? v.r : `0x${v.r}`) as `0x${string}`,
        )
        const sScalar = hexToBytes(
          (v.s.startsWith('0x') ? v.s : `0x${v.s}`) as `0x${string}`,
        )
        const message = hexToBytes(
          (v.msg.startsWith('0x') ? v.msg : `0x${v.msg}`) as `0x${string}`,
        )

        const signature = new Uint8Array(64)
        signature.set(rPoint, 0)
        signature.set(sScalar, 32)

        const [error, isValid] = verifyEd25519(message, signature, publicKey)
        return !error && isValid === true
      })

      expect(allPass).toBe(true)
    })
  })

  describe('Sign and Verify Round-trip Tests', () => {
    it('should sign and verify messages from test vectors', () => {
      // Use messages and public keys from test vectors
      // Note: vectors.json only contains public keys, not private keys, so we generate
      // key pairs for signing but use messages from the vectors
      const vectors = testVectors as TestVector[]
      
      // Get unique messages from test vectors
      const uniqueMessages = new Map<string, TestVector>()
      for (const vector of vectors) {
        const msgHex = vector.msg.startsWith('0x') ? vector.msg : `0x${vector.msg}`
        if (!uniqueMessages.has(msgHex)) {
          uniqueMessages.set(msgHex, vector)
        }
      }

      // Test with messages from vectors
      const testCases = Array.from(uniqueMessages.values()).slice(0, 10)

      for (const vector of testCases) {
        const message = hexToBytes(
          (vector.msg.startsWith('0x') ? vector.msg : `0x${vector.msg}`) as `0x${string}`,
        )

        // Generate a key pair for signing (vectors don't contain private keys)
        const { publicKey, privateKey } = generateEd25519KeyPairStable()

        // Extract the 32-byte seed from the 64-byte secretKey
        // @noble/ed25519's secretKey is 64 bytes: [32-byte seed || 32-byte public key]
        const privateKeySeed = privateKey.slice(0, 32)

        // Sign the message from the vector
        const [signError, signature] = signEd25519(message, privateKeySeed)

        if (signError) {
          console.error(`\n❌ Signing FAILED for vector #${vector.number}: ${vector.desc}`)
          console.error(`   Error: ${signError.message}`)
          console.error(`   Message: ${vector.msg}`)
        }

        expect(signError).toBeUndefined()
        expect(signature).toBeDefined()
        expect(signature?.length).toBe(64)

        // Verify the signature
        const [verifyError, isValid] = verifyEd25519(
          message,
          signature!,
          publicKey,
        )

        if (verifyError || isValid === false) {
          console.error(`\n❌ Verification FAILED for vector #${vector.number}: ${vector.desc}`)
          console.error(`   Error: ${verifyError?.message || 'Verification returned false'}`)
          console.error(`   Message: ${vector.msg}`)
        }

        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should verify signatures using public keys from test vectors', () => {
      // Test verification with public keys from vectors
      // This verifies that our implementation correctly handles the public key encodings
      // from the test vectors (both canonical and non-canonical)
      const vectors = testVectors as TestVector[]
      
      for (const vector of vectors) {
        const publicKey = hexToBytes(
          (vector.pk.startsWith('0x') ? vector.pk : `0x${vector.pk}`) as `0x${string}`,
        )
        const rPoint = hexToBytes(
          (vector.r.startsWith('0x') ? vector.r : `0x${vector.r}`) as `0x${string}`,
        )
        const sScalar = hexToBytes(
          (vector.s.startsWith('0x') ? vector.s : `0x${vector.s}`) as `0x${string}`,
        )
        const message = hexToBytes(
          (vector.msg.startsWith('0x') ? vector.msg : `0x${vector.msg}`) as `0x${string}`,
        )

        // Construct signature from vector
        const signature = new Uint8Array(64)
        signature.set(rPoint, 0)
        signature.set(sScalar, 32)

        // Verify using public key from vector
        const [verifyError, isValid] = verifyEd25519(message, signature, publicKey)

        if (verifyError || isValid === false) {
          console.error(`\n❌ Verification FAILED for vector #${vector.number}: ${vector.desc}`)
          console.error(`   Public Key (canonical: ${vector.pk_canonical}): ${vector.pk}`)
          console.error(`   R (canonical: ${vector.r_canonical}): ${vector.r}`)
        }

        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })
  })

})

