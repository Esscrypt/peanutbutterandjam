/**
 * Argument Invocation Implementation
 *
 * Implements the Ψ_M function for program-argument invocation
 * as specified in the Gray Paper section 7.6
 */

import { logger } from '@pbnj/core'
import type {
  ArgumentData,
  ContextMutator,
  Gas,
  RAM,
  RegisterState,
  ResultCode,
} from '@pbnj/types'
import { PVM_CONSTANTS } from '@pbnj/types'
import { HostCallSystem } from './host-call'
import { ProgramInitializer } from './program-init'

/**
 * Ψ_M (Psi M) Function Implementation
 *
 * Common PVM program-argument invocation function that handles
 * argument data passing and return data collection.
 *
 * As specified in Gray Paper equation 7.8
 */
export class ArgumentInvocationSystem<X> {
  private readonly programInitializer: ProgramInitializer
  private readonly hostCallSystem: HostCallSystem<X>

  constructor(contextMutator: ContextMutator<X>) {
    this.programInitializer = new ProgramInitializer()
    this.hostCallSystem = new HostCallSystem(contextMutator)
  }

  /**
   * Execute program with arguments
   *
   * @param programBlob - Program blob data
   * @param instructionPointer - Initial instruction pointer
   * @param gasLimit - Gas limit for execution
   * @param argumentData - Argument data to pass to program
   * @param contextMutator - Context mutator for host calls
   * @param context - External context
   * @returns Result with gas consumed and return data
   */
  execute(
    programBlob: Uint8Array,
    instructionPointer: number,
    gasLimit: Gas,
    argumentData: ArgumentData,
    context: X,
  ): {
    gasConsumed: Gas
    result: Uint8Array | 'panic' | 'oog'
    context: X
  } {
    logger.debug('ArgumentInvocationSystem.execute called', {
      blobSize: programBlob.length,
      instructionPointer,
      gasLimit,
      argSize: argumentData.size,
    })

    // Step 1: Initialize program using Y(𝐩, 𝐚)
    const initResult = this.programInitializer.initialize(
      programBlob,
      argumentData,
    )

    if (!initResult.success) {
      logger.error('Program initialization failed', { error: initResult.error })
      return {
        gasConsumed: 0n,
        result: 'panic',
        context,
      }
    }

    // Step 2: Execute program with host call handling using Ψ_H
    const executionResult = this.hostCallSystem.execute(
      initResult.instructionData!,
      instructionPointer,
      gasLimit,
      initResult.registers!,
      initResult.ram!,
      context,
    )

    // Step 3: Process result according to Gray Paper equation 7.8
    return this.processResult(gasLimit, executionResult, initResult.registers!)
  }

  /**
   * Process execution result according to Gray Paper equation 7.8
   */
  private processResult(
    initialGas: Gas,
    executionResult: {
      resultCode: ResultCode
      instructionPointer: number
      gasCounter: Gas
      registers: RegisterState
      ram: RAM
      context: X
    },
    finalRegisters: RegisterState,
  ): {
    gasConsumed: Gas
    result: Uint8Array | 'panic' | 'oog'
    context: X
  } {
    const gasConsumed =
      initialGas - BigInt(Math.max(Number(executionResult.gasCounter), 0))

    // Handle different result codes as per Gray Paper
    if (executionResult.resultCode === 4) {
      // OOG
      return {
        gasConsumed,
        result: 'oog',
        context: executionResult.context,
      }
    }

    if (executionResult.resultCode === 0) {
      // HALT
      // Halt - extract return data from memory
      const returnData = this.extractReturnData(
        finalRegisters['r7'], // Argument pointer
        Number(finalRegisters['r8']), // Argument length
        executionResult.ram,
      )

      if (returnData === null) {
        return {
          gasConsumed,
          result: 'panic',
          context: executionResult.context,
        }
      }

      return {
        gasConsumed,
        result: returnData,
        context: executionResult.context,
      }
    }

    // Any other result code is treated as panic
    return {
      gasConsumed,
      result: 'panic',
      context: executionResult.context,
    }
  }

  /**
   * Extract return data from memory
   *
   * @param startAddress - Start address of return data
   * @param length - Length of return data
   * @param ram - RAM instance
   * @returns Return data array or null if invalid
   */
  private extractReturnData(
    startAddress: bigint,
    length: number,
    ram: RAM,
  ): Uint8Array | null {
    try {
      const start = Number(startAddress)
      const end = start + length

      // Validate address range
      if (start < 0 || end > Number(PVM_CONSTANTS.MAX_MEMORY_ADDRESS)) {
        logger.error('Invalid return data address range', { start, end })
        return null
      }

      // Check if memory range is readable
      for (let i = start; i < end; i++) {
        if (!ram.isReadable(i)) {
          logger.error('Return data address not readable', { address: i })
          return null
        }
      }

      return ram.readOctets(start, length)
    } catch (error) {
      logger.error('Error extracting return data', { error })
      return null
    }
  }
}
