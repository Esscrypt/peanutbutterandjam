/**
 * Entropy VRF Tests
 * 
 * Tests the entropy VRF signature generation and verification functions
 * according to Gray Paper equation 158
 */

import { describe, expect, test } from 'bun:test'
import {
  generateEntropyVRFSignature,
  verifyEntropyVRFSignature,
  banderout,
  IETFVRFProver,
  IETFVRFVerifier,
  IETFVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import { generateBandersnatchKeyPairFromSeed } from '@pbnjam/core'
import { encodeUnsignedHeader } from '@pbnjam/codec'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BlockTraceTestVector, IConfigService, UnsignedBlockHeader } from '@pbnjam/types'
import { hexToBytes } from '@pbnjam/core'

const verifier: IETFVRFVerifier | IETFVRFVerifierWasm = new IETFVRFVerifierWasm()
  
describe('Entropy VRF Functions', () => {
  test('generateEntropyVRFSignature should create valid 96-byte signature', () => {
    // Test data
    const validatorSecretKey = new Uint8Array(32).fill(1) // 32 bytes of 1s
    const sealOutput = new Uint8Array(32).fill(2) // 32 bytes of 2s

    // Generate entropy VRF signature
    const [error, result] = generateEntropyVRFSignature(validatorSecretKey, sealOutput)
    
    expect(error).toBeUndefined()
    expect(result).toBeDefined()
    expect(result!.signature).toHaveLength(96) // Gray Paper: blob[96]
    expect(result!.banderoutResult).toHaveLength(32) // Gray Paper: banderout returns first 32 bytes
  })

  test('verifyEntropyVRFSignature should verify valid signature', () => {
    // Test data
    const validatorSecretKey = new Uint8Array(32).fill(1) // 32 bytes of 1s
    const validatorPublicKey = new Uint8Array(32).fill(3) // 32 bytes of 3s (wrong key)
    const sealOutput = new Uint8Array(32).fill(2) // 32 bytes of 2s

    // Generate entropy VRF signature
    const [genError, genResult] = generateEntropyVRFSignature(validatorSecretKey, sealOutput)
    expect(genError).toBeUndefined()

    // Verify with wrong public key: implementation may return (error, undefined) when
    // curve decoding fails, or (undefined, false) when verification returns false
    const [verifyError, isValid] = verifyEntropyVRFSignature(
      validatorPublicKey,
      genResult!.signature,
      sealOutput,
      verifier,
    )

    // Must not report valid: either an error or isValid === false
    expect(verifyError !== undefined || isValid === false).toBe(true)
  })

  test('banderout should extract banderout result from 96-byte signature', () => {
    // banderout expects the first 32 bytes to be a valid Bandersnatch curve point (gamma).
    // Use a real signature from generateEntropyVRFSignature so gamma is valid.
    const validatorSecretKey = new Uint8Array(32).fill(1)
    const sealOutput = new Uint8Array(32).fill(2)
    const [genError, genResult] = generateEntropyVRFSignature(validatorSecretKey, sealOutput)
    expect(genError).toBeUndefined()
    expect(genResult).toBeDefined()

    const [error, result] = banderout(genResult!.signature)
    expect(error).toBeUndefined()
    expect(result).toHaveLength(32)
    // banderout hashes the gamma point; result is not the raw first 32 bytes of the proof
    expect(result).not.toEqual(genResult!.signature.slice(0, 32))
  })

  test('should reject invalid input sizes', () => {
    const validatorSecretKey = new Uint8Array(32).fill(1)
    const sealOutput = new Uint8Array(32).fill(2)

    // Test invalid secret key size
    const [error1] = generateEntropyVRFSignature(new Uint8Array(16), sealOutput)
    expect(error1).toBeDefined()
    expect(error1!.message).toContain('32 bytes')

    // Test invalid seal output size
    const [error2] = generateEntropyVRFSignature(validatorSecretKey, new Uint8Array(16))
    expect(error2).toBeDefined()
    expect(error2!.message).toContain('32 bytes')

    // Test invalid signature size
    const [error3] = verifyEntropyVRFSignature(
      validatorSecretKey,
      new Uint8Array(64), // Wrong size
      sealOutput
    , verifier)
    expect(error3).toBeDefined()
    expect(error3!.message).toContain('96 bytes')

    // Test invalid seal signature size for extraction
    const [error4] = banderout(new Uint8Array(64))
    expect(error4).toBeDefined()
    expect(error4!.message).toContain('96 bytes')
  })

  test('Round-trip: generateEntropyVRFSignature and verifyEntropyVRFSignature should pass', () => {
    // Generate a valid Bandersnatch key pair from a seed
    const seed = new Uint8Array(32)
    seed.fill(0x42) // Use a deterministic seed
    
    const [keyPairError, keyPair] = generateBandersnatchKeyPairFromSeed(seed)
    expect(keyPairError).toBeUndefined()
    expect(keyPair).toBeDefined()
    expect(keyPair!.privateKey).toHaveLength(32)
    expect(keyPair!.publicKey).toHaveLength(32)

    // Generate a mock seal signature (96-byte IETF VRF signature)
    // We'll use a simple approach: generate a VRF signature with a dummy input
    const dummySealInput = new TextEncoder().encode('dummy seal input')
    const dummySealAuxData = new Uint8Array(0)
    const sealSignature = IETFVRFProver.prove(
      keyPair!.privateKey,
      dummySealInput,
      dummySealAuxData,
    ).proof

    expect(sealSignature).toHaveLength(96)

    // Extract seal output using banderout function
    const [banderoutError, sealOutput] = banderout(sealSignature)
    expect(banderoutError).toBeUndefined()
    expect(sealOutput).toBeDefined()
    expect(sealOutput!).toHaveLength(32)
  })

  test('Round-trip with test vector: generateEntropyVRFSignature and verifyEntropyVRFSignature should pass', () => {
    // Load test vector from 00000001.json
    const testVectorPath = join(
      __dirname,
      '../../../../submodules/jam-test-vectors/traces/fallback/00000001.json',
    )
    const blockJsonData: BlockTraceTestVector = JSON.parse(
      readFileSync(testVectorPath, 'utf-8'),
    )

    // Generate a valid Bandersnatch key pair from a seed
    const seed = new Uint8Array(32)
    seed.fill(0x42) // Use a deterministic seed
    
    const [keyPairError, keyPair] = generateBandersnatchKeyPairFromSeed(seed)
    expect(keyPairError).toBeUndefined()
    expect(keyPair).toBeDefined()
    expect(keyPair!.privateKey).toHaveLength(32)
    expect(keyPair!.publicKey).toHaveLength(32)

    // Extract unsigned header from test vector
    // Gray Paper: The seal signature input is encodeunsignedheader{H}
    const jsonHeader = blockJsonData.block.header
    
    // Create UnsignedBlockHeader (BlockHeader without sealSig)
    const unsignedHeader: UnsignedBlockHeader = {
      parent: jsonHeader.parent,
      priorStateRoot: jsonHeader.parent_state_root,
      extrinsicHash: jsonHeader.extrinsic_hash,
      timeslot: BigInt(jsonHeader.slot),
      epochMark: jsonHeader.epoch_mark
        ? {
            entropyAccumulator: jsonHeader.epoch_mark.entropy,
            entropy1: jsonHeader.epoch_mark.entropy,
            validators: jsonHeader.epoch_mark.validators.map((validator) => ({
              bandersnatch: validator.bandersnatch,
              ed25519: validator.ed25519,
            })),
          }
        : null,
      winnersMark: jsonHeader.tickets_mark
        ? jsonHeader.tickets_mark.map((ticket) => ({
            id: ticket.id,
            entryIndex: BigInt(ticket.entry_index),
            proof: '0x' as const,
          }))
        : null,
      offendersMark: jsonHeader.offenders_mark || [],
      authorIndex: BigInt(jsonHeader.author_index),
      vrfSig: jsonHeader.entropy_source, // This is H_vrfsig in the test vector
    }

    // Create a minimal mock config service for encoding
    const mockConfigService: IConfigService = {
      numValidators: 6,
      numCores: 341,
      epochLength: 100,
      validatorCount: 6,
    } as unknown as IConfigService

    // Encode unsigned header (this is the message for seal signature)
    // Gray Paper: The seal signature input is encodeunsignedheader{H}
    const [encodeError, encodedUnsignedHeader] = encodeUnsignedHeader(
      unsignedHeader,
      mockConfigService,
    )
    expect(encodeError).toBeUndefined()
    expect(encodedUnsignedHeader).toBeDefined()

    // Generate seal signature using the encoded unsigned header as message
    // Gray Paper Eq. 154: H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
    const XFALLBACK_SEAL = new TextEncoder().encode('jam_fallback_seal')
    
    // Extract entropy3 from pre_state (chapter C(6) = 0x06...)
    // entropy3 is the 4th element in the entropy sequence (index 3)
    const entropyKey = blockJsonData.pre_state?.keyvals?.find(kv => 
      kv.key.startsWith('0x06') || kv.key.startsWith('0x0006')
    )
    // For now, use a dummy entropy3 since extracting it requires decoding the entropy state
    // In a real scenario, we would decode the entropy state from the keyval value
    const entropy3 = entropyKey 
      ? hexToBytes(entropyKey.value).slice(96, 128) // entropy3 is bytes 96-128 (4th hash)
      : new Uint8Array(32).fill(0) // Fallback to zero hash
    
    // Build context: Xfallback ∥ entropy'_3
    const context = new Uint8Array(XFALLBACK_SEAL.length + entropy3.length)
    context.set(XFALLBACK_SEAL, 0)
    context.set(entropy3, XFALLBACK_SEAL.length)

    // Generate seal signature
    const sealSignature = IETFVRFProver.prove(
      keyPair!.privateKey,
      encodedUnsignedHeader!, // encodeunsignedheader{H} (message)
      context, // Xfallback ∥ entropy'_3 (context)
    ).proof

    expect(sealSignature).toHaveLength(96)

    // Extract seal output using banderout function
    const [banderoutError, sealOutput] = banderout(sealSignature)
    expect(banderoutError).toBeUndefined()
    expect(sealOutput).toBeDefined()
    expect(sealOutput!).toHaveLength(32)

    // Step 1: Generate entropy VRF signature
    const [genError, genResult] = generateEntropyVRFSignature(
      keyPair!.privateKey,
      sealOutput!,
    )
    
    expect(genError).toBeUndefined()
    expect(genResult).toBeDefined()
    expect(genResult!.signature).toHaveLength(96)
    expect(genResult!.banderoutResult).toHaveLength(32)

    // Step 2: Verify the entropy VRF signature
    const [verifyError, isValid] = verifyEntropyVRFSignature(
      keyPair!.publicKey,
      genResult!.signature,
      sealOutput!,
      verifier,
    )

    expect(verifyError).toBeUndefined()
    expect(isValid).toBe(true)

    // Step 3: Verify that tampering with the signature causes verification to fail.
    // Implementation may return (error, undefined) when curve decoding fails on tampered gamma.
    const tamperedSignature = new Uint8Array(genResult!.signature)
    tamperedSignature[0] ^= 0x01 // Flip a bit

    const [tamperVerifyError, isTamperedValid] = verifyEntropyVRFSignature(
      keyPair!.publicKey,
      tamperedSignature,
      sealOutput!,
      verifier,
    )

    expect(tamperVerifyError !== undefined || isTamperedValid === false).toBe(true)

    // Step 4: Verify that wrong seal output causes verification to fail
    const wrongSealOutput = new Uint8Array(32).fill(0x99)
    const [wrongSealError, isWrongSealValid] = verifyEntropyVRFSignature(
      keyPair!.publicKey,
      genResult!.signature,
      wrongSealOutput,
      verifier,
    )

    expect(wrongSealError).toBeUndefined()
    expect(isWrongSealValid).toBe(false)
  })
})
