/**
 * System Instructions
 *
 * ECALLI - Host call with immediate value
 */

import { logger } from '@pbnj/core'
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
  readonly description = 'Host call with immediate value'

  execute(context: InstructionContext): InstructionResult {
    // Read variable-length immediate (0-4 bytes)
    const length = Math.min(4, context.instruction.operands.length)
    const hostCallId = this.getImmediateValue(
      context.instruction.operands,
      0,
      length,
    )

    logger.debug('Executing ECALLI instruction', { hostCallId })

    // Consume gas
    

    context.registers[0] = hostCallId

    const result = {
      resultCode: RESULT_CODES.HOST,
    }

    console.log('ECALLI returning result:', result)
    return result
  }

  disassemble(operands: Uint8Array): string {
    const hostCallId = this.getImmediateValue(operands, 0)
    return `${this.name} ${hostCallId}`
  }
}
