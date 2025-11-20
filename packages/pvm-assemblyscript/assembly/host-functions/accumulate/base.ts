import { RAM, RegisterState } from '../../types'

/**
 * Host function result
 */
export class HostFunctionResult {
  resultCode: u8 | null

  constructor(resultCode: u8 | null) {
    this.resultCode = resultCode
  }
}

/**
 * Service Account structure (simplified for AssemblyScript)
 * Note: Full implementation would include all ServiceAccount fields
 */
export class ServiceAccount {
  codehash: string
  balance: u64
  minaccgas: u64
  minmemogas: u64
  octets: u64
  gratis: u64
  items: u64
  created: u64
  lastacc: u64
  parent: u64
  storage: Map<string, Uint8Array>
  preimages: Map<string, Uint8Array>
  requests: Map<string, Map<u64, u64[]>> // Simplified structure

  constructor() {
    this.codehash = ''
    this.balance = u64(0)
    this.minaccgas = u64(0)
    this.minmemogas = u64(0)
    this.octets = u64(0)
    this.gratis = u64(0)
    this.items = u64(0)
    this.created = u64(0)
    this.lastacc = u64(0)
    this.parent = u64(0)
    this.storage = new Map<string, Uint8Array>()
    this.preimages = new Map<string, Uint8Array>()
    this.requests = new Map<string, Map<u64, u64[]>>()
  }
}

/**
 * Partial state type as per Gray Paper section 31.1
 */
export class PartialState {
  accounts: Map<u64, ServiceAccount>
  stagingset: Uint8Array[]
  authqueue: Uint8Array[][] // Array of arrays (one per core)
  manager: u64
  assigners: u64[] // Array of service IDs (one per core)
  delegator: u64
  registrar: u64
  alwaysaccers: Map<u64, u64>

  constructor() {
    this.accounts = new Map<u64, ServiceAccount>()
    this.stagingset = [] as Uint8Array[]
    this.authqueue = [] as Uint8Array[][]
    this.manager = u64(0)
    this.assigners = [] as u64[]
    this.delegator = u64(0)
    this.registrar = u64(0)
    this.alwaysaccers = new Map<u64, u64>()
  }
}

/**
 * Implications type as per Gray Paper section 31.1
 */
export class Implications {
  id: u64
  state: PartialState
  nextfreeid: u64
  xfers: Uint8Array[] // Simplified - would be DeferredTransfer[]
  yield: Uint8Array | null
  provisions: Map<u64, Uint8Array>

  constructor() {
    this.id = u64(0)
    this.state = new PartialState()
    this.nextfreeid = u64(0)
    this.xfers = []
    this.yield = null
    this.provisions = new Map<u64, Uint8Array>()
  }
}

/**
 * Implications pair (regular and exceptional dimensions)
 * Gray Paper: I(postxferstate, s)² = (implications, implications)
 */
export class ImplicationsPair {
  regular: Implications
  exceptional: Implications

  constructor(regular: Implications, exceptional: Implications) {
    this.regular = regular
    this.exceptional = exceptional
  }
}

/**
 * Accumulate host function context
 */
export class AccumulateHostFunctionContext {
  gasCounter: u32
  registers: RegisterState
  ram: RAM
  implications: ImplicationsPair
  timeslot: u64
  expungePeriod: u64

  constructor(
    gasCounter: u32,
    registers: RegisterState,
    ram: RAM,
    implications: ImplicationsPair,
    timeslot: u64,
    expungePeriod: u64,
  ) {
    this.gasCounter = gasCounter
    this.registers = registers
    this.ram = ram
    this.implications = implications
    this.timeslot = timeslot
    this.expungePeriod = expungePeriod
  }
}

/**
 * Accumulate error codes
 * Gray Paper: Error codes for accumulation host functions
 */
export const ACCUMULATE_ERROR_NONE: i64 = i64(0xffffffffffffffff) // 2^64 - 1
export const ACCUMULATE_ERROR_WHAT: i64 = i64(0xfffffffffffffffe) // 2^64 - 2
export const ACCUMULATE_ERROR_OOB: i64 = i64(0xfffffffffffffffd) // 2^64 - 3
export const ACCUMULATE_ERROR_WHO: i64 = i64(0xfffffffffffffffc) // 2^64 - 4
export const ACCUMULATE_ERROR_FULL: i64 = i64(0xfffffffffffffffb) // 2^64 - 5
export const ACCUMULATE_ERROR_CORE: i64 = i64(0xfffffffffffffffa) // 2^64 - 6
export const ACCUMULATE_ERROR_CASH: i64 = i64(0xfffffffffffffff9) // 2^64 - 7
export const ACCUMULATE_ERROR_LOW: i64 = i64(0xfffffffffffffff8) // 2^64 - 8
export const ACCUMULATE_ERROR_HUH: i64 = i64(0xfffffffffffffff7) // 2^64 - 9
export const ACCUMULATE_ERROR_OK: i64 = i64(0) // Success

/**
 * Base class for all accumulation host functions
 *
 * Accumulation host functions operate on accumulation context (implications)
 * and can mutate service accounts, manage transfers, and handle blockchain operations.
 * They are different from general host functions as they work with accumulation context
 * rather than just PVM state.
 */
export class BaseAccumulateHostFunction {
  public functionId: u64
  public name: string

  public execute(
    context: AccumulateHostFunctionContext,
  ): HostFunctionResult {
    // This should be overridden by all accumulate host function subclasses
    return {
      resultCode: null,
    }
  }

  // Helper methods for accumulation-specific operations
  setAccumulateError(
    registers: RegisterState,
    errorCode: u64,
  ): void {
    registers[7] = errorCode
  }

  setAccumulateSuccess(
    registers: RegisterState,
    value: u64 = ACCUMULATE_ERROR_OK,
  ): void {
    registers[7] = value
  }

  isMemoryRangeReadable(
    ram: RAM,
    offset: u64,
    length: u64,
  ): bool {
    const result_readable = ram.isReadableWithFault(offset, length)
    const readable = result_readable.data || result_readable[0] || result_readable
    const faultAddress = result_readable.faultAddress || result_readable[1] || null
    if (faultAddress_readResult !== null || faultAddress !== null) {
      return false
    }
    return readable
  }

  isMemoryRangeWritable(
    ram: RAM,
    offset: u64,
    length: u64,
  ): bool {
    const result_writable = ram.isWritableWithFault(offset, length)
    const writable = result_writable.data || result_writable[0] || result_writable
    const faultAddress = result_writable.faultAddress || result_writable[1] || null
    if (faultAddress_readResult !== null || faultAddress !== null) {
      return false
    }
    return writable
  }
}
