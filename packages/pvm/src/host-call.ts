/**
 * Ψ_H (Psi H) Function Implementation
 *
 * Extended version of the PVM invocation which is able to progress an inner
 * host-call state-machine in the case of a host-call halt condition.
 *
 * As specified in Gray Paper equation 7.4
 */

import { logger } from '@pbnj/core'
import type {
  ContextMutator,
  HostCallHandler,
  RAM,
  RegisterState,
  ResultCode,
} from '@pbnj/types'
import { RESULT_CODES } from './config'

export class HostCallSystem<X> {
  private contextMutator: ContextMutator<X>

  constructor(contextMutator: ContextMutator<X>) {
    this.contextMutator = contextMutator
  }

  /**
   * Execute PVM with host call handling
   *
   * @param instructionData - Program instruction data
   * @param instructionPointer - Current instruction pointer
   * @param gasCounter - Current gas counter
   * @param registers - Current register state
   * @param ram - Current RAM state
   * @param context - External context
   * @returns Result with updated state
   */
  execute(
    instructionData: Uint8Array,
    instructionPointer: bigint,
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: X,
  ): {
    resultCode: ResultCode
    instructionPointer: bigint
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: X
  } {
    logger.debug('HostCallSystem.execute called', {
      instructionPointer,
      gasCounter,
      context: typeof context,
    })

    // Execute PVM step and handle results
    const pvmResult = this.executePVMStep(
      instructionData,
      instructionPointer,
      gasCounter,
      registers,
      ram,
    )

    if (pvmResult.resultCode === RESULT_CODES.HOST) {
      return this.handleHostCall(
        pvmResult.hostCallId!,
        pvmResult.instructionPointer,
        pvmResult.gasCounter,
        pvmResult.registers,
        pvmResult.ram,
        context,
      )
    }

    // Return other results as-is
    return {
      resultCode: pvmResult.resultCode,
      instructionPointer: pvmResult.instructionPointer,
      gasCounter: pvmResult.gasCounter,
      registers: pvmResult.registers,
      ram: pvmResult.ram,
      context,
    }
  }

  /**
   * Handle host call with context mutator
   *
   * @param hostCallId - Host call identifier
   * @param instructionPointer - Current instruction pointer
   * @param gasCounter - Current gas counter
   * @param registers - Current register state
   * @param ram - Current RAM state
   * @param context - External context
   * @returns Updated state after host call
   */
  private handleHostCall(
    hostCallId: bigint,
    instructionPointer: bigint,
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: X,
  ): {
    resultCode: ResultCode
    instructionPointer: bigint
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: X
  } {
    logger.debug('Handling host call', { hostCallId })

    // Call the context mutator
    const mutatorResult = this.contextMutator(
      hostCallId,
      gasCounter,
      registers,
      ram,
      context,
    )

    // Check if the mutator returned a fault
    if (mutatorResult.resultCode === 'fault') {
      return {
        resultCode: RESULT_CODES.FAULT,
        instructionPointer,
        gasCounter,
        registers,
        ram,
        context,
      }
    }

    // Return the updated state
    return {
      resultCode:
        mutatorResult.resultCode === 'continue'
          ? RESULT_CODES.HALT
          : RESULT_CODES.PANIC,
      instructionPointer,
      gasCounter: mutatorResult.gasCounter,
      registers: mutatorResult.registers,
      ram: mutatorResult.ram,
      context: mutatorResult.context,
    }
  }

  /**
   * Execute a single PVM step
   * This is a placeholder - in the real implementation, this would call the actual PVM
   */
  private executePVMStep(
    instructionData: Uint8Array,
    instructionPointer: bigint,
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
  ): {
    resultCode: ResultCode
    instructionPointer: bigint
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    hostCallId?: bigint
  } {
    // Simplified PVM step simulation for testing host calls
    // In the real system, this would call the actual PVM

    // Check if we have an instruction at the current pointer
    if (instructionPointer >= instructionData.length) {
      return {
        resultCode: RESULT_CODES.HALT,
        instructionPointer,
        gasCounter,
        registers,
        ram,
      }
    }

    // Check for ECALLI instruction (opcode 0xB0)
    const opcode = instructionData[Number(instructionPointer)]
    if (
      opcode === 0xb0 &&
      instructionData.length > Number(instructionPointer + 1n)
    ) {
      const hostCallId = instructionData[Number(instructionPointer + 1n)]
      return {
        resultCode: RESULT_CODES.HOST,
        instructionPointer: instructionPointer + 2n,
        gasCounter: gasCounter - 1n,
        registers,
        ram,
        hostCallId: BigInt(hostCallId),
      }
    }

    // For other instructions, just continue
    return {
      resultCode: RESULT_CODES.HALT,
      instructionPointer: instructionPointer + 1n,
      gasCounter: gasCounter - 1n,
      registers,
      ram,
    }
  }
}

/**
 * Default host call handler implementation
 */
export class DefaultHostCallHandler implements HostCallHandler {
  handleHostCall(
    hostCallId: bigint,
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
  ):
    | {
        resultCode: 'continue' | 'halt' | 'panic' | 'oog'
        gasCounter: bigint
        registers: RegisterState
        ram: RAM
      }
    | {
        resultCode: 'fault'
        address: bigint
      } {
    logger.debug('DefaultHostCallHandler.handleHostCall called', { hostCallId })

    // Default implementation just continues with reduced gas
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 1n,
      registers,
      ram,
    }
  }
}
