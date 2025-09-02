/**
 * System Instructions
 *
 * ECALLI - Host call with immediate value
 */

import { logger } from '@pbnj/core'
import type {
  InstructionContext,
  InstructionResult,
  PartialState,
} from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { dispatchGeneralFunction, type GeneralContext } from '../general'
import {
  type AccumulateContext,
  dispatchAccumulateFunction,
} from '../invocations/accumulate-functions'
import { BaseInstruction } from './base'

/**
 * ECALLI instruction (opcode 0x10)
 * Host call with immediate value - dispatches to General functions (0-13) and Accumulate functions (14-26)
 */
export class ECALLIInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ECALLI
  readonly name = 'ECALLI'
  readonly description = 'Host call with immediate value'

  execute(context: InstructionContext): InstructionResult {
    const hostCallId = this.getImmediateValue(context.instruction.operands, 0n)

    logger.debug('Executing ECALLI instruction', { hostCallId })

    // Check if this is a General function call (0-13)
    if (hostCallId >= 0n && hostCallId <= 13n) {
      return this.executeGeneralFunction(hostCallId, context)
    }

    // Check if this is an Accumulate function call (14-26)
    if (hostCallId >= 14n && hostCallId <= 26n) {
      return this.executeAccumulateFunction(hostCallId, context)
    }

    // Unknown function ID
    logger.error('Unknown host call function ID', { hostCallId })
    return {
      resultCode: RESULT_CODES.PANIC,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  private executeGeneralFunction(
    functionId: bigint,
    context: InstructionContext,
  ): InstructionResult {
    // Create General context
    const generalContext: GeneralContext = {
      gasCounter: context.gasCounter,
      registers: context.registers,
      memory: context.ram,
      // Additional context can be added as needed
      currentServiceId: 0, // Default service ID
    }

    // Dispatch to General function
    const result = dispatchGeneralFunction(functionId, generalContext)

    // Handle execution state
    if (result.executionState === 'panic') {
      return {
        resultCode: RESULT_CODES.PANIC,
        newInstructionPointer: context.instructionPointer + 1n,
        newGasCounter: context.gasCounter - 1n,
      }
    }

    if (result.executionState === 'oog') {
      return {
        resultCode: RESULT_CODES.OOG,
        newInstructionPointer: context.instructionPointer + 1n,
        newGasCounter: 0n,
      }
    }

    // Success - update registers with result
    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters: result.registers,
    }
  }

  private executeAccumulateFunction(
    functionId: bigint,
    context: InstructionContext,
  ): InstructionResult {
    // Initialize system state if not present
    const systemState: PartialState = {
      accounts: new Map(),
      authqueue: new Map(),
      assigners: new Map(),
      stagingset: [],
      nextfreeid: 65536n, // Cminpublicindex
      manager: 0n,
      registrar: 0n,
      delegator: 0n,
      alwaysaccers: new Map(),
      xfers: [],
      provisions: new Map(),
      yield: null,
    }

    // Create Accumulate context
    const accumulateContext: AccumulateContext = {
      gasCounter: context.gasCounter,
      registers: context.registers,
      memory: context.ram,
      state: systemState,
      currentTime: BigInt(Date.now()),
      currentServiceId: 0n, // Default service ID
    }

    // Dispatch to Accumulate function
    const result = dispatchAccumulateFunction(functionId, accumulateContext)

    // Handle execution state
    if (result.executionState === 'panic') {
      return {
        resultCode: RESULT_CODES.PANIC,
        newInstructionPointer: context.instructionPointer + 1n,
        newGasCounter: result.registers.r7,
      }
    }

    if (result.executionState === 'oog') {
      return {
        resultCode: RESULT_CODES.OOG,
        newInstructionPointer: context.instructionPointer + 1n,
        newGasCounter: 0n,
      }
    }

    // Success - update registers with result
    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters: result.registers,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 1) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const hostCallId = this.getImmediateValue(operands, 0n)
    return `${this.name} ${hostCallId}`
  }
}
