/**
 * Bandersnatch curve parameters
 */
export const BANDERSNATCH_PARAMS = {
  /** Field modulus for Bandersnatch curve */
  FIELD_MODULUS: BigInt(
    '0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47',
  ),

  /** Curve order for Bandersnatch curve */
  CURVE_ORDER: BigInt(
    '0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001',
  ),

  /** Generator point coordinates */
  GENERATOR: {
    x: BigInt(
      '0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab',
    ),
    y: BigInt('0x0'),
  },
} as const
