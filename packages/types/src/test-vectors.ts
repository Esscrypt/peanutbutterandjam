import type { Hex } from "@pbnj/core"

import type { Assurance, WorkReport } from "./serialization"

export interface AccumulateTestVector {
  input: {
    slot: number
    reports: Array<{
      package_spec: {
        hash: string
        length: number
        erasure_root: string
        exports_root: string
        exports_count: number
      }
      context: {
        anchor: string
        state_root: string
        beefy_root: string
        lookup_anchor: string
        lookup_anchor_slot: number
        prerequisites: any[]
      }
      core_index: number
      authorizer_hash: string
      auth_gas_used: number
      auth_output: string
      segment_root_lookup: any[]
      results: Array<{
        service_id: number
        code_hash: string
        payload_hash: string
        accumulate_gas: number
        result: {
          ok?: string
          err?: null
        }
        refine_load: {
          gas_used: number
          imports: number
          extrinsic_count: number
          extrinsic_size: number
          exports: number
          accumulate_count: number
          accumulate_gas_used: number
        }
      }>
    }>
  }
  pre_state: {
    slot: number
    entropy: string
    ready_queue: any[][]
    accumulated: any[][]
    privileges: {
      bless: number
      assign: number[]
      designate: number
      register: number
      always_acc: number[]
    }
    statistics: any[]
    accounts: Array<{
      id: number
      data: {
        service: {
          version: number
          code_hash: string
          balance: number
          min_item_gas: number
          min_memo_gas: number
          bytes: number
          deposit_offset: number
          items: number
          creation_slot: number
          last_accumulation_slot: number
          parent_service: number
        }
        storage: Array<{
          key: string
          value: string
        }>
        preimages_blob: Array<{
          hash: string
          blob: string
        }>
        preimages_status: Array<{
          hash: string
          status: number[]
        }>
      }
    }>
  }
  output: {
    ok?: string
    err?: null
  }
  post_state: any
}

/**
 * Type definitions for JAM test vectors
 * Used for validating Gray Paper implementation against official test vectors
 */

/**
 * Complete recent history test vector
 * Used for progress_blocks_history test vectors
 */
export interface RecentHistoryTestVector {
  input: {
    header_hash: string
    parent_state_root: string
    accumulate_root: string
    work_packages: {
      hash: string
      exports_root: string
    }[]
  }
  pre_state: {
    beta: {
      history: {
        header_hash: string
        beefy_root: string
        state_root: string | null
        reported: {
          hash: string
          exports_root: string
        }[]
      }[]
      mmr: {
        peaks: (string | null)[]
      }
    }
  }
  output: null | unknown
  post_state: {
    beta: {
      history: {
        header_hash: string
        beefy_root: string
        state_root: string | null
        reported: {
          hash: string
          exports_root: string
        }[]
      }[]
      mmr: {
        peaks: (string | null)[]
      }
    }
  }
}

// Test vector interface based on observed structure
export interface AssuranceTestVector {
  input: {
    assurances: Assurance[]
    slot: number
    parent: Hex
  }
  pre_state: {
    avail_assignments: Array<{
      report: WorkReport
      timeout: number
    } | null>
    curr_validators: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
  }
  output: {
    ok?: unknown
    err?: string
  } | null
  post_state: {
    avail_assignments: Array<{
      report: WorkReport
      timeout: number
    } | null>
    curr_validators: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
  }
}