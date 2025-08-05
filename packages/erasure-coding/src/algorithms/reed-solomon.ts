/**
 * Reed-Solomon Algorithm Implementation
 *
 * Implementation based on Gray Paper specifications for JAM protocol
 */

import { logger } from '@pbnj/core'
import type { FieldElement } from '../types'
import type {
  FiniteField,
  PolynomialOperations,
  ReedSolomonAlgorithm,
} from './types'
import { CANTOR_BASIS } from './types'

/**
 * Reed-Solomon algorithm implementation
 */
export class ReedSolomon implements ReedSolomonAlgorithm {
  private readonly field: FiniteField
  private readonly cantorBasis: FieldElement[]

  constructor(field: FiniteField, _polynomial: PolynomialOperations) {
    this.field = field
    this.cantorBasis = CANTOR_BASIS

    logger.debug('Reed-Solomon algorithm initialized', {
      fieldSize: field.getSize(),
      cantorBasisLength: this.cantorBasis.length,
    })
  }

  /**
   * Encode data using Reed-Solomon
   */
  encode(data: FieldElement[], k: number, n: number): FieldElement[] {
    if (data.length !== k) {
      throw new Error(`Expected ${k} data elements, got ${data.length}`)
    }

    if (n <= k) {
      throw new Error(
        `Total code words (${n}) must be greater than data words (${k})`,
      )
    }

    logger.debug('Reed-Solomon encoding', { k, n, dataLength: data.length })

    // Use systematic encoding: first k elements are the original data
    const encoded: FieldElement[] = [...data]

    // Generate parity symbols for the remaining n-k positions
    for (let i = k; i < n; i++) {
      let parity = 0
      for (let j = 0; j < k; j++) {
        const coefficient = this.getParityCoefficient(i, j, k)
        parity = this.field.add(
          parity,
          this.field.multiply(data[j], coefficient),
        )
      }
      encoded.push(parity)
    }

    return encoded
  }

  /**
   * Decode data using Reed-Solomon
   */
  decode(encodedData: FieldElement[], k: number, n: number): FieldElement[] {
    if (encodedData.length < k) {
      throw new Error(
        `Need at least ${k} code words for decoding, got ${encodedData.length}`,
      )
    }

    logger.debug('Reed-Solomon decoding', {
      k,
      n,
      receivedLength: encodedData.length,
    })

    // For systematic encoding, if we have the first k elements, they are the original data
    if (encodedData.length >= k) {
      return encodedData.slice(0, k)
    }

    // If we don't have the first k elements, we need to reconstruct them
    // This is a simplified implementation - in practice, you'd need more sophisticated decoding
    const decoded: FieldElement[] = []
    for (let i = 0; i < k; i++) {
      let dataSymbol = 0
      for (let j = 0; j < encodedData.length; j++) {
        const coefficient = this.getDecodingCoefficient(
          i,
          j,
          encodedData.length,
        )
        dataSymbol = this.field.add(
          dataSymbol,
          this.field.multiply(encodedData[j], coefficient),
        )
      }
      decoded.push(dataSymbol)
    }

    return decoded
  }

  /**
   * Generate encoding matrix for systematic encoding
   */
  generateEncodingMatrix(k: number, n: number): FieldElement[][] {
    const matrix: FieldElement[][] = []

    // Identity matrix for systematic part
    for (let i = 0; i < k; i++) {
      const row: FieldElement[] = new Array(k).fill(0)
      row[i] = 1
      matrix.push(row)
    }

    // Parity part
    for (let i = k; i < n; i++) {
      const row: FieldElement[] = new Array(k).fill(0)
      const x = this.validatorIndexToFieldElement(i)

      for (let j = 0; j < k; j++) {
        const xj = this.validatorIndexToFieldElement(j)
        row[j] = this.lagrangeBasisCoefficient(x, xj, k)
      }

      matrix.push(row)
    }

    return matrix
  }

  /**
   * Generate decoding matrix for given received indices
   */
  generateDecodingMatrix(
    receivedIndices: number[],
    k: number,
  ): FieldElement[][] {
    if (receivedIndices.length < k) {
      throw new Error(`Need at least ${k} received indices for decoding matrix`)
    }

    const matrix: FieldElement[][] = []

    for (let i = 0; i < k; i++) {
      const row: FieldElement[] = new Array(receivedIndices.length).fill(0)
      const targetIndex = i
      const targetX = this.validatorIndexToFieldElement(targetIndex)

      for (let j = 0; j < receivedIndices.length; j++) {
        const receivedX = this.validatorIndexToFieldElement(receivedIndices[j])
        row[j] = this.lagrangeBasisCoefficient(
          targetX,
          receivedX,
          receivedIndices.length,
        )
      }

      matrix.push(row)
    }

    return matrix
  }

  /**
   * Convert validator index to field element using Cantor basis
   */
  private validatorIndexToFieldElement(index: number): FieldElement {
    if (index < 0 || index >= 1023) {
      throw new Error(`Invalid validator index: ${index}`)
    }

    let result = 0
    for (let i = 0; i < 16; i++) {
      if ((index & (1 << i)) !== 0) {
        result = this.field.add(result, this.cantorBasis[i])
      }
    }

    return result
  }

  /**
   * Compute Lagrange basis coefficient
   */
  private lagrangeBasisCoefficient(
    x: FieldElement,
    xj: FieldElement,
    n: number,
  ): FieldElement {
    let numerator = 1
    let denominator = 1

    for (let i = 0; i < n; i++) {
      const xi = this.validatorIndexToFieldElement(i)
      if (xi === xj) continue

      numerator = this.field.multiply(numerator, this.field.add(x, xi))
      denominator = this.field.multiply(denominator, this.field.add(xj, xi))
    }

    return this.field.divide(numerator, denominator)
  }

  /**
   * Get parity coefficient for systematic encoding
   */
  private getParityCoefficient(
    parityIndex: number,
    dataIndex: number,
    k: number,
  ): FieldElement {
    // For systematic encoding, we need to compute the coefficient that relates
    // the parity symbol at position parityIndex to the data symbol at position dataIndex
    // This is based on the generator polynomial evaluation

    const parityX = this.validatorIndexToFieldElement(parityIndex)
    const dataX = this.validatorIndexToFieldElement(dataIndex)

    // Compute the coefficient using Lagrange interpolation
    return this.lagrangeBasisCoefficient(parityX, dataX, k)
  }

  /**
   * Get decoding coefficient for reconstruction
   */
  private getDecodingCoefficient(
    targetIndex: number,
    sourceIndex: number,
    _sourceCount: number,
  ): FieldElement {
    // This is a simplified implementation
    // In practice, you'd need to compute the inverse of the encoding matrix
    const targetX = this.validatorIndexToFieldElement(targetIndex)
    const sourceX = this.validatorIndexToFieldElement(sourceIndex)

    // For now, return a simple coefficient
    return this.field.divide(targetX, sourceX)
  }

  /**
   * Systematic encoding using matrix multiplication
   */
  systematicEncode(data: FieldElement[], k: number, n: number): FieldElement[] {
    const matrix = this.generateEncodingMatrix(k, n)
    const encoded: FieldElement[] = []

    for (const row of matrix) {
      let result = 0
      for (let i = 0; i < k; i++) {
        result = this.field.add(result, this.field.multiply(row[i], data[i]))
      }
      encoded.push(result)
    }

    return encoded
  }

  /**
   * Systematic decoding using matrix multiplication
   */
  systematicDecode(
    encodedData: FieldElement[],
    receivedIndices: number[],
    k: number,
  ): FieldElement[] {
    const matrix = this.generateDecodingMatrix(receivedIndices, k)
    const receivedData = receivedIndices.map((i) => encodedData[i])
    const decoded: FieldElement[] = []

    for (const row of matrix) {
      let result = 0
      for (let i = 0; i < receivedData.length; i++) {
        result = this.field.add(
          result,
          this.field.multiply(row[i], receivedData[i]),
        )
      }
      decoded.push(result)
    }

    return decoded
  }
}
