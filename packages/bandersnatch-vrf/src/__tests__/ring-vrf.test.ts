/**
 * Ring VRF Implementation Tests
 * 
 * Tests the Ring VRF implementation with proper KZG commitments
 * for zero-knowledge proofs over polynomial commitments.
 */

import { describe, test, expect } from 'vitest'
import { RingVRF } from '../ring-vrf.js'
import type { RingProofParams, RingProver, RingVerifier, RingVRFProof, RingVRFOutput } from '../ring-vrf.js'
import { BandersnatchCurve, BANDERSNATCH_PARAMS } from '@pbnj/bandersnatch'

describe('Ring VRF Implementation', () => {
  const testSeed = new Uint8Array(32).fill(0x42)
  const ringSize = 4
  let params: RingProofParams
  let ringPublicKeys: Uint8Array[]
  let prover: RingProver
  let verifier: RingVerifier

  test('Create Ring VRF parameters', () => {
    params = RingVRF.createParams(ringSize, testSeed)
    
    expect(params.ringSize).toBe(ringSize)
    expect(params.domainSize).toBeGreaterThanOrEqual(ringSize)
    expect(params.accumulatorBase).toBeDefined()
    expect(params.paddingPoint).toBeDefined()
    expect(params.domainGenerator).toBeDefined()
    expect(params.kzgParams).toBeDefined()
    expect(params.kzgParams.domainSize).toBe(params.domainSize)
  })

  test('Generate ring public keys', () => {
    ringPublicKeys = []
    
    for (let i = 0; i < ringSize; i++) {
      // Generate secret key
      const secretKey = new Uint8Array(32)
      secretKey.fill(i)
      
      // Generate public key
      const secretScalar = BigInt(i + 1) % BANDERSNATCH_PARAMS.CURVE_ORDER
      const publicKey = BandersnatchCurve.scalarMultiply(BANDERSNATCH_PARAMS.GENERATOR, secretScalar)
      const publicKeyBytes = BandersnatchCurve.pointToBytes(publicKey)
      
      ringPublicKeys.push(publicKeyBytes)
    }
    
    expect(ringPublicKeys).toHaveLength(ringSize)
    
    // Verify all public keys are valid
    for (const pkBytes of ringPublicKeys) {
      const pk = BandersnatchCurve.bytesToPoint(pkBytes)
      expect(BandersnatchCurve.isOnCurve(pk)).toBe(true)
    }
  })

  test('Create Ring VRF prover', () => {
    const proverIndex = 1
    const proverSecretKey = new Uint8Array(32)
    proverSecretKey.fill(proverIndex)
    
    prover = RingVRF.createProver(params, ringPublicKeys, proverIndex, proverSecretKey)
    
    expect(prover.ringSize).toBe(ringSize)
    expect(prover.proverIndex).toBe(proverIndex)
    expect(prover.ringPublicKeys).toHaveLength(ringSize)
    expect(prover.proverKey).toBeDefined()
    expect(BandersnatchCurve.isOnCurve(prover.proverKey)).toBe(true)
  })

  test('Create Ring VRF verifier', () => {
    verifier = RingVRF.createVerifier(params, ringPublicKeys)
    
    expect(verifier.ringSize).toBe(ringSize)
    expect(verifier.ringCommitments).toHaveLength(ringSize)
    expect(verifier.verifierKey).toBeDefined()
  })

  test('Generate Ring VRF output', () => {
    const input = new TextEncoder().encode('test input')
    const proverSecretKey = new Uint8Array(32)
    proverSecretKey.fill(prover.proverIndex)
    
    const output = RingVRF.generateOutput(proverSecretKey, input)
    
    expect(output.gamma).toBeDefined()
    expect(output.gamma.isInfinity).toBe(false)
    expect(BandersnatchCurve.isOnCurve(output.gamma)).toBe(true)
    expect(output.hash).toBeDefined()
    expect(output.hash.length).toBe(32)
  })

  test('Prove Ring VRF', () => {
    const input = new TextEncoder().encode('test input')
    const proverSecretKey = new Uint8Array(32)
    proverSecretKey.fill(prover.proverIndex)
    
    const output = RingVRF.generateOutput(proverSecretKey, input)
    const auxData = new TextEncoder().encode('auxiliary data')
    const blindingFactor = new Uint8Array(32).fill(0x13)
    
    const proof = RingVRF.prove(params, prover, input, output, auxData, blindingFactor)
    
    expect(proof.pedersenProof).toBeDefined()
    expect(proof.pedersenProof.keyCommitment).toBeDefined()
    expect(proof.pedersenProof.r).toBeDefined()
    expect(proof.pedersenProof.ok).toBeDefined()
    expect(proof.pedersenProof.s).toBeDefined()
    expect(proof.pedersenProof.sb).toBeDefined()
    
    expect(proof.ringProof).toBeDefined()
    expect(proof.ringProof.commitment).toBeDefined()
    expect(proof.ringProof.point).toBeDefined()
    expect(proof.ringProof.value).toBeDefined()
    expect(proof.ringProof.proof).toBeDefined()
    
    expect(proof.accumulatorProof).toBeDefined()
    expect(proof.accumulatorProof.commitment).toBeDefined()
    expect(proof.accumulatorProof.point).toBeDefined()
    expect(proof.accumulatorProof.value).toBeDefined()
    expect(proof.accumulatorProof.proof).toBeDefined()
  })

  test('Verify Ring VRF proof', () => {
    const input = new TextEncoder().encode('test input')
    const proverSecretKey = new Uint8Array(32)
    proverSecretKey.fill(prover.proverIndex)
    
    const output = RingVRF.generateOutput(proverSecretKey, input)
    const auxData = new TextEncoder().encode('auxiliary data')
    const blindingFactor = new Uint8Array(32).fill(0x13)
    
    const proof = RingVRF.prove(params, prover, input, output, auxData, blindingFactor)
    
    const isValid = RingVRF.verify(params, verifier, input, output, proof, auxData)
    
    expect(isValid).toBe(true)
  })

  test('Ring VRF anonymity', () => {
    // Test that the proof doesn't reveal which ring member created it
    const input = new TextEncoder().encode('test input')
    const auxData = new TextEncoder().encode('auxiliary data')
    const blindingFactor = new Uint8Array(32).fill(0x13)
    
    // Create proofs for different ring members
    const proofs: { output: RingVRFOutput; proof: RingVRFProof }[] = []
    
    for (let i = 0; i < ringSize; i++) {
      const proverSecretKey = new Uint8Array(32)
      proverSecretKey.fill(i)
      
      const prover = RingVRF.createProver(params, ringPublicKeys, i, proverSecretKey)
      const output = RingVRF.generateOutput(proverSecretKey, input)
      const proof = RingVRF.prove(params, prover, input, output, auxData, blindingFactor)
      
      proofs.push({ output, proof })
    }
    
    // All proofs should be valid
    for (const proof of proofs) {
      const isValid = RingVRF.verify(params, verifier, input, proof.output, proof.proof, auxData)
      expect(isValid).toBe(true)
    }
    
    // All proofs should have the same structure (anonymity)
    expect(proofs).toHaveLength(ringSize)
    for (let i = 1; i < proofs.length; i++) {
      expect(proofs[i].proof.pedersenProof).toBeDefined()
      expect(proofs[i].proof.ringProof).toBeDefined()
      expect(proofs[i].proof.accumulatorProof).toBeDefined()
    }
  })

  test('Ring VRF with different inputs', () => {
    const inputs = [
      new TextEncoder().encode('input 1'),
      new TextEncoder().encode('input 2'),
      new TextEncoder().encode('input 3'),
    ]
    
    const auxData = new TextEncoder().encode('auxiliary data')
    const blindingFactor = new Uint8Array(32).fill(0x13)
    
    for (const input of inputs) {
      const proverSecretKey = new Uint8Array(32)
      proverSecretKey.fill(prover.proverIndex)
      
      const output = RingVRF.generateOutput(proverSecretKey, input)
      const proof = RingVRF.prove(params, prover, input, output, auxData, blindingFactor)
      
      const isValid = RingVRF.verify(params, verifier, input, output, proof, auxData)
      expect(isValid).toBe(true)
    }
  })

  test('Ring VRF with different ring sizes', () => {
    const ringSizes = [2, 4, 8, 16]
    
    for (const size of ringSizes) {
      const params = RingVRF.createParams(size, testSeed)
      const ringPublicKeys: Uint8Array[] = []
      
      // Generate public keys for this ring size
      for (let i = 0; i < size; i++) {
        const secretScalar = BigInt(i + 1) % BANDERSNATCH_PARAMS.CURVE_ORDER
        const publicKey = BandersnatchCurve.scalarMultiply(BANDERSNATCH_PARAMS.GENERATOR, secretScalar)
        const publicKeyBytes = BandersnatchCurve.pointToBytes(publicKey)
        ringPublicKeys.push(publicKeyBytes)
      }
      
      const proverIndex = Math.floor(size / 2)
      const proverSecretKey = new Uint8Array(32)
      proverSecretKey.fill(proverIndex)
      
      const prover = RingVRF.createProver(params, ringPublicKeys, proverIndex, proverSecretKey)
      const verifier = RingVRF.createVerifier(params, ringPublicKeys)
      
      const input = new TextEncoder().encode(`test input for ring size ${size}`)
      const output = RingVRF.generateOutput(proverSecretKey, input)
      const proof = RingVRF.prove(params, prover, input, output)
      
      const isValid = RingVRF.verify(params, verifier, input, output, proof)
      expect(isValid).toBe(true)
    }
  })
})
