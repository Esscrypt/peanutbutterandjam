/**
 * Polynomial Operations Implementation
 *
 * Implements polynomial operations for erasure coding
 */

import type { FieldElement, Polynomial, FiniteField, PolynomialOperations } from '@pbnj/types'

/**
 * Polynomial operations implementation
 */
export class PolynomialOps implements PolynomialOperations {
  private readonly field: FiniteField

  constructor(field: FiniteField) {
    this.field = field
  }

  /**
   * Add two polynomials
   */
  add(a: Polynomial, b: Polynomial): Polynomial {
    const maxDegree = Math.max(a.length, b.length)
    const result: Polynomial = new Array(maxDegree).fill(0)

    for (let i = 0; i < maxDegree; i++) {
      const aCoeff = i < a.length ? a[i] : 0
      const bCoeff = i < b.length ? b[i] : 0
      result[i] = this.field.add(aCoeff, bCoeff)
    }

    return this.normalize(result)
  }

  /**
   * Multiply two polynomials
   */
  multiply(a: Polynomial, b: Polynomial): Polynomial {
    if (a.length === 0 || b.length === 0) {
      return []
    }

    const resultDegree = a.length + b.length - 1
    const result: Polynomial = new Array(resultDegree).fill(0)

    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        const product = this.field.multiply(a[i], b[j])
        result[i + j] = this.field.add(result[i + j], product)
      }
    }

    return this.normalize(result)
  }

  /**
   * Divide two polynomials (returns quotient and remainder)
   */
  divide(
    a: Polynomial,
    b: Polynomial,
  ): { quotient: Polynomial; remainder: Polynomial } {
    if (b.length === 0 || b.every((coeff) => coeff === 0)) {
      throw new Error('Division by zero polynomial')
    }

    const aDegree = this.degree(a)
    const bDegree = this.degree(b)

    if (aDegree < bDegree) {
      return { quotient: [], remainder: [...a] }
    }

    const quotient: Polynomial = new Array(aDegree - bDegree + 1).fill(0)
    const remainder: Polynomial = [...a]

    for (let i = aDegree; i >= bDegree; i--) {
      if (remainder[i] === 0) continue

      const factor = this.field.divide(remainder[i], b[bDegree])
      quotient[i - bDegree] = factor

      for (let j = 0; j <= bDegree; j++) {
        const product = this.field.multiply(factor, b[j])
        remainder[i - bDegree + j] = this.field.add(
          remainder[i - bDegree + j],
          product,
        )
      }
    }

    return {
      quotient: this.normalize(quotient),
      remainder: this.normalize(remainder),
    }
  }

  /**
   * Evaluate polynomial at point x
   */
  evaluate(poly: Polynomial, x: FieldElement): FieldElement {
    if (poly.length === 0) {
      return 0
    }

    let result = poly[poly.length - 1]
    for (let i = poly.length - 2; i >= 0; i--) {
      result = this.field.add(poly[i], this.field.multiply(result, x))
    }

    return result
  }

  /**
   * Interpolate polynomial from points using Lagrange interpolation
   */
  interpolate(points: Array<{ x: FieldElement; y: FieldElement }>): Polynomial {
    if (points.length === 0) {
      return []
    }

    if (points.length === 1) {
      return [points[0].y]
    }

    const n = points.length
    const result: Polynomial = new Array(n).fill(0)

    for (let i = 0; i < n; i++) {
      const { x: xi, y: yi } = points[i]

      // Compute Lagrange basis polynomial for point i
      const basis: Polynomial = [1]
      let denominator = 1

      for (let j = 0; j < n; j++) {
        if (i === j) continue

        const { x: xj } = points[j]
        const diff = this.field.add(xi, xj) // xi - xj in GF(2^16) is xi + xj

        // Multiply basis by (x - xj)
        const newBasis: Polynomial = new Array(basis.length + 1).fill(0)
        for (let k = 0; k < basis.length; k++) {
          newBasis[k] = this.field.add(newBasis[k], basis[k])
          newBasis[k + 1] = this.field.add(
            newBasis[k + 1],
            this.field.multiply(basis[k], xj),
          )
        }
        basis.splice(0, basis.length, ...newBasis)

        // Update denominator
        denominator = this.field.multiply(denominator, diff)
      }

      // Scale basis by yi / denominator
      const scale = this.field.divide(yi, denominator)
      for (let k = 0; k < basis.length; k++) {
        basis[k] = this.field.multiply(basis[k], scale)
      }

      // Add to result
      for (let k = 0; k < basis.length; k++) {
        result[k] = this.field.add(result[k], basis[k])
      }
    }

    return this.normalize(result)
  }

  /**
   * Get polynomial degree
   */
  degree(poly: Polynomial): number {
    for (let i = poly.length - 1; i >= 0; i--) {
      if (poly[i] !== 0) {
        return i
      }
    }
    return -1 // Zero polynomial
  }

  /**
   * Normalize polynomial (remove leading zeros)
   */
  private normalize(poly: Polynomial): Polynomial {
    const degree = this.degree(poly)
    if (degree === -1) {
      return []
    }
    return poly.slice(0, degree + 1)
  }

  /**
   * Create polynomial from roots
   */
  fromRoots(roots: FieldElement[]): Polynomial {
    if (roots.length === 0) {
      return [1]
    }

    let result: Polynomial = [1]
    for (const root of roots) {
      // Multiply by (x - root)
      const factor: Polynomial = [root, 1] // (x - root) = (root + x) in GF(2^16)
      result = this.multiply(result, factor)
    }

    return result
  }

  /**
   * Get polynomial derivative
   */
  derivative(poly: Polynomial): Polynomial {
    if (poly.length <= 1) {
      return []
    }

    const result: Polynomial = new Array(poly.length - 1).fill(0)
    for (let i = 1; i < poly.length; i++) {
      // In GF(2^16), derivative of x^i is i * x^(i-1)
      // Since i is even for i > 0, the coefficient becomes 0
      if (i % 2 === 1) {
        result[i - 1] = poly[i]
      }
    }

    return this.normalize(result)
  }
}
