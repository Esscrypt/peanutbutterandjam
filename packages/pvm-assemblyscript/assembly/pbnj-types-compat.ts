/**
 * @pbnjam/types compatibility layer for AssemblyScript
 * 
 * Provides local implementations of types/interfaces from @pbnjam/types
 * to make the code compile in AssemblyScript without external dependencies
 */

import { RegisterState, RAM } from './types'
import { PVM } from './pvm'
import { HostFunctionParams } from './host-functions/general/base'

// Re-export types from other modules
export { PVM, PVMState } from './pvm'
export { RAM, MemoryAccessType } from './types'

// ============================================================================
// Host Function Types
// ============================================================================

export class HostFunctionResult {
  resultCode: u8

  constructor(resultCode: u8 = 255) {
    // Use 255 (0xFF) as sentinel value for null (continue execution)
    // This is safe because valid result codes are 0-5 (HALT, PANIC, etc.)
    this.resultCode = resultCode
  }
}

export class HostFunctionContext {
  registers: RegisterState
  ram: RAM
  gasCounter: u32

  constructor(gasCounter: u32, registers: RegisterState, ram: RAM) {
    this.gasCounter = gasCounter
    this.registers = registers
    this.ram = ram
  }
}

// ============================================================================
// Service Account Types
// ============================================================================

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

  constructor() {
    this.codehash = ''
    this.balance = 0
    this.minaccgas = 0
    this.minmemogas = 0
    this.octets = 0
    this.gratis = 0
    this.items = 0
    this.created = 0
    this.lastacc = 0
    this.parent = 0
  }
}

export class ServiceAccountCore {
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

  constructor() {
    this.codehash = ''
    this.balance = 0
    this.minaccgas = 0
    this.minmemogas = 0
    this.octets = 0
    this.gratis = 0
    this.items = 0
    this.created = 0
    this.lastacc = 0
    this.parent = 0
  }
}

// ============================================================================
// Service Interfaces (Stub implementations)
// ============================================================================

// Removed IServiceAccountService and IConfigService - functionality implemented directly in host functions

// ============================================================================
// Host Function Parameter Types
// ============================================================================

export class LookupParams {
  serviceId: u64
  key: Uint8Array

  constructor(serviceId: u64, key: Uint8Array) {
    this.serviceId = serviceId
    this.key = key
  }
}

export class HistoricalLookupParams {
  serviceId: u64
  hash: Uint8Array
  timeslot: u64

  constructor(serviceId: u64, hash: Uint8Array, timeslot: u64) {
    this.serviceId = serviceId
    this.hash = hash
    this.timeslot = timeslot
  }
}

export class InfoParams {
  serviceId: u64
  outputOffset: u64
  fromOffset: u64
  length: u64

  constructor(serviceId: u64, outputOffset: u64, fromOffset: u64, length: u64) {
    this.serviceId = serviceId
    this.outputOffset = outputOffset
    this.fromOffset = fromOffset
    this.length = length
  }
}

export class FetchParams extends HostFunctionParams {
  timeslot: u64
  offset: u64

  constructor(timeslot: u64, offset: u64) {
    super()
    this.timeslot = timeslot
    this.offset = offset
  }
}


// Placeholder types for compatibility
export interface InvokeParams {
  refineContext: usize // Using usize as generic pointer
}

export interface PVMGuest {
  pvm: PVM
}

export interface PVMOptions {
  // Placeholder - not used in AssemblyScript
}

export interface RefineInvocationContext {
  // Placeholder - not used in AssemblyScript
}

// ============================================================================
// Constants (from @pbnjam/types)
// ============================================================================

export class WORK_PACKAGE_CONSTANTS {
  static readonly C_MAXPACKAGEITEMS: i32 = 16
  static readonly C_MAXPACKAGEXTS: i32 = 128
  static readonly C_MAXPACKAGEIMPORTS: i32 = 3072
  static readonly C_MAXPACKAGEEXPORTS: i32 = 3072
  static readonly C_MAXBUNDLESIZE: i32 = 13791360
}

export class WORK_REPORT_CONSTANTS {
  static readonly C_MAXREPORTDEPS: i32 = 8
  static readonly C_REPORTACCGAS: i32 = 10000000
  static readonly C_MAXREPORTVARSIZE: i32 = 49152 // 48 * 2^10
}

export class AUTHORIZATION_CONSTANTS {
  static readonly C_AUTHPOOLSIZE: i32 = 8
  static readonly C_AUTHQUEUESIZE: i32 = 80
  static readonly C_PACKAGEAUTHGAS: i32 = 50000000
  static readonly C_MAXAUTHCODESIZE: i32 = 64000
}

export class GAS_CONSTANTS {
  static readonly C_PACKAGEREFGAS: i64 = 5000000000
  static readonly C_BLOCKACCGAS: i64 = 3500000000
}

export class SEGMENT_CONSTANTS {
  static readonly C_ECPIECESIZE: i32 = 684
  static readonly C_SEGMENTECPIECES: i32 = 6
  static readonly C_SEGMENTSIZE: i32 = 4104
}

export class SERVICE_CONSTANTS {
  static readonly C_MAXSERVICECODESIZE: i32 = 4000000
  static readonly C_MINPUBLICINDEX: i32 = 65536
}

export class TICKET_CONSTANTS {
  static readonly C_MAXBLOCKTICKETS: i32 = 16
  static readonly C_TICKETENTRIES: i32 = 2
  static readonly C_EPOCHTAILSTART: i32 = 500
}

export class TIME_CONSTANTS {
  static readonly C_ROTATIONPERIOD: i32 = 10
  static readonly C_ASSURANCETIMEOUTPERIOD: i32 = 5
  static readonly C_EXPUNGEPERIOD: i32 = 19200
  static readonly C_MAXLOOKUPANCHORAGE: i32 = 14400
}

export class HISTORY_CONSTANTS {
  static readonly C_RECENTHISTORYLEN: i32 = 8
}

export class DEPOSIT_CONSTANTS {
  static readonly C_BASEDEPOSIT: i32 = 100
  static readonly C_BYTEDEPOSIT: i32 = 1
  static readonly C_ITEMDEPOSIT: i32 = 10
}

export class TRANSFER_CONSTANTS {
  static readonly C_MEMOSIZE: i32 = 128
}

export class ExportParams {
  // Add properties as needed
}

