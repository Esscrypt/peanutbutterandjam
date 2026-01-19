// JIP-2 Node RPC Types
// Based on https://docs.jamcha.in/advanced/rpc/jip2-node-rpc

// JIP-2: Hash is a Base64-encoded string (32 bytes when decoded)
export type Hash = string

// JIP-2: Blob is a Base64-encoded string (arbitrary length when decoded)
export type Blob = string

// WebSocket types - compatible with Bun's native WebSocket
export interface WebSocket {
  send(data: string | ArrayBuffer): void
  ping?(): void
  close?(): void
  readyState: number
}

// Chain Parameters as defined in the specification
export interface Parameters {
  // Base deposits
  deposit_per_account: bigint // B_S
  deposit_per_item: bigint // B_I
  deposit_per_byte: bigint // B_L

  // Core count
  core_count: number // C

  // Timing parameters
  min_turnaround_period: number // D
  epoch_period: number // E
  rotation_period: number // R
  availability_timeout: number // U
  slot_period_sec: number // P

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
  max_authorizer_code_size: number // W_A
  max_input: number // W_B
  max_service_code_size: number // W_C
  basic_piece_len: number // W_E
  max_imports: number // W_M
  segment_piece_count: number // W_P
  max_report_elective_data: number // W_R
  transfer_memo_size: number // W_T
  max_exports: number // W_X

  // Epoch tail
  epoch_tail_start: number // Y
}

// RPC Result type - union of all possible return types
// JIP-2: Hashes and Blobs are Base64-encoded strings
export type RpcResult =
  | Parameters
  | { hash: Hash; slot: bigint } // Block Descriptor
  | Hash // stateRoot, beefyRoot
  | Blob // statistics, serviceData, serviceValue, servicePreimage, workReport
  | number[]
  | bigint[]
  | string // subscription ID
  | null
  | undefined

// RPC method parameter types
// JIP-2: Parameters are Base64-encoded strings
export type RpcParams =
  | [] // no parameters
  | [Hash] // parent, stateRoot, statistics, beefyRoot, listServices
  | [Hash, number] // serviceData
  | [Hash, number, Blob] // serviceValue
  | [Hash, number, Hash] // servicePreimage
  | [Hash, number, Hash, number] // serviceRequest
  | [number, Blob, Blob[]] // submitWorkPackage
  | [number, Blob, Hash] // submitPreimage
  | [boolean] // subscribeStatistics
  | [number, boolean] // subscribeServiceData
  | [number, Blob, boolean] // subscribeServiceValue
  | [number, Hash, boolean] // subscribeServicePreimage
  | [number, Hash, number, boolean] // subscribeServiceRequest

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
  isValid(hash: unknown): hash is Hash
  fromBase64(base64: string): Hash
  toBase64(hash: Hash): string
}

export interface BlobValidator {
  isValid(blob: unknown): blob is Blob
  fromBase64(base64: string): Blob
  toBase64(blob: Blob): string
}

export interface SlotValidator {
  isValid(slot: unknown): slot is bigint
  fromNumber(num: number): bigint
  toNumber(slot: bigint): number
}
