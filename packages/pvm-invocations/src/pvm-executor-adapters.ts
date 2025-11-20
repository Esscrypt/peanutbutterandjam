/**
 * PVM Executor Adapters
 * 
 * Provides adapters for both TypeScript and WASM PVM implementations
 * to implement the common IPVMExecutor interface.
 */

import { logger } from '@pbnj/core'
import type { InstructionRegistry, WasmPvmShellInterface } from '@pbnj/pvm'
import { PVM } from '@pbnj/pvm'
import type {
  ContextMutator,
  HostFunctionRegistry,
  ImplicationsPair,
  PVMState,
  RefineInvocationContext,
  SafePromise,
} from '@pbnj/types'
import { safeResult } from '@pbnj/types'
import type { IPVMExecutor } from './pvm-executor-interface'


/**
 * TypeScript PVM Adapter
 * 
 * Wraps the TypeScript PVM implementation to implement IPVMExecutor.
 */
export class TypeScriptPVMExecutor implements IPVMExecutor {
  private readonly pvm: PVM

  constructor(
    hostFunctionRegistry: HostFunctionRegistry,
    pvmOptions?: {
      pc?: bigint
      registerState?: bigint[]
      ram?: any
      gasCounter?: bigint
      code?: Uint8Array
    },
  ) {
    this.pvm = new PVM(hostFunctionRegistry, pvmOptions)
  }

  async executeMarshallingInvocation(
    programBlob: Uint8Array,
    initialPC: bigint,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    contextMutator: ContextMutator,
    context: RefineInvocationContext | ImplicationsPair,
    buildPanicDump?: boolean,
    serviceId?: bigint,
    writeHostFunctionLogs?: boolean,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: RefineInvocationContext | ImplicationsPair
  }> {
    return this.pvm.executeMarshallingInvocationPublic(
      programBlob,
      initialPC,
      gasLimit,
      encodedArgs,
      contextMutator,
      context,
      buildPanicDump,
      serviceId,
      writeHostFunctionLogs,
    )
  }

  getState(): PVMState {
    return this.pvm.getState()
  }

  getExecutionLogs() {
    return this.pvm.getExecutionLogs()
  }

  getHostFunctionLogs() {
    return this.pvm.getHostFunctionLogs()
  }

  skip(instructionIndex: number, opcodeBitmask: Uint8Array): number {
    return this.pvm.skipPublic(instructionIndex, opcodeBitmask)
  }

  get state(): PVMState {
    return this.pvm.state
  }

  get registry(): InstructionRegistry {
    return this.pvm.registry
  }

  get hostFunctionRegistry(): HostFunctionRegistry {
    return this.pvm.hostFunctionRegistry
  }
}

/**
 * WASM PVM Adapter
 * 
 * Wraps the WASM PVM implementation to implement IPVMExecutor.
 * 
 * Note: This is a placeholder implementation. The actual WASM integration
 * will require loading the WASM module and implementing the marshalling invocation
 * using the lower-level WASM interface.
 */
export class WasmPVMExecutor implements IPVMExecutor {
  private readonly wasmShell: WasmPvmShellInterface

  private currentState: PVMState | null = null

  constructor(
    wasmShell: WasmPvmShellInterface
  ) {
    this.wasmShell = wasmShell
  }

  async executeMarshallingInvocation(
    programBlob: Uint8Array,
    initialPC: bigint,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    contextMutator: ContextMutator,
    context: RefineInvocationContext | ImplicationsPair,
    buildPanicDump?: boolean,
    serviceId?: bigint,
    writeHostFunctionLogs?: boolean,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: RefineInvocationContext | ImplicationsPair
  }> {
    // TODO: Implement marshalling invocation using WASM interface
    // This requires:
    // 1. Encoding registers from context
    // 2. Calling resetGeneric with program and registers
    // 3. Executing steps until halt/panic/oog
    // 4. Extracting result from memory/registers
    // 5. Handling host function calls via contextMutator
    
    logger.warn(
      'WasmPVMExecutor: executeMarshallingInvocation not yet fully implemented',
    )
    
    // Placeholder implementation
    const initialRegisters = new Uint8Array(13 * 8) // 13 registers x 8 bytes
    
    this.wasmShell.resetGeneric(programBlob, initialRegisters, gasLimit)
    this.wasmShell.setNextProgramCounter?.(Number(initialPC))

    const initialGas = gasLimit
    let steps = 0
    const maxSteps = 1_000_000 // Safety limit

    while (this.wasmShell.nextStep() && steps < maxSteps) {
      steps++
      const status = this.wasmShell.getStatus()
      if (status !== 0) {
        // Halted, panicked, or OOG
        break
      }
    }

    const finalGas = this.wasmShell.getGasLeft()
    const gasConsumed = initialGas - (finalGas > 0n ? finalGas : 0n)
    const status = this.wasmShell.getStatus()

    let result: Uint8Array | 'PANIC' | 'OOG'
    if (status === 5) {
      // OOG
      result = 'OOG'
    } else if (status === 2) {
      // PANIC
      result = 'PANIC'
    } else {
      // HALT - extract result from memory
      // TODO: Read result from memory using registers[7] and registers[8]
      result = new Uint8Array(0)
    }

    // Update state
    this.updateStateFromWasm()

    return safeResult({
      gasConsumed,
      result,
      context,
    })
  }

  getState(): PVMState {
    if (!this.currentState) {
      this.updateStateFromWasm()
    }
    return this.currentState!
  }

  skip(instructionIndex: number, opcodeBitmask: Uint8Array): number {
    // WASM implementation of skip function
    const extendedBitmask = new Uint8Array(opcodeBitmask.length + 25)
    extendedBitmask.set(opcodeBitmask)
    extendedBitmask.fill(1, opcodeBitmask.length)

    for (let j = 1; j <= 24; j++) {
      const bitIndex = instructionIndex + j
      if (
        bitIndex < extendedBitmask.length &&
        extendedBitmask[bitIndex] === 1
      ) {
        return j - 1
      }
    }

    return 24 // Maximum skip distance
  }

  get state(): PVMState {
    return this.getState()
  }

}

