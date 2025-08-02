// import { z } from 'zod'

export * as z from 'zod'
// if needed, import viem for EVM types

/**
 * coerce.boolean doesnt work by default: https://github.com/colinhacks/zod/discussions/3329
 */
// export const zBoolean = ({ defaultValue }: { defaultValue: boolean }) => {
//   return z
//     .enum(['true', 'false'])
//     .default(defaultValue ? 'true' : 'false')
//     .transform((x) => x === 'true')
// }

// export const zHex = z
//   .string()
//   .regex(/^(0x)?[a-fA-F0-9]+$/)
//   .transform((val) =>
//     val.startsWith('0x') ? (val as Hex) : (`0x${val}` as Hex),
//   )
//   .refine((val) => val.startsWith('0x'), 'Invalid Hex string format')
