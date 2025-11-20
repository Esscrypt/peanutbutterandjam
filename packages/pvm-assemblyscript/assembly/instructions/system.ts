/**
 * System Instructions
 *
 * ECALLI - Host call with immediate value
 */

import { OPCODE_ECALLI, RESULT_CODE_HOST } from '../config'
import { InstructionContext, InstructionResult } from '../types'
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
  opcode: i32 = OPCODE_ECALLI
  name: string = 'ECALLI'

  execute(context: InstructionContext): InstructionResult {
    context.registers[0] = u64(context.operands[0])

    return new InstructionResult(RESULT_CODE_HOST)
  }
}
