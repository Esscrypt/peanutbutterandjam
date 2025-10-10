/**
 * Pedersen VRF Test Vectors from ark-vrf
 * 
 * These test vectors are derived from the official ark-vrf implementation
 * and are designed to validate our Pedersen VRF implementation against
 * the reference Rust implementation.
 */

import { describe, expect, test } from 'vitest'
import { PedersenVRFProver } from '../prover/pedersen'
import { bytesToHex, hexToBytes } from '@pbnj/core'

// Test vectors from submodules/ark-vrf/data/vectors/bandersnatch_sha-512_ell2_pedersen.json
const PEDERSEN_TEST_VECTORS = [
  {
    comment: "bandersnatch_sha-512_ell2_pedersen - vector-1",
    sk: "3d6406500d4009fdf2604546093665911e753f2213570a29521fd88bc30ede18",
    pk: "a1b1da71cc4682e159b7da23050d8b6261eb11a3247c89b07ef56ccd002fd38b",
    alpha: "",
    salt: "",
    ad: "",
    h: "c5eaf38334836d4b10e05d2c1021959a917e08eaf4eb46a8c4c8d1bec04e2c00",
    gamma: "e7aa5154103450f0a0525a36a441f827296ee489ef30ed8787cff8df1bef223f",
    beta: "fdeb377a4ffd7f95ebe48e5b43a88d069ce62188e49493500315ad55ee04d7442b93c4c91d5475370e9380496f4bc0b838c2483bce4e133c6f18b0adbb9e4722",
    blinding: "01371ac62e04d1faaadbebaa686aaf122143e2cda23aacbaa4796d206779a501",
    proof_pk_com: "3b21abd58807bb6d93797001adaacd7113ec320dcf32d1226494e18a57931fc4",
    proof_r: "8123054bfdb6918e0aa25c3337e6509eea262282fd26853bf7cd6db234583f5e",
    proof_ok: "ac57ce6a53a887fc59b6aa73d8ff0e718b49bd9407a627ae0e9b9e7c5d0d175b",
    proof_s: "0d379b65fb1e6b2adcbf80618c08e31fd526f06c2defa159158f5de146104c0f",
    proof_sb: "e2ca83136143e0cac3f7ee863edd3879ed753b995b1ff8d58305d3b1f323630b"
  },
  {
    comment: "bandersnatch_sha-512_ell2_pedersen - vector-2",
    sk: "8b9063872331dda4c3c282f7d813fb3c13e7339b7dc9635fdc764e32cc57cb15",
    pk: "5ebfe047f421e1a3e1d9bbb163839812657bbb3e4ffe9856a725b2b405844cf3",
    alpha: "0a",
    salt: "",
    ad: "",
    h: "8c1d1425374f01d86b23bfeab770c60b58d2eeb9afc5900c8b8a918d09a6086b",
    gamma: "60f32f5ad3e9694b82ccc0a735edb2f940f757ab333cc5f7b0a41158b80f574f",
    beta: "44f3728bc5ad550aeeb89f8db340b2fceffc946be3e2d8c5d99b47c1fce344b3c7fcee223a9b29a64fe4a86a9994784bc165bb0fba03ca0a493f75bee89a0946",
    blinding: "99ff52abf49d67c4303ac4a8a00984d04c06388f5f836ebd37031f0e76245815",
    proof_pk_com: "c1322e7a65b83996c25e37a84e36598333b0d417619242c0cb3d9d972edde848",
    proof_r: "7a4363e0bf9cd18317287d681ab05704982b0088ce373f696dbdf3909a902b36",
    proof_ok: "fc8770c209212640742d53e2f40e5c30fffae574f90fdc670ff11a1127586c03",
    proof_s: "93f7c9d73eec05e500b758f645a2967e62b2206e57eff5f9b99bfc71812e620d",
    proof_sb: "c864de36e0b428f6fb4ef470f94ec9601716cb26ad96f3359e4a1ec110794a0b"
  },
  {
    comment: "bandersnatch_sha-512_ell2_pedersen - vector-3",
    sk: "6db187202f69e627e432296ae1d0f166ae6ac3c1222585b6ceae80ea07670b14",
    pk: "9d97151298a5339866ddd3539d16696e19e6b68ac731562c807fe63a1ca49506",
    alpha: "",
    salt: "",
    ad: "0b8c",
    h: "c5eaf38334836d4b10e05d2c1021959a917e08eaf4eb46a8c4c8d1bec04e2c00",
    gamma: "67a348e256d908eb695d15ee0d869efef2bcf9f0fea646e788f967abbc0464dd",
    beta: "edde0178045133eb03ef4d1ad8b978a56ee80ec4eab8830d6bc6c080031388416657d3c449d9398cc4385d1c8a2bb19bcf61ff086e5a6c477a0302ce270d1abf",
    blinding: "e22ec3e4a2a4132237eb8a62bcc5ed864593cfde08e53b1632ecd3245761c808",
    proof_pk_com: "54c04f259f9e40ee086031d29960b12b6b6407e9de14985001c7265587941831",
    proof_r: "9200b650a0c20b0ef73ccd7651ffc7af154e5e02879dc8666025c245aa547f01",
    proof_ok: "35f8dc0f744d1850513c46b6b4640716cbb4643da26cfe67f8c701486e0b4cae",
    proof_s: "5faa89369589174f4202d6e53e8b4ef10a49b2ad8face60d7cb28bfc8f43bf0e",
    proof_sb: "017093ff8d22ba2f3852141365a1452fbb5ab8cf6f20cb04555e3163f8d88f13"
  },
  {
    comment: "bandersnatch_sha-512_ell2_pedersen - vector-4",
    sk: "b56cc204f1b6c2323709012cb16c72f3021035ce935fbe69b600a88d842c7407",
    pk: "dc2de7312c2850a9f6c103289c64fbd76e2ebd2fa8b5734708eb2c76c0fb2d99",
    alpha: "73616d706c65",
    salt: "",
    ad: "",
    h: "672e8c7a8e6d3eca67df38f11d50f3d7dbb26fa8e27565a5424e6f8ac4555dcc",
    gamma: "4d3e0524fc59374f1fdad8e471c695469b45ecf69c1de85c6c1230e888dd4cbe",
    beta: "36127f8aee7c61048984f0a208bf6d334db9dacbeeeef9ff2d17117e812328321462eb3ef602f5911d77ab11f815eb4154ba95c934e414198ef000a61b4de31a",
    blinding: "755610da34cc224fbe60ce5e42add2ea6b272ef466aef18c13497363116d1c03",
    proof_pk_com: "d26274e014ebfc19a9c1a951193858b972eae3360ed35635e89f1f9dbe432be5",
    proof_r: "26202144ba4c4cb7ecde831c9e9662bec519493b29a098dd5803a8b4d261fc12",
    proof_ok: "b9fa51c75d278d95f2ccace9609b28ec137b244c8b7d1523b16ed07c8e24b8e4",
    proof_s: "e42423127a2ca12d4f199287c8fa07784eacf9fc9b86a6bd56ee364cc352c009",
    proof_sb: "5371d6f9c76b560b4e42b9154a395bed60924d8de31284e926d06af382f5ad1b"
  }
] as const

describe('Pedersen VRF Test Vector Validation', () => {
  PEDERSEN_TEST_VECTORS.forEach((vector, index) => {
    test(`Test Vector ${index + 1}: ${vector.comment}`, () => {
      console.log(`\n=== Testing Pedersen Vector ${index + 1}: ${vector.comment} ===`)
      
      // Convert hex strings to bytes
      const privateKey = hexToBytes(`0x${vector.sk}`)
      const alpha = hexToBytes(vector.alpha ? `0x${vector.alpha}` : '0x')
      const additionalData = hexToBytes(vector.ad ? `0x${vector.ad}` : '0x')
      
      console.log('Input data:')
      console.log(`  Private Key: ${vector.sk}`)
      console.log(`  Public Key: ${vector.pk}`)
      console.log(`  Blinding Factor: ${vector.blinding}`)
      console.log(`  Alpha (message): ${vector.alpha || '(empty)'}`)
      console.log(`  Additional Data: ${vector.ad || '(empty)'}`)
      
      // Test our Pedersen VRF implementation
      try {
        const vrfResult = PedersenVRFProver.prove(
          privateKey,
          { input: alpha, auxData: additionalData }
        )
        
        console.log('\nOur implementation results:')
        console.log(`  Output Point (gamma): ${bytesToHex(vrfResult.gamma)}`)
        console.log(`  Output Hash (beta): ${bytesToHex(vrfResult.hash)}`)
        console.log(`  Proof Length: ${vrfResult.proof.length}`)
        
        console.log('\nExpected results:')
        console.log(`  Expected h (input point): ${vector.h}`)
        console.log(`  Expected gamma (output point): ${vector.gamma}`)
        console.log(`  Expected beta (output hash): ${vector.beta}`)
        console.log(`  Expected proof_pk_com: ${vector.proof_pk_com}`)
        console.log(`  Expected proof_r: ${vector.proof_r}`)
        console.log(`  Expected proof_ok: ${vector.proof_ok}`)
        console.log(`  Expected proof_s: ${vector.proof_s}`)
        console.log(`  Expected proof_sb: ${vector.proof_sb}`)
        
        // Basic validation that our implementation produces valid structure
        expect(vrfResult).toBeDefined()
        expect(vrfResult.gamma).toBeInstanceOf(Uint8Array)
        expect(vrfResult.hash).toBeInstanceOf(Uint8Array)
        expect(vrfResult.proof).toBeInstanceOf(Uint8Array)
        
        console.log('✅ Basic structure validation passed')
        
        // Parse the Pedersen proof structure
        const deserializedProof = PedersenVRFProver.deserialize(vrfResult.proof)
        
        console.log('\nProof components:')
        console.log(`  Y_bar (pk commitment): ${bytesToHex(deserializedProof.Y_bar)}`)
        console.log(`  R (commitment): ${bytesToHex(deserializedProof.R)}`)
        console.log(`  O_k (output commitment): ${bytesToHex(deserializedProof.O_k)}`)
        console.log(`  s (proof scalar): ${bytesToHex(deserializedProof.s)}`)
        console.log(`  s_b (blinding scalar): ${bytesToHex(deserializedProof.s_b)}`)
        
        // Validate actual values against expected test vectors
        const ourGammaHex = bytesToHex(vrfResult.gamma).slice(2) // Remove 0x prefix
        const ourBetaHex = bytesToHex(vrfResult.hash).slice(2) // Remove 0x prefix
        const ourYBarHex = bytesToHex(deserializedProof.Y_bar).slice(2)
        const ourRHex = bytesToHex(deserializedProof.R).slice(2)
        const ourOkHex = bytesToHex(deserializedProof.O_k).slice(2)
        const ourSHex = bytesToHex(deserializedProof.s).slice(2)
        const ourSbHex = bytesToHex(deserializedProof.s_b).slice(2)
        
        console.log('\nValue comparison:')
        console.log(`  Gamma match: ${ourGammaHex === vector.gamma}`)
        console.log(`  Beta match: ${ourBetaHex === vector.beta}`)
        console.log(`  Y_bar match: ${ourYBarHex === vector.proof_pk_com}`)
        console.log(`  R match: ${ourRHex === vector.proof_r}`)
        console.log(`  O_k match: ${ourOkHex === vector.proof_ok}`)
        console.log(`  s match: ${ourSHex === vector.proof_s}`)
        console.log(`  s_b match: ${ourSbHex === vector.proof_sb}`)
        
        // Assert exact value matches with ark-vrf test vectors
        expect(ourGammaHex).toBe(vector.gamma)
        expect(ourBetaHex).toBe(vector.beta)
        expect(ourYBarHex).toBe(vector.proof_pk_com)
        expect(ourRHex).toBe(vector.proof_r)
        expect(ourOkHex).toBe(vector.proof_ok)
        expect(ourSHex).toBe(vector.proof_s)
        expect(ourSbHex).toBe(vector.proof_sb)
        
      } catch (error) {
        console.error(`Pedersen VRF implementation failed for ${vector.comment}:`, error)
        throw error // Re-throw to fail the test
      }
    })
  })
})
