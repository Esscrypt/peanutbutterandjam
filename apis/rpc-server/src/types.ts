// JIP-2 Node RPC Types
// Based on https://docs.jamcha.in/advanced/rpc/jip2-node-rpc

import type { Hex } from 'viem'

// WebSocket types
export interface WebSocket {
  send(data: string): void
  ping(): void
  close(): void
  readyState: number
}

// Chain Parameters as defined in the specification
export interface Parameters {
  // Base deposits
  deposit_per_account: bigint // B_S
  deposit_per_item: bigint // B_I
  deposit_per_byte: bigint // B_L

  // Timing parameters
  min_turnaround_period: number // D
  epoch_period: number // E
  rotation_period: number // R
  availability_timeout: number // U

  // Gas limits
  max_accumulate_gas: number // G_A
  max_is_authorized_gas: number // G_I
  max_refine_gas: number // G_R
  block_gas_limit: number // G_T

  // Cache and window parameters
  recent_block_count: number // H
  auth_window: number // O
  auth_queue_len: number // Q
  max_lookup_anchor_age: number // L

  // Work package limits
  max_work_items: number // I
  max_dependencies: number // J
  max_tickets_per_block: number // K
  tickets_attempts_number: number // N
  max_extrinsics: number // T

  // Validator count
  val_count: number // V

  // Work package size limits
  max_input: number // W_B
  max_refine_code_size: number // W_C
  basic_piece_len: number // W_E
  max_imports: number // W_M

  // Additional parameters (not in Gray Paper)
  max_is_authorized_code_size: number // W_I
  max_exports: number // W_X
  max_refine_memory: number // max_refine_memory
  max_is_authorized_memory: number // max_is_authorized_memory
}

// RPC Result type - union of all possible return types
export type RpcResult =
  | Parameters
  | { hash: Hex; slot: bigint }
  | Hex
  | Uint8Array
  | number[]
  | bigint[]
  | string // subscription ID
  | null
  | undefined

// RPC method parameter types
export type RpcParams =
  | [] // no parameters
  | [Hex] // parent, stateRoot, statistics, beefyRoot, listServices
  | [Hex, number] // serviceData
  | [Hex, number, Blob] // serviceValue
  | [Hex, number, Hex] // servicePreimage
  | [Hex, number, Hex, number] // serviceRequest
  | [number, Blob, Blob[]] // submitWorkPackage
  | [number, Blob, Hex] // submitPreimage
  | [boolean] // subscribeStatistics
  | [number, boolean] // subscribeServiceData
  | [number, Blob, boolean] // subscribeServiceValue
  | [number, Hex, boolean] // subscribeServicePreimage
  | [number, Hex, number, boolean] // subscribeServiceRequest

// Subscription types
export interface Subscription {
  id: string
  type: string
  params?: RpcParams
  ws: WebSocket
}

// WebSocket message types
export interface RpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: RpcParams
}

export interface RpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: RpcResult
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export interface RpcNotification {
  jsonrpc: '2.0'
  method: string
  params: RpcResult
}

// Error codes as defined in JSON-RPC 2.0
export enum RpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerErrorStart = -32000,
  ServerErrorEnd = -32099,
}

// JIP-2 specific error codes
export enum Jip2ErrorCode {
  BlockNotFound = -32001,
  ServiceNotFound = -32002,
  InvalidHash = -32003,
  InvalidServiceId = -32004,
  InvalidCoreIndex = -32005,
  WorkPackageTooLarge = -32006,
  PreimageNotFound = -32007,
  InvalidPreimage = -32008,
}

// Method names for type safety
export type RpcMethod =
  | 'parameters'
  | 'bestBlock'
  | 'subscribeBestBlock'
  | 'finalizedBlock'
  | 'subscribeFinalizedBlock'
  | 'parent'
  | 'stateRoot'
  | 'statistics'
  | 'subscribeStatistics'
  | 'serviceData'
  | 'subscribeServiceData'
  | 'serviceValue'
  | 'subscribeServiceValue'
  | 'servicePreimage'
  | 'subscribeServicePreimage'
  | 'serviceRequest'
  | 'subscribeServiceRequest'
  | 'beefyRoot'
  | 'submitWorkPackage'
  | 'submitPreimage'
  | 'listServices'

// Utility types for validation
export interface HashValidator {
  isValid(hash: unknown): hash is Hex
  fromHex(hex: string): Hex
  toHex(hash: Hex): string
}

export interface BlobValidator {
  isValid(blob: unknown): blob is Uint8Array
  fromHex(hex: string): Uint8Array
  toHex(blob: Uint8Array): string
}

export interface SlotValidator {
  isValid(slot: unknown): slot is bigint
  fromNumber(num: number): bigint
  toNumber(slot: bigint): number
}
