import { PVM, PVMState } from '../../pvm'
import { RAM, RegisterState } from '../../types'
import { HostFunctionResult } from '../accumulate/base'
import { CompleteServiceAccount, WorkPackage, WorkItem } from '../../codec'
import { RefineInvocationContext } from '../../pbnj-types-compat'

/**
 * PVM Guest - represents a PVM machine instance
 */
export class PVMGuest {
  pvm: PVM

  constructor(pvm: PVM) {
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
 * Base params type for all host function parameters
 * AssemblyScript doesn't support union types, so we use a base type
 */
export class HostFunctionParams {
  // This is a marker class - actual implementations will extend this
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
export class ReadParams extends HostFunctionParams {
  serviceId: u64
  serviceAccount: CompleteServiceAccount | null
  accounts: Map<u64, CompleteServiceAccount>

  constructor(
    serviceId: u64,
    serviceAccount: CompleteServiceAccount | null,
    accounts: Map<u64, CompleteServiceAccount>,
  ) {
    super()
    this.serviceId = serviceId
    this.serviceAccount = serviceAccount
    this.accounts = accounts
  }
}

export class WriteParams extends HostFunctionParams {
  serviceAccount: CompleteServiceAccount

  constructor(serviceAccount: CompleteServiceAccount) {
    super()
    this.serviceAccount = serviceAccount
  }
}

export class InfoParams extends HostFunctionParams {
  serviceId: u64
  accounts: Map<u64, CompleteServiceAccount>

  constructor(serviceId: u64, accounts: Map<u64, CompleteServiceAccount>) {
    super()
    this.serviceId = serviceId
    this.accounts = accounts
  }
}

export class LookupParams extends HostFunctionParams {
  serviceId: u64
  accounts: Map<u64, CompleteServiceAccount>

  constructor(serviceId: u64, accounts: Map<u64, CompleteServiceAccount>) {
    super()
    this.serviceId = serviceId
    this.accounts = accounts
  }
}

export class HistoricalLookupParams extends HostFunctionParams {
  serviceId: u64
  accounts: Map<u64, CompleteServiceAccount>
  lookupTimeslot: u64

  constructor(
    serviceId: u64,
    accounts: Map<u64, CompleteServiceAccount>,
    lookupTimeslot: u64,
  ) {
    super()
    this.serviceId = serviceId
    this.accounts = accounts
    this.lookupTimeslot = lookupTimeslot
  }
}

export class InvokeParams extends HostFunctionParams {
  refineContext: RefineInvocationContext | null

  constructor(refineContext: RefineInvocationContext | null) {
    super()
    this.refineContext = refineContext
  }
}

export class ExpungeParams extends HostFunctionParams {
  refineContext: RefineInvocationContext | null

  constructor(refineContext: RefineInvocationContext | null) {
    super()
    this.refineContext = refineContext
  }
}

export class LogParams extends HostFunctionParams {
  // LogParams doesn't need any properties - all data comes from registers
  constructor() {
    super()
  }
}

export class MachineParams extends HostFunctionParams {
  refineContext: RefineInvocationContext | null

  constructor(refineContext: RefineInvocationContext | null) {
    super()
    this.refineContext = refineContext
  }
}

export class PagesParams extends HostFunctionParams {
  refineContext: RefineInvocationContext | null

  constructor(refineContext: RefineInvocationContext | null) {
    super()
    this.refineContext = refineContext
  }
}

export class PeekPokeParams extends HostFunctionParams {
  refineContext: RefineInvocationContext | null

  constructor(refineContext: RefineInvocationContext | null) {
    super()
    this.refineContext = refineContext
  }
}

export class FetchParams extends HostFunctionParams {
  timeslot: u64
  offset: u64
  workPackage: WorkPackage | null = null
  workPackageHash: Uint8Array | null = null
  authorizerTrace: Uint8Array | null = null
  workItemIndex: u64 = u64(0) // Use 0 as sentinel for null
  importSegments: Array<Array<Uint8Array>> | null = null
  exportSegments: Array<Array<Uint8Array>> | null = null
  workItemsSequence: Array<WorkItem> | null = null

  constructor(timeslot: u64, offset: u64) {
    super()
    this.timeslot = timeslot
    this.offset = offset
  }
}

export class ExportParams extends HostFunctionParams {
  refineContext: RefineInvocationContext | null
  segmentOffset: i64

  constructor(
    refineContext: RefineInvocationContext | null,
    segmentOffset: i64 = 0,
  ) {
    super()
    this.refineContext = refineContext
    this.segmentOffset = segmentOffset
  }
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
    return new HostFunctionResult(255) // 255 = continue execution
  }
}
