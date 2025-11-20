import { PVMState } from '../../pvm'
import { RAM, RegisterState } from '../../types'
import { HostFunctionResult, ServiceAccount } from '../accumulate/base'

/**
 * PVM Guest - represents a PVM machine instance
 */
export class PVMGuest {
  pvm: PVMState

  constructor(pvm: PVMState) {
    this.pvm = pvm
  }
}

/**
 * Refine Invocation Context
 * Gray Paper: (m, e) where m = machines, e = export segments
 */
export class RefineInvocationContext {
  machines: Map<u64, PVMGuest>
  exportSegments: Array<Uint8Array>

  constructor() {
    this.machines = new Map<u64, PVMGuest>()
    this.exportSegments = [] as Uint8Array[]
  }
}

/**
 * Host function context for general host functions
 */
export class HostFunctionContext {
  gasCounter: u32
  registers: RegisterState
  ram: RAM

  constructor(
    gasCounter: u32,
    registers: RegisterState,
    ram: RAM,
  ) {
    this.gasCounter = gasCounter
    this.registers = registers
    this.ram = ram
  }
}

/**
 * Host function parameter types
 */
export interface ReadParams {
  serviceId: u64
  serviceAccount: ServiceAccount | null
  accounts: Map<u64, ServiceAccount>
}

export interface WriteParams {
  serviceAccount: ServiceAccount
}

export interface InfoParams {
  serviceId: u64
  accounts: Map<u64, ServiceAccount>
}

export interface LookupParams {
  serviceId: u64
  accounts: Map<u64, ServiceAccount>
}

export interface HistoricalLookupParams {
  serviceId: u64
  accounts: Map<u64, ServiceAccount>
  lookupTimeslot: u64
}

export interface InvokeParams {
  refineContext: RefineInvocationContext | null
}

export interface ExpungeParams {
  refineContext: RefineInvocationContext | null
}

export class LogParams {
  // LogParams doesn't need any properties - all data comes from registers
}

export interface MachineParams {
  refineContext: RefineInvocationContext | null
}

export interface PagesParams {
  refineContext: RefineInvocationContext | null
}

export interface PeekPokeParams {
  refineContext: RefineInvocationContext | null
}

export interface ExportParams {
  refineContext: RefineInvocationContext | null
}

/**
 * Base params type for all host function parameters
 * AssemblyScript doesn't support union types, so we use a base type
 */
export class HostFunctionParams {
  // This is a marker class - actual implementations will extend this
}

/**
 * Base class for all host functions
 *
 * Host functions are called by PVM programs via host call instructions.
 * They provide access to system resources, storage, and other PVM instances.
 */
export class BaseHostFunction {
  /**
   * The unique identifier for this host function
   * Must match the ID in GENERAL_FUNCTIONS, REFINE_FUNCTIONS, or ACCUMULATE_FUNCTIONS
   */
  functionId: u64 = 0

  /**
   * Human-readable name for this host function
   */
  name: string = ''

  /**
   * Execute the host function
   *
   * @param context - Host function context (will be mutated)
   * @param params - Optional parameters (function-specific)
   * @returns Result code
   */
  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    // Base implementation - should be overridden by subclasses
    return {
      resultCode: null,
    }
  }
}
