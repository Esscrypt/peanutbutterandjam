/**
 * Algorithm Types
 *
 * Types for erasure coding algorithms
 */

import type { FieldElement, Polynomial } from '../types'

/**
 * Finite field operations interface
 */
export interface FiniteField {
  /** Add two field elements */
  add(a: FieldElement, b: FieldElement): FieldElement
  /** Multiply two field elements */
  multiply(a: FieldElement, b: FieldElement): FieldElement
  /** Divide two field elements */
  divide(a: FieldElement, b: FieldElement): FieldElement
  /** Get multiplicative inverse */
  inverse(a: FieldElement): FieldElement
  /** Exponentiate field element */
  power(a: FieldElement, exponent: number): FieldElement
  /** Get field generator */
  getGenerator(): FieldElement
  /** Get field size */
  getSize(): number
}

/**
 * Polynomial operations interface
 */
export interface PolynomialOperations {
  /** Add two polynomials */
  add(a: Polynomial, b: Polynomial): Polynomial
  /** Multiply two polynomials */
  multiply(a: Polynomial, b: Polynomial): Polynomial
  /** Divide two polynomials */
  divide(
    a: Polynomial,
    b: Polynomial,
  ): { quotient: Polynomial; remainder: Polynomial }
  /** Evaluate polynomial at point */
  evaluate(poly: Polynomial, x: FieldElement): FieldElement
  /** Interpolate polynomial from points */
  interpolate(points: Array<{ x: FieldElement; y: FieldElement }>): Polynomial
  /** Get polynomial degree */
  degree(poly: Polynomial): number
}

/**
 * Reed-Solomon algorithm interface
 */
export interface ReedSolomonAlgorithm {
  /** Encode data using Reed-Solomon */
  encode(data: FieldElement[], k: number, n: number): FieldElement[]
  /** Decode data using Reed-Solomon */
  decode(encodedData: FieldElement[], k: number, n: number): FieldElement[]
  /** Generate encoding matrix */
  generateEncodingMatrix(k: number, n: number): FieldElement[][]
  /** Generate decoding matrix */
  generateDecodingMatrix(receivedIndices: number[], k: number): FieldElement[][]
}

/**
 * Algorithm configuration
 */
export interface AlgorithmConfig {
  /** Finite field implementation */
  field: FiniteField
  /** Polynomial operations implementation */
  polynomial: PolynomialOperations
  /** Reed-Solomon algorithm implementation */
  reedSolomon: ReedSolomonAlgorithm
}

/**
 * Cantor basis for GF(2^16) as specified in Gray Paper
 */
export const CANTOR_BASIS: FieldElement[] = [
  0x0001, // v_0 = 1
  0x8b5a, // v_1 = α^15 + α^13 + α^11 + α^10 + α^7 + α^6 + α^3 + α
  0x4c6e, // v_2 = α^13 + α^12 + α^11 + α^10 + α^3 + α^2 + α
  0x5a7b, // v_3 = α^12 + α^10 + α^9 + α^5 + α^4 + α^3 + α^2 + α
  0xc3a1, // v_4 = α^15 + α^14 + α^10 + α^8 + α^7 + α
  0xe7d5, // v_5 = α^15 + α^14 + α^13 + α^11 + α^10 + α^8 + α^5 + α^3 + α^2 + α
  0x9c46, // v_6 = α^15 + α^12 + α^8 + α^6 + α^3 + α^2
  0x5011, // v_7 = α^14 + α^4 + α
  0x6e7b, // v_8 = α^14 + α^13 + α^11 + α^10 + α^7 + α^4 + α^3
  0x4c74, // v_9 = α^12 + α^7 + α^6 + α^4 + α^3
  0x6e5a, // v_10 = α^14 + α^13 + α^11 + α^9 + α^6 + α^5 + α^4 + α
  0x9e08, // v_11 = α^15 + α^13 + α^12 + α^11 + α^8
  0xfe7a, // v_12 = α^15 + α^14 + α^13 + α^12 + α^11 + α^10 + α^8 + α^7 + α^5 + α^4 + α^3
  0xfe54, // v_13 = α^15 + α^14 + α^13 + α^12 + α^11 + α^9 + α^8 + α^5 + α^4 + α^2
  0xfe7a, // v_14 = α^15 + α^14 + α^13 + α^12 + α^11 + α^10 + α^9 + α^8 + α^5 + α^4 + α^3
  0x9c8e, // v_15 = α^15 + α^12 + α^11 + α^8 + α^4 + α^3 + α^2 + α
]

/**
 * Irreducible polynomial for GF(2^16) as specified in Gray Paper
 * x^16 + x^5 + x^3 + x^2 + 1
 */
export const IRREDUCIBLE_POLYNOMIAL = 0x1002d

/**
 * Field generator α (root of irreducible polynomial)
 */
export const FIELD_GENERATOR = 0x0002
