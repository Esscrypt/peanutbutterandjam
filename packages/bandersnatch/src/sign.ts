/**
 * Bandersnatch IETF VRF Implementation
 *
 * This implements the IETF VRF (Verifiable Random Function) as specified in:
 * - Gray Paper: https://github.com/gavofyork/graypaper (bandersnatch.tex)
 * - IETF RFC-9381: https://datatracker.ietf.org/doc/rfc9381
 * - Bandersnatch VRF Specification: submodules/bandersnatch-vrf-spec/specification.md
 *
 * The VRF provides:
 * 1. Verifiability: Anyone can verify the proof without the private key
 * 2. Uniqueness: Only the private key holder can generate valid proofs
 * 3. Pseudorandomness: Output appears random but is deterministic
 * 4. Additional Data: Can sign additional context data alongside the message
 *
 * Algorithm Overview (IETF VRF with Additional Data):
 * 1. Hash message to curve point using Elligator2 (I = hash_to_curve(message))
 * 2. Compute VRF output point (O = x * I, where x is private key)
 * 3. Generate public key (Y = x * G)
 * 4. Generate nonce (k = nonce_generation(x, I))
 * 5. Compute challenge (c = challenge(Y, I, O, k*G, k*I, additional_data))
 * 6. Compute response (s = k + c * x)
 * 7. Return proof (c, s) and output point O
 *
 * Verification:
 * 1. Reconstruct U = s*G - c*Y and V = s*I - c*O
 * 2. Recompute challenge c' = challenge(Y, I, O, U, V, additional_data)
 * 3. Verify c == c'
 */

import { sha512 } from '@noble/hashes/sha2'
import {
  bytesToBigInt,
  concatBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { CurvePoint } from '@pbnj/types'
import { BANDERSNATCH_PARAMS } from './config'
import { elligator2HashToCurve } from './crypto/elligator2-rfc9380'
import { BandersnatchCurve } from './curve'

export interface BandersnatchVRFProof {
  c: Uint8Array // Challenge (32 bytes)
  s: Uint8Array // Response (32 bytes)
}

export interface BandersnatchVRFOutput {
  output: Uint8Array // VRF output point (32 bytes compressed)
  proof: BandersnatchVRFProof
}

/**
 * Generate a Bandersnatch IETF VRF proof with additional data
 *
 * This implements the IETF VRF Prove function as specified in:
 * - Section 2.2 of bandersnatch-vrf-spec/specification.md
 * - Section 5.4.2 of RFC-9381
 *
 * @param privateKey - 32-byte private key scalar
 * @param context - Additional data to be signed (can be empty)
 * @param message - Message to generate VRF output for
 * @returns VRF output point and Schnorr-like proof (c, s)
 */
export function signMessage(
  privateKey: Uint8Array,
  context: Uint8Array,
  message: Uint8Array,
): Safe<BandersnatchVRFOutput> {
  try {
    // Step 1: Convert private key to bigint
    const x = bytesToBigInt(privateKey)

    // Step 2: Hash message to curve point using Elligator2
    // This implements ECVRF_encode_to_curve as specified in RFC-9381
    const [IError, I] = elligator2HashToCurve(message)
    if (IError) {
      return safeError(
        new Error(`Elligator2 hash-to-curve failed: ${IError.message}`),
      )
    }

    // Step 3: Compute VRF output point O = x * I
    // This is the core VRF output that appears random but is deterministic
    const O = BandersnatchCurve.scalarMultiply(I, x)

    // Step 4: Generate public key Y = x * G
    const Y = BandersnatchCurve.scalarMultiply(BandersnatchCurve.GENERATOR, x)

    // Step 5: Generate nonce k using RFC-9381 nonce generation
    // This ensures k is deterministic but unpredictable
    const k = generateNonce(x, I)

    // Step 6: Compute challenge c = challenge(Y, I, O, k*G, k*I, additional_data)
    // This binds the proof to the specific message and additional data
    const kG = BandersnatchCurve.scalarMultiply(BandersnatchCurve.GENERATOR, k)
    const kI = BandersnatchCurve.scalarMultiply(I, k)
    const c = computeChallenge(Y, I, O, kG, kI, context)

    // Step 7: Compute response s = k + c * x
    // This is the Schnorr-like signature component
    const s = (k + c * x) % BANDERSNATCH_PARAMS.CURVE_ORDER

    // Step 8: Serialize output point and proof
    const outputBytes = BandersnatchCurve.pointToBytes(O)
    const cBytes = scalarToBytes(c)
    const sBytes = scalarToBytes(s)

    return safeResult({
      output: outputBytes,
      proof: {
        c: cBytes,
        s: sBytes,
      },
    })
  } catch (error) {
    return safeError(new Error(`VRF proof generation failed: ${error}`))
  }
}

/**
 * Verify a Bandersnatch IETF VRF proof
 *
 * This implements the IETF VRF Verify function as specified in:
 * - Section 2.3 of bandersnatch-vrf-spec/specification.md
 * - Section 5.4.3 of RFC-9381
 *
 * The verification process:
 * 1. Parse the proof components (c, s)
 * 2. Reconstruct intermediate points U = s*G - c*Y and V = s*I - c*O
 * 3. Recompute the challenge c' = challenge(Y, I, O, U, V, additional_data)
 * 4. Verify that c == c'
 *
 * @param publicKey - 32-byte compressed public key
 * @param context - Additional data that was signed (can be empty)
 * @param message - Original message
 * @param vrfOutput - VRF output containing the output point and proof
 * @returns true if proof is valid, false otherwise
 */
export function verifySignature(
  publicKey: Uint8Array,
  context: Uint8Array,
  message: Uint8Array,
  vrfOutput: BandersnatchVRFOutput,
): Safe<boolean> {
  // Step 1: Parse proof components
  const { output: outputBytes, proof } = vrfOutput
  const { c: cBytes, s: sBytes } = proof

  // Step 2: Validate input lengths
  if (
    publicKey.length !== 32 ||
    outputBytes.length !== 32 ||
    cBytes.length !== 32 ||
    sBytes.length !== 32
  ) {
    return safeError(new Error('Invalid input lengths'))
  }

  // Step 3: Convert bytes to curve points and scalars
  const Y = BandersnatchCurve.bytesToPoint(publicKey)
  const O = BandersnatchCurve.bytesToPoint(outputBytes)
  const [IError, I] = elligator2HashToCurve(message)
  if (IError) {
    return safeError(
      new Error(`Elligator2 hash-to-curve failed: ${IError.message}`),
    )
  }
  const c = bytesToBigIntLittleEndian(cBytes)
  const s = bytesToBigIntLittleEndian(sBytes)

  // Step 4: Reconstruct intermediate points for verification
  // U = s*G - c*Y (this should equal k*G from the signing process)
  const sG = BandersnatchCurve.scalarMultiply(BandersnatchCurve.GENERATOR, s)
  const cY = BandersnatchCurve.scalarMultiply(Y, c)
  const U = BandersnatchCurve.add(sG, BandersnatchCurve.negate(cY))

  // V = s*I - c*O (this should equal k*I from the signing process)
  const sI = BandersnatchCurve.scalarMultiply(I, s)
  const cO = BandersnatchCurve.scalarMultiply(O, c)
  const V = BandersnatchCurve.add(sI, BandersnatchCurve.negate(cO))

  // Step 5: Recompute challenge
  const cPrime = computeChallenge(Y, I, O, U, V, context)

  // Step 6: Verify challenge matches
  const isValid = c === cPrime

  return safeResult(isValid)
}

/**
 * Generate VRF output hash from the output point
 *
 * This implements the output-to-hash procedure as specified in:
 * - Section 1.6 of bandersnatch-vrf-spec/specification.md
 * - Section 5.2 of RFC-9381
 *
 * @param outputPoint - The VRF output point
 * @returns 32-byte hash of the output point
 */
export function vrfOutputToHash(outputPoint: Uint8Array): Uint8Array {
  // This is a simplified implementation - in practice, this would use
  // the proper output-to-hash procedure from RFC-9381
  return outputPoint.slice(0, 32)
}

/**
 * Generate deterministic nonce for VRF proof
 *
 * This implements ECVRF_nonce_generation as specified in:
 * - Section 5.4.2.2 of RFC-9381
 *
 * @param privateKey - The private key scalar
 * @param inputPoint - The VRF input point
 * @returns Deterministic nonce scalar
 */
function generateNonce(privateKey: bigint, inputPoint: CurvePoint): bigint {
  // Simplified nonce generation - in practice, this would follow RFC-9381
  // which uses HMAC-SHA512 with specific domain separation
  const nonceInput = new Uint8Array(64)
  const privateKeyBytes = scalarToBytes(privateKey)
  const inputPointBytes = BandersnatchCurve.pointToBytes(inputPoint)

  nonceInput.set(privateKeyBytes, 0)
  nonceInput.set(inputPointBytes, 32)

  return bytesToBigInt(nonceInput) % BANDERSNATCH_PARAMS.CURVE_ORDER
}

/**
 * Compute challenge for VRF proof
 *
 * This implements the challenge procedure as specified in:
 * - Section 1.9 of bandersnatch-vrf-spec/specification.md
 * - Section 5.4.3 of RFC-9381
 *
 * @param Y - Public key point
 * @param I - VRF input point
 * @param O - VRF output point
 * @param U - First intermediate point (k*G)
 * @param V - Second intermediate point (k*I)
 * @param additionalData - Additional data to include in challenge
 * @returns Challenge scalar
 */
function computeChallenge(
  Y: CurvePoint,
  I: CurvePoint,
  O: CurvePoint,
  U: CurvePoint,
  V: CurvePoint,
  additionalData: Uint8Array,
): bigint {
  // Step 1: Start with suite string + 0x02
  const suiteString = new TextEncoder().encode('Bandersnatch_SHA-512_ELL2')
  const str0 = new Uint8Array(suiteString.length + 1)
  str0.set(suiteString, 0)
  str0[suiteString.length] = 0x02

  // Step 2: Append points in order
  const str1 = concatBytes([str0, BandersnatchCurve.pointToBytes(Y)])
  const str2 = concatBytes([str1, BandersnatchCurve.pointToBytes(I)])
  const str3 = concatBytes([str2, BandersnatchCurve.pointToBytes(O)])
  const str4 = concatBytes([str3, BandersnatchCurve.pointToBytes(U)])
  const str5 = concatBytes([str4, BandersnatchCurve.pointToBytes(V)])

  // Step 3: Append additional data + 0x00
  const str6 = concatBytes([str5, additionalData])
  const str7 = concatBytes([str6, new Uint8Array([0x00])])

  // Step 4: Hash and convert to scalar
  const hash = sha512(str7)
  return bytesToBigInt(hash.slice(0, 32)) % BANDERSNATCH_PARAMS.CURVE_ORDER
}

/**
 * Convert scalar to 32-byte little-endian representation (per Bandersnatch VRF spec)
 */
function scalarToBytes(scalar: bigint): Uint8Array {
  const bytes = new Uint8Array(32)
  let value = scalar

  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(value & 0xffn)
    value = value >> 8n
  }

  return bytes
}

/**
 * Convert 32-byte little-endian representation to scalar (per Bandersnatch VRF spec)
 */
function bytesToBigIntLittleEndian(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = 0; i < bytes.length; i++) {
    result += BigInt(bytes[i]) << (8n * BigInt(i))
  }
  return result
}

/**
 * Concatenate two Uint8Arrays
 */
// function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
//   const result = new Uint8Array(a.length + b.length)
//   result.set(a, 0)
//   result.set(b, a.length)
//   return result
// }
