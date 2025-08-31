// Note: irreducible polynomial is x^16 + x^5 + x^3 + x^2 + 1 per Gray Paper

// GF(2^16) over polynomial basis with irreducible poly x^16 + x^5 + x^3 + x^2 + 1 (H.*, GF section)

/** Ensure element is in 16-bit range */
function mask16(x: number): number {
  return x & 0xffff
}

/** Polynomial basis addition in GF(2^16): XOR */
export function gfAdd(a: number, b: number): number {
  return mask16(a ^ b)
}

/** Carry-less multiply two 16-bit polynomials */
function clmul16(a: number, b: number): number {
  let res = 0
  let aa = a
  let bb = b
  while (bb) {
    if (bb & 1) res ^= aa
    aa <<= 1
    bb >>>= 1
  }
  return res // up to 31 bits
}

/** Reduce 32-bit polynomial modulo the irreducible polynomial */
function reduceMod(x: number): number {
  // modulus: x^16 + x^5 + x^3 + x^2 + 1 => 1_0000_0010_1101 (0x1100_2D) but we use 0x1002d (bit-16 set)
  // For bits >= 16, fold down using: x^16 = x^5 + x^3 + x^2 + 1
  for (let i = 31; i >= 16; i--) {
    if ((x >>> i) & 1) {
      const shift = i - 16
      // subtract (xor) (x^5 + x^3 + x^2 + 1) << shift
      x ^= 1 << (5 + shift)
      x ^= 1 << (3 + shift)
      x ^= 1 << (2 + shift)
      x ^= 1 << (0 + shift)
    }
  }
  return mask16(x)
}

/** Polynomial basis multiply in GF(2^16) */
export function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  const prod = clmul16(a, b)
  return reduceMod(prod)
}

/** Exponentiation by square-and-multiply in GF(2^16) */
export function gfPow(a: number, e: number): number {
  let base = mask16(a)
  let exp = e >>> 0
  let result = 1
  while (exp > 0) {
    if (exp & 1) result = gfMultiply(result, base)
    base = gfMultiply(base, base)
    exp >>>= 1
  }
  return result
}

/** Multiplicative inverse: a^(2^16-2) */
export function gfInverse(a: number): number {
  if (a === 0) throw new Error('gfInverse(0) undefined')
  // In GF(2^m), a^(2^m-1) = 1, so a^(2^m-2) is inverse
  return gfPow(a, 0xffff - 1)
}

/** Division in GF(2^16) */
export function gfDivide(a: number, b: number): number {
  if (b === 0) throw new Error('division by zero')
  if (a === 0) return 0
  return gfMultiply(a, gfInverse(b))
}

// ----------------------------------------------------------------------------
// Cantor basis conversions
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Compute Cantor basis from Gray Paper exponent sets (Appendix H)
// ----------------------------------------------------------------------------

const SPEC_V_EXPONENTS: number[][] = [
  [0],
  [15, 13, 11, 10, 7, 6, 3, 1],
  [13, 12, 11, 10, 3, 2, 1],
  [12, 10, 9, 5, 4, 3, 2, 1],
  [15, 14, 10, 8, 7, 1],
  [15, 14, 13, 11, 10, 8, 5, 3, 2, 1],
  [15, 12, 8, 6, 3, 2],
  [14, 4, 1],
  [14, 13, 11, 10, 7, 4, 3],
  [12, 7, 6, 4, 3],
  [14, 13, 11, 9, 6, 5, 4, 1],
  [15, 13, 12, 11, 8],
  [15, 14, 13, 12, 11, 10, 8, 7, 5, 4, 3],
  [15, 14, 13, 12, 11, 9, 8, 5, 4, 2],
  [15, 14, 13, 12, 11, 10, 9, 8, 5, 4, 3],
  [15, 12, 11, 8, 4, 3, 2, 1],
]

/** Compute numeric polynomial-basis values for the Gray Paper Cantor basis vectors. */
export function computeCantorBasisFromSpec(): number[] {
  const alpha = 0x0002 // FIELD_GENERATOR per types
  const powCache: number[] = new Array(16)
  powCache[0] = 1
  for (let i = 1; i < 16; i++) powCache[i] = gfMultiply(powCache[i - 1], alpha)
  return SPEC_V_EXPONENTS.map((exps) => {
    let acc = 0
    for (const e of exps) acc ^= powCache[e]
    return acc & 0xffff
  })
}

const GP_CANTOR_BASIS = computeCantorBasisFromSpec()

export function polyToCantor(a: number): number {
  // Build 16x16 matrix of basis vectors; track row ops via coeffRows mapping to original rows
  const basis = GP_CANTOR_BASIS
  let t = a & 0xffff
  const mat = basis.slice() // rows as 16-bit numbers (polynomial-basis vectors)
  const coeffRows: number[] = new Array(16)
  for (let i = 0; i < 16; i++) coeffRows[i] = 1 << i // mask bit i corresponds to basis[i]

  // Row-reduce to column-pivoted echelon form, eliminating pivot bits from other rows
  let row = 0
  let mask = 0
  for (let bit = 15; bit >= 0 && row < 16; bit--) {
    // Find pivot with this bit set
    let pivotRow = -1
    for (let r = row; r < 16; r++) {
      if ((mat[r] >>> bit) & 1) {
        pivotRow = r
        break
      }
    }
    if (pivotRow === -1) continue
    // Swap into current row
    ;[mat[row], mat[pivotRow]] = [mat[pivotRow], mat[row]]
    ;[coeffRows[row], coeffRows[pivotRow]] = [
      coeffRows[pivotRow],
      coeffRows[row],
    ]
    // Eliminate this bit from all other rows
    for (let r = 0; r < 16; r++) {
      if (r !== row && (mat[r] >>> bit) & 1) {
        mat[r] ^= mat[row]
        coeffRows[r] ^= coeffRows[row]
      }
    }
    // If target has this bit, subtract the pivot row and record coefficients
    if ((t >>> bit) & 1) {
      t ^= mat[row]
      mask ^= coeffRows[row]
    }
    row++
  }
  if (t !== 0) {
    throw new Error('Cantor conversion failed: basis not full rank for target')
  }
  return mask & 0xffff
}

/** Convert from Cantor basis representation (coeff bitmask) to polynomial basis value. */
export function cantorToPoly(mask: number): number {
  let acc = 0
  for (let i = 0; i < 16; i++) {
    if ((mask >>> i) & 1) acc ^= GP_CANTOR_BASIS[i]
  }
  return acc & 0xffff
}

// ----------------------------------------------------------------------------
// Basis diagnostics
// ----------------------------------------------------------------------------

/** Compute rank over GF(2) for a list of 16-bit rows */
function rankGF2(rows: number[]): number {
  const mat = rows.slice()
  let r = 0
  for (let bit = 15; bit >= 0; bit--) {
    let pivot = -1
    for (let i = r; i < mat.length; i++) {
      if (((mat[i] >>> bit) & 1) === 1) {
        pivot = i
        break
      }
    }
    if (pivot === -1) continue
    ;[mat[r], mat[pivot]] = [mat[pivot], mat[r]]
    for (let i = 0; i < mat.length; i++) {
      if (i !== r && (mat[i] >>> bit) & 1) mat[i] ^= mat[r]
    }
    r++
    if (r === 16) break
  }
  return r
}

export function isCantorBasisFullRank(): boolean {
  return rankGF2(GP_CANTOR_BASIS) === 16
}

// ----------------------------------------------------------------------------
// Index mapping i -> \u02DCi (tilde i) using Cantor basis per Gray Paper (H.*)
// ----------------------------------------------------------------------------

/** Map evaluation index i in [0, 1023] to field element as defined in the Gray Paper:
 *   \u02DCi = \n\n    \u2211_{j=0}^{15} i_j v_j
 * where i = (i_15 ... i_0) is the binary representation of i and {v_j} are the Cantor basis
 * vectors. For i in [0, 1023], only the lower 10 bits may be non-zero; higher coefficients are 0.
 */
export function mapIndexToField(i: number): number {
  if (!Number.isInteger(i) || i < 0 || i > 1023) {
    throw new Error(`index out of range: ${i}`)
  }
  // Build the Cantor-basis coefficient mask directly from the binary digits of i (lower 10 bits).
  let mask = 0
  for (let b = 0; b < 10; b++) {
    if ((i >>> b) & 1) mask |= 1 << b
  }
  return cantorToPoly(mask)
}
