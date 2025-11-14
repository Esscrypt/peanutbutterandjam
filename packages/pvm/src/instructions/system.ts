/**
 * System Instructions
 *
 * ECALLI - Host call with immediate value
 */

import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * ECALLI instruction (opcode 0x0A / 10)
 * Host call with immediate value
 * Dispatches to General functions (0-13) and Accumulate functions (14-26)
 *
 * Gray Paper pvm.tex §7.4.1 line 264:
 * ε = host × immed_X
 *
 * Operand format (lines 251-255):
 * - operands[0:l_X]: immed_X (variable-length immediate, sign-extended)
 * Where: l_X = min(4, ℓ)
 *
 * Note: No encoding byte - just raw immediate bytes (0-4 bytes)
 */
export class ECALLIInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ECALLI
  readonly name = 'ECALLI'

  execute(context: InstructionContext): InstructionResult {
    context.log('ECALLI: Host call with immediate value', {
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      currentPC: context.pc,
    })

    context.registers[0] = BigInt(context.instruction.operands[0])

    const result = {
      resultCode: RESULT_CODES.HOST,
    }

    return result
  }
}
