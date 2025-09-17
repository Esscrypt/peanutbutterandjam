/**
 * Test Vector Parser for ark-vrf Test Vectors
 * 
 * Parses JSON test vectors from ark-vrf/data/vectors/ and provides
 * structured access to test data for comprehensive unit testing.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

export interface IETFTestVector {
  comment: string
  sk: string
  pk: string
  alpha: string
  salt: string
  ad: string
  h: string
  gamma: string
  beta: string
  proof_c: string
  proof_s: string
}

export interface PedersenTestVector {
  comment: string
  sk: string
  pk: string
  alpha: string
  salt: string
  ad: string
  h: string
  gamma: string
  beta: string
  blinding: string
  proof_pk_com: string
  proof_r: string
  proof_ok: string
  proof_s: string
  proof_sb: string
}

export interface RingTestVector {
  comment: string
  sk: string
  pk: string
  alpha: string
  salt: string
  ad: string
  h: string
  gamma: string
  beta: string
  blinding: string
  proof_pk_com: string
  proof_r: string
  proof_ok: string
  proof_s: string
  proof_sb: string
  ring_pks: string
  ring_pks_com: string
  ring_proof: string
}

export class TestVectorLoader {
  private static readonly VECTORS_PATH = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/ark-vrf/data/vectors'

  /**
   * Load IETF VRF test vectors for bandersnatch
   */
  static loadIETFVectors(): IETFTestVector[] {
    const filePath = join(this.VECTORS_PATH, 'bandersnatch_sha-512_ell2_ietf.json')
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as IETFTestVector[]
  }

  /**
   * Load Pedersen VRF test vectors for bandersnatch
   */
  static loadPedersenVectors(): PedersenTestVector[] {
    const filePath = join(this.VECTORS_PATH, 'bandersnatch_sha-512_ell2_pedersen.json')
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as PedersenTestVector[]
  }

  /**
   * Load Ring VRF test vectors for bandersnatch
   */
  static loadRingVectors(): RingTestVector[] {
    const filePath = join(this.VECTORS_PATH, 'bandersnatch_sha-512_ell2_ring.json')
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as RingTestVector[]
  }

  /**
   * Load all bandersnatch test vectors
   */
  static loadAllBandersnatchVectors() {
    return {
      ietf: this.loadIETFVectors(),
      pedersen: this.loadPedersenVectors(),
      ring: this.loadRingVectors(),
    }
  }
}

/**
 * Utility functions for working with test vectors
 */
export class TestVectorUtils {
  /**
   * Convert hex string to Uint8Array
   */
  static hexToBytes(hex: string): Uint8Array {
    if (hex === '') return new Uint8Array(0)
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes
  }

  /**
   * Convert Uint8Array to hex string
   */
  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Parse ring public keys from hex string
   * Each public key is 32 bytes (compressed format)
   */
  static parseRingPublicKeys(ringPksHex: string): Uint8Array[] {
    const bytes = this.hexToBytes(ringPksHex)
    const publicKeys: Uint8Array[] = []
    
    for (let i = 0; i < bytes.length; i += 32) {
      publicKeys.push(bytes.slice(i, i + 32))
    }
    
    return publicKeys
  }

  /**
   * Parse ring public key commitments from hex string
   * Each commitment is 48 bytes (BLS12-381 G1 compressed format)
   */
  static parseRingCommitments(ringPksComHex: string): Uint8Array[] {
    const bytes = this.hexToBytes(ringPksComHex)
    const commitments: Uint8Array[] = []
    
    for (let i = 0; i < bytes.length; i += 48) {
      commitments.push(bytes.slice(i, i + 48))
    }
    
    return commitments
  }

  /**
   * Parse ring proof from hex string
   * The ring proof is a variable-length byte string
   */
  static parseRingProof(ringProofHex: string): Uint8Array {
    return this.hexToBytes(ringProofHex)
  }

  /**
   * Validate test vector structure
   */
  static validateIETFVector(vector: IETFTestVector): boolean {
    return !!(
      vector.comment &&
      vector.sk &&
      vector.pk &&
      vector.h &&
      vector.gamma &&
      vector.beta &&
      vector.proof_c &&
      vector.proof_s
    )
  }

  static validatePedersenVector(vector: PedersenTestVector): boolean {
    return !!(
      vector.comment &&
      vector.sk &&
      vector.pk &&
      vector.h &&
      vector.gamma &&
      vector.beta &&
      vector.blinding &&
      vector.proof_pk_com &&
      vector.proof_r &&
      vector.proof_ok &&
      vector.proof_s &&
      vector.proof_sb
    )
  }

  static validateRingVector(vector: RingTestVector): boolean {
    return !!(
      vector.comment &&
      vector.sk &&
      vector.pk &&
      vector.h &&
      vector.gamma &&
      vector.beta &&
      vector.blinding &&
      vector.proof_pk_com &&
      vector.proof_r &&
      vector.proof_ok &&
      vector.proof_s &&
      vector.proof_sb &&
      vector.ring_pks &&
      vector.ring_pks_com &&
      vector.ring_proof
    )
  }
}
