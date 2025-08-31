import type { FieldElement } from '@pbnj/types'

import { gfAdd, gfDivide, gfMultiply, mapIndexToField } from './gf16'

/** Mask to 16-bit field element */
function toField(x: number): FieldElement {
  return x & 0xffff
}

/** Compute barycentric weights for given distinct nodes x[0..k-1] over GF(2^16). */
function computeBarycentricWeights(nodes: FieldElement[]): FieldElement[] {
  const k = nodes.length
  const weights: FieldElement[] = new Array(k)
  for (let i = 0; i < k; i++) {
    let denom: FieldElement = 1
    const xi = nodes[i]
    for (let j = 0; j < k; j++) {
      if (i === j) continue
      const diff = gfAdd(xi, nodes[j]) // subtraction equals addition in GF(2)
      if (diff === 0) throw new Error('duplicate interpolation node detected')
      denom = gfMultiply(denom, diff)
    }
    weights[i] = gfDivide(1, denom)
  }
  return weights
}

/** Evaluate polynomial defined by nodes x[0..k-1] and values y[0..k-1] at a target point x. */
function evaluateBarycentric(
  nodes: FieldElement[],
  values: FieldElement[],
  weights: FieldElement[],
  x: FieldElement,
): FieldElement {
  // Handle exact node equality: p(x_i) = y_i
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] === x) return values[i]
  }
  let numerator: FieldElement = 0
  let denominator: FieldElement = 0
  for (let i = 0; i < nodes.length; i++) {
    const termDen = gfAdd(x, nodes[i]) // x - x_i
    const frac = gfDivide(weights[i], termDen)
    numerator = gfAdd(numerator, gfMultiply(frac, values[i]))
    denominator = gfAdd(denominator, frac)
  }
  return gfDivide(numerator, denominator)
}

/**
 * Encode a single piece of k words into n=1023 codewords using systematic RS over GF(2^16).
 * - Input length must be exactly k (default 342).
 * - Output length is 1023. For indices 0..k-1, outputs equal inputs.
 * - Evaluation points are \u02DCi for i=0..1022 using the Cantor-basis mapping (H., Gray Paper).
 */
export function encodePieceReference(
  messageWords: FieldElement[],
  k = 342,
  n = 1023,
): FieldElement[] {
  if (!Array.isArray(messageWords))
    throw new Error('messageWords must be an array')
  if (messageWords.length !== k)
    throw new Error(`message must have exactly k=${k} words`)
  if (k <= 0 || n <= k || n !== 1023)
    throw new Error(`invalid (k,n): (${k},${n})`)

  const xNodes: FieldElement[] = new Array(k)
  for (let i = 0; i < k; i++) xNodes[i] = mapIndexToField(i)
  const yNodes: FieldElement[] = messageWords.map(toField)
  const weights = computeBarycentricWeights(xNodes)

  const codewords: FieldElement[] = new Array(n)
  // Systematic part: copy first k
  for (let i = 0; i < k; i++) codewords[i] = yNodes[i]
  // Parity part: evaluate at indices k..n-1
  for (let i = k; i < n; i++) {
    const x = mapIndexToField(i)
    codewords[i] = evaluateBarycentric(xNodes, yNodes, weights, x)
  }

  return codewords.map(toField)
}

export interface IndexedWord {
  index: number
  value: FieldElement
}

/**
 * Recover the original k message words from any 342-of-1023 (index, value) pairs.
 * - If exactly indices {0..k-1} are provided (all once), returns values ordered by index.
 * - Otherwise, interpolates from any 342 unique indices and evaluates at 0..k-1.
 * - Throws on duplicates, out-of-range indices, or when < k unique indices are provided.
 */
export function recoverPieceReference(
  received: IndexedWord[],
  k = 342,
): FieldElement[] {
  if (!Array.isArray(received)) throw new Error('received must be an array')
  // Validate entries and collect unique by index (first occurrence wins)
  const indexToValue = new Map<number, FieldElement>()
  for (const { index, value } of received) {
    if (!Number.isInteger(index) || index < 0 || index > 1022) {
      throw new Error(`index out of range: ${index}`)
    }
    if (!indexToValue.has(index)) indexToValue.set(index, toField(value))
  }
  if (indexToValue.size < k) {
    throw new Error(
      `insufficient unique indices: have ${indexToValue.size}, need ${k}`,
    )
  }

  // Degenerate fast-path: exactly {0..k-1}
  if (indexToValue.size === k) {
    let isExactlyFirstK = true
    for (let i = 0; i < k; i++) {
      if (!indexToValue.has(i)) {
        isExactlyFirstK = false
        break
      }
    }
    if (isExactlyFirstK) {
      const result: FieldElement[] = new Array(k)
      for (let i = 0; i < k; i++) result[i] = toField(indexToValue.get(i)!)
      return result
    }
  }

  // Use first k unique indices (sorted) to interpolate
  const selectedIndices = Array.from(indexToValue.keys())
    .sort((a, b) => a - b)
    .slice(0, k)
  const nodes: FieldElement[] = selectedIndices.map((idx) =>
    mapIndexToField(idx),
  )
  const values: FieldElement[] = selectedIndices.map(
    (idx) => indexToValue.get(idx) as number,
  )
  const weights = computeBarycentricWeights(nodes)

  // Evaluate at 0..k-1
  const recovered: FieldElement[] = new Array(k)
  for (let i = 0; i < k; i++) {
    const x = mapIndexToField(i)
    recovered[i] = evaluateBarycentric(nodes, values, weights, x)
  }
  return recovered.map(toField)
}
