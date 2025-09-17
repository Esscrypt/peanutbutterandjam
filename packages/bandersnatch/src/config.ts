/**
 * Bandersnatch curve parameters
 * Reference: MSZ21 - https://eprint.iacr.org/2021/1152
 * Bandersnatch is defined over the BLS12-381 scalar field
 */
export const BANDERSNATCH_PARAMS = {
  /** Field modulus for Bandersnatch curve (from official specification) */
  FIELD_MODULUS: BigInt(
    '0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001',
  ),

  /** Curve order for Bandersnatch curve (from official specification) */
  CURVE_ORDER: BigInt(
    '0x1cfb69d4ca675f520cce760202687600ff8f87007419047174fd06b52876e7e1',
  ),

  /** Generator point coordinates (from official specification) */
  GENERATOR: {
    x: BigInt(
      '18886178867200960497001835917649091219057080094937609519140440539760939937304',
    ),
    y: BigInt(
      '19188667384257783945677642223292697773471335439753913231509108946878080696678',
    ),
    isInfinity: false,
  },

  /** Curve coefficients for Twisted Edwards form */
  CURVE_COEFFICIENTS: {
    /** Coefficient a = -5 */
    a: BigInt(-5),
    /** Coefficient d */
    d: BigInt(
      '0x6389c12633c267cbc66e3bf86be3b6d8cb66677177e54f92b369f2f5188d58e7',
    ),
  },

  /** Cofactor */
  COFACTOR: BigInt('0x04'),

  /** Blinding base point for Pedersen VRF (from official specification) */
  BLINDING_BASE: {
    x: BigInt(
      '6150229251051246713677296363717454238956877613358614224171740096471278798312',
    ),
    y: BigInt(
      '28442734166467795856797249030329035618871580593056783094884474814923353898473',
    ),
    isInfinity: false,
  },

  /** Accumulator base point for Ring VRF (from ark-vrf specification) */
  ACCUMULATOR_BASE: {
    x: BigInt(
      '37805570861274048643170021838972902516980894313648523898085159469000338764576',
    ),
    y: BigInt(
      '14738305321141000190236674389841754997202271418876976886494444739226156422510',
    ),
    isInfinity: false,
  },

  /** Padding point for Ring VRF (from ark-vrf specification) */
  PADDING_POINT: {
    x: BigInt(
      '26287722405578650394504321825321286533153045350760430979437739593351290020913',
    ),
    y: BigInt(
      '19058981610000167534379068105702216971787064146691007947119244515951752366738',
    ),
    isInfinity: false,
  },

  /** Curve characteristics */
  CHARACTERISTICS: {
    j_invariant: BigInt(0x1f40),
    discriminant: BigInt(-8),
  },
} as const
