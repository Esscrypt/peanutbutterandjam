/**
 * Finite Field Implementation for GF(2^16)
 *
 * Implementation based on Gray Paper specifications
 */

import { logger } from '@pbnj/core'
import type { FieldElement } from '../types'
import type { FiniteField } from './types'
import { FIELD_GENERATOR, IRREDUCIBLE_POLYNOMIAL } from './types'

/**
 * Finite field implementation for GF(2^16)
 */
export class GF2_16 implements FiniteField {
  private readonly fieldSize: number
  private readonly irreducible: number
  private readonly generator: FieldElement
  private readonly logTable: Uint16Array
  private readonly expTable: Uint16Array

  constructor() {
    this.fieldSize = 65536 // 2^16
    this.irreducible = IRREDUCIBLE_POLYNOMIAL
    this.generator = FIELD_GENERATOR

    // Initialize logarithm and exponential tables for efficient multiplication
    this.logTable = new Uint16Array(this.fieldSize)
    this.expTable = new Uint16Array(this.fieldSize)
    this.initializeTables()

    logger.debug('GF(2^16) finite field initialized', {
      fieldSize: this.fieldSize,
      irreducible: this.irreducible.toString(16),
      generator: this.generator.toString(16),
    })
  }

  /**
   * Initialize logarithm and exponential tables
   */
  private initializeTables(): void {
    let element = 1
    for (let i = 0; i < this.fieldSize - 1; i++) {
      this.expTable[i] = element
      this.logTable[element] = i
      element = this.multiplyByGenerator(element)
    }
    this.expTable[this.fieldSize - 1] = 1
    this.logTable[0] = this.fieldSize - 1
  }

  /**
   * Multiply by field generator
   */
  private multiplyByGenerator(element: FieldElement): FieldElement {
    element <<= 1
    if (element >= this.fieldSize) {
      element ^= this.irreducible
    }
    return element
  }

  /**
   * Add two field elements (XOR in GF(2^16))
   */
  add(a: FieldElement, b: FieldElement): FieldElement {
    return a ^ b
  }

  /**
   * Multiply two field elements using logarithm tables
   */
  multiply(a: FieldElement, b: FieldElement): FieldElement {
    if (a === 0 || b === 0) {
      return 0
    }

    const logSum = (this.logTable[a] + this.logTable[b]) % (this.fieldSize - 1)
    return this.expTable[logSum]
  }

  /**
   * Divide two field elements
   */
  divide(a: FieldElement, b: FieldElement): FieldElement {
    if (b === 0) {
      throw new Error('Division by zero in finite field')
    }

    if (a === 0) {
      return 0
    }

    const logDiff =
      (this.logTable[a] - this.logTable[b] + this.fieldSize - 1) %
      (this.fieldSize - 1)
    return this.expTable[logDiff]
  }

  /**
   * Get multiplicative inverse
   */
  inverse(a: FieldElement): FieldElement {
    if (a === 0) {
      throw new Error('Inverse of zero does not exist in finite field')
    }

    const logInverse =
      (this.fieldSize - 1 - this.logTable[a]) % (this.fieldSize - 1)
    return this.expTable[logInverse]
  }

  /**
   * Exponentiate field element
   */
  power(a: FieldElement, exponent: number): FieldElement {
    if (exponent === 0) {
      return 1
    }

    if (a === 0) {
      return 0
    }

    if (exponent < 0) {
      a = this.inverse(a)
      exponent = -exponent
    }

    const logPower = (this.logTable[a] * exponent) % (this.fieldSize - 1)
    return this.expTable[logPower]
  }

  /**
   * Get field generator
   */
  getGenerator(): FieldElement {
    return this.generator
  }

  /**
   * Get field size
   */
  getSize(): number {
    return this.fieldSize
  }

  /**
   * Convert field element to string representation
   */
  toString(element: FieldElement): string {
    return `0x${element.toString(16).padStart(4, '0')}`
  }

  /**
   * Convert field element from string representation
   */
  fromString(str: string): FieldElement {
    if (str.startsWith('0x')) {
      str = str.slice(2)
    }
    return Number.parseInt(str, 16)
  }
}
