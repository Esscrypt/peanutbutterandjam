import { gfMultiply } from '../src/gf16'

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

function compute(): number[] {
  const alpha = 0x0002
  const pow: number[] = new Array(16)
  pow[0] = 1
  for (let i = 1; i < 16; i++) pow[i] = gfMultiply(pow[i - 1], alpha)
  const vals = SPEC_V_EXPONENTS.map((exps) =>
    exps.reduce((acc, e) => (acc ^ pow[e]) & 0xffff, 0),
  )
  return vals
}

const vals = compute()
console.log(
  'CANTOR_BASIS hex:',
  vals.map((v) => '0x' + v.toString(16).padStart(4, '0')),
)
console.log('CANTOR_BASIS dec:', vals)
