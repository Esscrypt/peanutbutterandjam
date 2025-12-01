import type { Hex } from 'viem'
import type { Block } from './block-authoring'
import type { BlockHeader } from './global-state'

/**
 * JAM Conformance Testing Protocol (Fuzzer) Message Types
 * Reference: https://github.com/gavofyork/graypaper/blob/main/fuzz/fuzz-v1.asn
 */

/**
 * Message variant discriminants
 */
export enum FuzzMessageType {
  PeerInfo = 'PeerInfo',
  Initialize = 'Initialize',
  StateRoot = 'StateRoot',
  ImportBlock = 'ImportBlock',
  GetState = 'GetState',
  State = 'State',
  Error = 'Error',
}

export interface JamVersion {
  major: number
  minor: number
  patch: number
}

export interface AppVersion {
  major: number
  minor: number
  patch: number
}

export interface FuzzPeerInfo {
  fuzz_version: number
  fuzz_features: number
  jam_version: JamVersion
  app_version: AppVersion
  app_name: string
}

export interface StateRoot {
  state_root: Hex
}

export interface ErrorMessage {
  error: string
}

/**
 * KeyValue pair for state storage
 * Key is 31 bytes, value is variable length
 */
export interface KeyValue {
  key: Hex // 31-byte trie key
  value: Hex // Variable length value
}

/**
 * FuzzState is a sequence of KeyValue pairs for fuzzer protocol
 */
export type FuzzState = KeyValue[]

/**
 * AncestryItem represents a block in the ancestry chain
 */
export interface AncestryItem {
  slot: bigint // TimeSlot (U32)
  header_hash: Hex // HeaderHash (32 bytes)
}

/**
 * Ancestry is a sequence of AncestryItem (0-24 items)
 * Empty when feature-ancestry is not supported
 */
export type Ancestry = AncestryItem[]

/**
 * Initialize message contains:
 * - header: "genesis-like" header whose hash can be used to reference state
 * - keyvals: Sequence of key-values (FuzzState)
 * - ancestry: Ancestry sequence (includes header hash)
 */
export interface Initialize {
  header: BlockHeader
  keyvals: FuzzState
  ancestry: Ancestry
}

export interface ImportBlock {
  block: Block
}

export interface GetState {
  block_hash: Hex
}

/**
 * State message response for GetState request
 */
export interface FuzzerState {
  keyvals: FuzzState
}

export type FuzzMessage =
  | { type: FuzzMessageType.PeerInfo; payload: FuzzPeerInfo }
  | { type: FuzzMessageType.Initialize; payload: Initialize }
  | { type: FuzzMessageType.StateRoot; payload: StateRoot }
  | { type: FuzzMessageType.ImportBlock; payload: ImportBlock }
  | { type: FuzzMessageType.GetState; payload: GetState }
  | { type: FuzzMessageType.State; payload: FuzzerState }
  | { type: FuzzMessageType.Error; payload: ErrorMessage }

/**
 * Default latest JAM version for privileges encoding/decoding
 * Defaults to v0.7.2 (latest Gray Paper version with registrar field)
 */
export const DEFAULT_JAM_VERSION: JamVersion = { major: 0, minor: 7, patch: 2 }
