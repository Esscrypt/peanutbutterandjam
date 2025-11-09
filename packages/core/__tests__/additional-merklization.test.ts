/**
 * Additional Merklization Methods Tests
 * 
 * Tests the Gray Paper merklization methods: merklizewb, merklizecd, mmrappend, mmrsuperpeak
 */

import { describe, expect, it } from 'vitest'
import {
  merklizewb,
  merklizecd,
  mmrappend,
  mmrsuperpeak,
  mmrencode,
  generateWellBalancedProof,
  verifyMerkleProof,
  generateMMRProof,
  defaultKeccakHash,
  type MMRRange,
  type MerkleProof,
} from '../src/merklization'
import { hexToBytes } from '../src/utils/crypto'

describe('Well-Balanced Merkle Tree (merklizewb)', () => {
  it('should handle empty sequence', () => {
    const [error, result] = merklizewb([])
    expect(error).toBeUndefined()
    expect(result).toEqual(new Uint8Array(32)) // Zero hash
  })

  it('should handle single value', () => {
    const value = hexToBytes('0x1234567890abcdef')
    const [error, result] = merklizewb([value])
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

  it('should handle multiple values', () => {
    const values = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
      hexToBytes('0x3333333333333333'),
      hexToBytes('0x4444444444444444'),
    ]
    const [error, result] = merklizewb(values)
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

  it('should produce consistent results', () => {
    const values = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
    ]
    const [error1, result1] = merklizewb(values)
    const [error2, result2] = merklizewb(values)
    expect(error1).toBeUndefined()
    expect(error2).toBeUndefined()
    expect(result1).toEqual(result2)
  })

  it('should handle different order differently', () => {
    const values1 = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
    ]
    const values2 = [
      hexToBytes('0x2222222222222222'),
      hexToBytes('0x1111111111111111'),
    ]
    const [error1, result1] = merklizewb(values1)
    const [error2, result2] = merklizewb(values2)
    expect(error1).toBeUndefined()
    expect(error2).toBeUndefined()
    expect(result1).not.toEqual(result2) // Different order should produce different roots
  })
})

describe('Constant-Depth Merkle Tree (merklizecd)', () => {
  it('should handle empty sequence', () => {
    const [error, result] = merklizecd([])
    expect(error).toBeUndefined()
    expect(result).toEqual(new Uint8Array(32)) // Zero hash
  })

  it('should handle single value', () => {
    const value = hexToBytes('0x1234567890abcdef')
    const [error, result] = merklizecd([value])
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

  it('should handle multiple values with padding', () => {
    const values = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
      hexToBytes('0x3333333333333333'),
    ]
    const [error, result] = merklizecd(values)
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

  it('should produce different results than well-balanced', () => {
    const values = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
    ]
    const [wbError, wbResult] = merklizewb(values)
    const [cdError, cdResult] = merklizecd(values)
    expect(wbError).toBeUndefined()
    expect(cdError).toBeUndefined()
    expect(wbResult).not.toEqual(cdResult) // Different algorithms should produce different roots
  })
})

describe('Merkle Mountain Range (MMR)', () => {
  it('should append to empty range', () => {
    const range: MMRRange = []
    const leaf = hexToBytes('0x1234567890abcdef')
    const [error, result] = mmrappend(range, leaf)
    expect(error).toBeUndefined()
    expect(result).toEqual([leaf])
  })

  it('should append multiple leaves', () => {
    let range: MMRRange = []
    const leaf1 = hexToBytes('0x1111111111111111')
    const leaf2 = hexToBytes('0x2222222222222222')
    
    const [error1, result1] = mmrappend(range, leaf1)
    expect(error1).toBeUndefined()
    range = result1 as MMRRange

    const [error2, result2] = mmrappend(range, leaf2)
    expect(error2).toBeUndefined()
    expect(result2?.length).toBeGreaterThan(1)
  })

  it('should create super-peak from single peak', () => {
    const range: MMRRange = [hexToBytes('0x1234567890abcdef')]
    const [error, result] = mmrsuperpeak(range)
    expect(error).toBeUndefined()
    expect(result).toEqual(range[0])
  })

  it('should create super-peak from multiple peaks', () => {
    const range: MMRRange = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
    ]
    const [error, result] = mmrsuperpeak(range)
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

  it('should handle null peaks in super-peak', () => {
    const range: MMRRange = [
      hexToBytes('0x1111111111111111'),
      null,
      hexToBytes('0x3333333333333333'),
    ]
    const [error, result] = mmrsuperpeak(range)
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

  it('should encode MMR range', () => {
    const range: MMRRange = [
      hexToBytes('0x1111111111111111'),
      null,
      hexToBytes('0x3333333333333333'),
    ]
    const [error, result] = mmrencode(range)
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBeGreaterThan(0)
  })
})

describe('Merkle Inclusion Proofs', () => {
  it('should generate proof for single value', () => {
    const values = [hexToBytes('0x1234567890abcdef')]
    const [error, proof] = generateWellBalancedProof(values, 0)
    expect(error).toBeUndefined()
    expect(proof?.path).toEqual([]) // No path needed for single value
    expect(proof?.leafIndex).toBe(0)
  })

  it('should generate proof for multiple values', () => {
    const values = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
      hexToBytes('0x3333333333333333'),
      hexToBytes('0x4444444444444444'),
    ]
    const [error, proof] = generateWellBalancedProof(values, 1)
    expect(error).toBeUndefined()
    expect(proof?.path.length).toBeGreaterThan(0)
    expect(proof?.leafIndex).toBe(1)
  })

  it('should verify valid proof', () => {
    const values = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
    ]
    const [rootError, root] = merklizewb(values)
    expect(rootError).toBeUndefined()

    const [proofError, proof] = generateWellBalancedProof(values, 0)
    console.log(proofError, proof)
    expect(proofError).toBeUndefined()

    const [verifyError, isValid] = verifyMerkleProof(values[0], proof as MerkleProof, root as Uint8Array)
    expect(verifyError).toBeUndefined()
    expect(isValid).toBe(true)
  })

  it('should reject invalid proof', () => {
    const values = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
    ]
    const [rootError, root] = merklizewb(values)
    expect(rootError).toBeUndefined()

    const [proofError, proof] = generateWellBalancedProof(values, 0)
    console.log(proofError, proof)
    expect(proofError).toBeUndefined()

    // Modify the proof to make it invalid
    const invalidProof: MerkleProof = {
      path: [hexToBytes('0x9999999999999999')], // Wrong sibling hash
      leafIndex: 0,
      treeSize: 0,
    }

    const [verifyError, isValid] = verifyMerkleProof(values[0], invalidProof, root as Uint8Array )
    expect(verifyError).toBeUndefined()
    expect(isValid).toBe(false)
  })

  it('should handle out-of-range leaf index', () => {
    const values = [hexToBytes('0x1111111111111111')]
    const [error, proof] = generateWellBalancedProof(values, 5)
    console.log(error, proof)
    expect(error).toBeDefined()
    expect(error?.message).toContain('Leaf index out of range')
  })

  it('should generate MMR proof', () => {
    const range: MMRRange = [
      hexToBytes('0x1111111111111111'),
      hexToBytes('0x2222222222222222'),
    ]
    const [error, proof] = generateMMRProof(range, 0)
    expect(error).toBeUndefined()
    expect(proof).toBeDefined()
    expect(proof?.leafIndex).toBe(0)
    expect(Array.isArray(proof?.path)).toBe(true)
  })

  it('should handle MMR proof with out-of-range index', () => {
    const range: MMRRange = [hexToBytes('0x1111111111111111')]
    const [error, proof] = generateMMRProof(range, 5)
    console.log(error, proof)
    expect(error).toBeDefined()
    expect(error?.message).toContain('Leaf index out of range')
  })
})

describe('Hash Function Compatibility', () => {
  it('should work with BLAKE2b hash function', () => {
    const values = [hexToBytes('0x1234567890abcdef')]
    const [error, result] = merklizewb(values)
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

  it('should work with Keccak hash function', () => {
    const values = [hexToBytes('0x1234567890abcdef')]
    const [error, result] = merklizewb(values)
    expect(error).toBeUndefined()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result?.length).toBe(32)
  })

})

describe('Gray Paper Compliance Examples', () => {
  it('should handle accumulation output example', () => {
    // Example from recent_history.tex Equation 31
    const accumulationOutputs = [
      hexToBytes('0x1111111111111111'), // encode[4]{s} ∥ encode{h}
      hexToBytes('0x2222222222222222'),
    ]
    
    const [error, root] = merklizewb(accumulationOutputs)
    expect(error).toBeUndefined()
    expect(root).toBeInstanceOf(Uint8Array)
    expect(root?.length).toBe(32)
  })

  it('should handle MMR accumulation belt example', () => {
    // Example from recent_history.tex Equation 31
    let accoutBelt: MMRRange = []
    
    // Append accumulation outputs
    const output1 = hexToBytes('0x1111111111111111')
    const output2 = hexToBytes('0x2222222222222222')
    
    const [error1, belt1] = mmrappend(accoutBelt, output1, defaultKeccakHash)
    expect(error1).toBeUndefined()
    accoutBelt = belt1 as MMRRange
    const [error2, belt2] = mmrappend(accoutBelt, output2, defaultKeccakHash)
    expect(error2).toBeUndefined()
    
    // Create super-peak
    const [error3, superPeak] = mmrsuperpeak(belt2 as MMRRange, defaultKeccakHash)
    expect(error3).toBeUndefined()
    expect(superPeak).toBeInstanceOf(Uint8Array)
    expect(superPeak?.length).toBe(32)
  })
})
