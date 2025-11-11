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
  COFACTOR: BigInt(4),

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
      '3955725774225903122339172568337849452553276548604445833196164961773358506589',
    ),
    y: BigInt(
      '29870564530691725960104983716673293929719207405660860235233811770612192692323',
    ),
    isInfinity: false,
  },

  /** Padding point for Ring VRF (from ark-vrf specification) */
  PADDING_POINT: {
    x: BigInt(
      '23942223917106120326220291257397678561637131227432899006603244452561725937075',
    ),
    y: BigInt(
      '1605027200774560580022502723165578671697794116420567297367317898913080293877',
    ),
    isInfinity: false,
  },

  /** Curve characteristics */
  CHARACTERISTICS: {
    j_invariant: BigInt(0x1f40),
    discriminant: BigInt(-8),
  },

  /** Elligator2 hash-to-curve configuration (from arkworks) */
  ELLIGATOR2_CONFIG: {
    /** Non-square element Z = 5 */
    Z: BigInt(5),
    /** Precomputed 1/(COEFF_B)^2 */
    ONE_OVER_COEFF_B_SQUARE: BigInt(
      '35484827650731063748396669747216844996598387089274032563585525486049249153249',
    ),
    /** Precomputed COEFF_A/COEFF_B */
    COEFF_A_OVER_COEFF_B: BigInt(
      '22511181562295907836254750456843438087744031914659733450388350895537307167857',
    ),
  },

  /** KZG Polynomial Commitment Scheme parameters (from bandersnatch-vrf-spec) */
  KZG_CONFIG: {
    /** Polynomial domain generator ω */
    DOMAIN_GENERATOR: BigInt(
      '49307615728544765012166121802278658070711169839041683575071795236746050763237',
    ),
    /** Domain size |𝔻| = 2048 (2^11) */
    DOMAIN_SIZE: 2048,
    /** Maximum ring size (domain_size / 2 - 1) */
    MAX_RING_SIZE: 1023,
    /** SRS source identifier */
    SRS_SOURCE: 'zcash-powers-of-tau-ceremony',
    /** Required SRS degree (for domain size 2048) */
    SRS_DEGREE: 11, // 2^11 = 2048
    /** BLS12-381 curve identifier for c-kzg compatibility */
    CURVE_ID: 'BLS12-381',
  },
} as const
