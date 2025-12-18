import type { Hex } from '@pbnjam/core'

import type { Assurance, WorkReport } from './serialization'

export interface AccumulateTestVector {
  input: {
    slot: number
    reports: WorkReport[]
  }
  pre_state: {
    slot: number
    entropy: string
    ready_queue: Array<
      Array<{
        report: WorkReport
        dependencies: Hex[]
      }>
    >
    accumulated: Hex[][]
    privileges: {
      bless: number
      assign: number[]
      designate: number
      register: number
      always_acc: number[]
    }
    statistics: Array<{
      id: number
      record: {
        provided_count: number
        provided_size: number
        refinement_count: number
        refinement_gas_used: number
        imports: number
        extrinsic_count: number
        extrinsic_size: number
        exports: number
        accumulate_count: number
        accumulate_gas_used: number
      }
    }>
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
  post_state: {
    slot: number
    entropy: string
    ready_queue: Array<
      Array<{
        report: WorkReport
        dependencies: Hex[]
      }>
    >
    accumulated: Hex[][]
    privileges: {
      bless: number
      assign: number[]
      designate: number
      register: number
      always_acc: number[]
    }
    statistics: Array<{
      id: number
      record: {
        provided_count: number
        provided_size: number
        refinement_count: number
        refinement_gas_used: number
        imports: number
        extrinsic_count: number
        extrinsic_size: number
        exports: number
        accumulate_count: number
        accumulate_gas_used: number
      }
    }>
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
        header_hash: Hex
        beefy_root: Hex
        state_root: Hex | null
        reported: {
          hash: Hex
          exports_root: Hex
        }[]
      }[]
      mmr: {
        peaks: (Hex | null)[]
      }
    }
  }
  output: null | unknown
  post_state: {
    beta: {
      history: {
        header_hash: Hex
        beefy_root: Hex
        state_root: Hex | null
        reported: {
          hash: Hex
          exports_root: Hex
        }[]
      }[]
      mmr: {
        peaks: (Hex | null)[]
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

/**
 * Disputes test vector interface
 * Based on disputes.asn schema and test vector structure
 */
export interface DisputesTestVector {
  input: {
    disputes: {
      verdicts: Array<{
        target: Hex
        age: number
        votes: Array<{
          vote: boolean
          index: number
          signature: Hex
        }>
      }>
      culprits: Array<{
        target: Hex
        key: Hex
        signature: Hex
      }>
      faults: Array<{
        target: Hex
        vote: boolean
        key: Hex
        signature: Hex
      }>
    }
  }
  pre_state: {
    psi: {
      good: Hex[]
      bad: Hex[]
      wonky: Hex[]
      offenders: Hex[]
    }
    rho: Array<{
      report: WorkReport
      timeout: number
    } | null>
    tau: number
    kappa: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
    lambda: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
  }
  output: {
    ok?: {
      offenders_mark: Hex[]
    }
    err?: string
  }
  post_state: {
    psi: {
      good: Hex[]
      bad: Hex[]
      wonky: Hex[]
      offenders: Hex[]
    }
    rho: Array<{
      report: WorkReport
      timeout: number
    } | null>
    tau: number
    kappa: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
    lambda: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
  }
}

/**
 * Preimages test vector interface
 * Mirrors stf/preimages JSON structure from jam-test-vectors
 */
export interface PreimagesTestVector {
  input: {
    preimages: Array<{
      requester: number
      blob: Hex
    }>
    slot: number
  }
  pre_state: {
    accounts: Array<{
      id: number
      data: {
        preimages: Array<{
          hash: Hex
          blob: Hex
        }>
        lookup_meta: Array<{
          key: {
            hash: Hex
            length: number
          }
          value: number[]
        }>
      }
    }>
    statistics: unknown[]
  }
  output: {
    ok?: null
    err?: string
  }
  post_state: {
    accounts: Array<{
      id: number
      data: {
        preimages: Array<{
          hash: Hex
          blob: Hex
        }>
        lookup_meta: Array<{
          key: {
            hash: Hex
            length: number
          }
          value: number[]
        }>
      }
    }>
    statistics: unknown[]
  }
}

/**
 * Reports test vector interface (subset used by tests)
 */
export interface ReportsTestVector {
  input: {
    guarantees: Array<{
      report: WorkReport
      slot: number
      signatures: Array<{ validator_index: number; signature: Hex }>
    }>
    slot: number
    known_packages: Hex[]
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
    prev_validators: {
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }[]
    entropy: Hex[]
    offenders: Hex[]
    recent_blocks: {
      history: Array<{
        header_hash: Hex
        beefy_root: Hex
        state_root: Hex
        reported: Array<{ hash: Hex; exports_root: Hex }>
      }>
      mmr: { peaks: Array<Hex | null> }
    }
    auth_pools: Hex[][]
    accounts: Array<{
      id: number
      data: {
        service: {
          version: number
          code_hash: Hex
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
      }
    }>
    cores_statistics: Array<{
      da_load: number
      popularity: number
      imports: number
      extrinsic_count: number
      extrinsic_size: number
      exports: number
      bundle_size: number
      gas_used: number
    }>
    services_statistics: Array<{
      id: number
      record: {
        provided_count: number
        provided_size: number
        refinement_count: number
        refinement_gas_used: number
        imports: number
        extrinsic_count: number
        extrinsic_size: number
        exports: number
        accumulate_count: number
        accumulate_gas_used: number
      }
    }>
  }
  output: { ok?: unknown; err?: string }
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
    prev_validators: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
    entropy: Hex[]
    offenders: Hex[]
    recent_blocks: {
      history: Array<{
        header_hash: Hex
        beefy_root: Hex
        state_root: Hex
        reported: Array<{ hash: Hex; exports_root: Hex }>
      }>
      mmr: { peaks: Array<Hex | null> }
    }
    auth_pools: Hex[][]
    accounts: Array<{
      id: number
      data: {
        service: {
          version: number
          code_hash: Hex
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
      }
    }>
    cores_statistics: Array<{
      da_load: number
      popularity: number
      imports: number
      extrinsic_count: number
      extrinsic_size: number
      exports: number
      bundle_size: number
      gas_used: number
    }>
    services_statistics: Array<{
      id: number
      record: {
        provided_count: number
        provided_size: number
        refinement_count: number
        refinement_gas_used: number
        imports: number
        extrinsic_count: number
        extrinsic_size: number
        exports: number
        accumulate_count: number
        accumulate_gas_used: number
      }
    }>
  }
}

/**
 * Statistics test vector interface
 * Matches stf/statistics JSON structure (e.g., stats_with_some_extrinsic-1.json)
 */
export interface StatisticsTestVector {
  input: {
    slot: number
    author_index: number
    extrinsic: {
      tickets: Array<{
        attempt: number
        signature: Hex
      }>
      preimages: Array<{
        requester: number
        blob: Hex
      }>
      guarantees: Array<{
        report: WorkReport
        slot: number
        signatures: Array<{ validator_index: number; signature: Hex }>
      }>
      assurances: Array<{
        anchor: Hex
        bitfield: Hex
        validator_index: number
        signature: Hex
      }>
      disputes: {
        verdicts: Array<{
          target: Hex
          age: number
          votes: Array<{ vote: boolean; index: number; signature: Hex }>
        }>
        culprits: Array<{
          target: Hex
          key: Hex
          signature: Hex
        }>
        faults: Array<{
          target: Hex
          vote: boolean
          key: Hex
          signature: Hex
        }>
      }
    }
  }
  pre_state: {
    vals_curr_stats: Array<{
      blocks: number
      tickets: number
      pre_images: number
      pre_images_size: number
      guarantees: number
      assurances: number
    }>
    vals_last_stats: Array<{
      blocks: number
      tickets: number
      pre_images: number
      pre_images_size: number
      guarantees: number
      assurances: number
    }>
    slot: number
    curr_validators: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
  }
  output: unknown | null
  post_state: {
    vals_curr_stats: Array<{
      blocks: number
      tickets: number
      pre_images: number
      pre_images_size: number
      guarantees: number
      assurances: number
    }>
    vals_last_stats: Array<{
      blocks: number
      tickets: number
      pre_images: number
      pre_images_size: number
      guarantees: number
      assurances: number
    }>
    slot: number
    curr_validators: Array<{
      bandersnatch: Hex
      ed25519: Hex
      bls: Hex
      metadata: Hex
    }>
  }
}

/**
 * Block trace test vector interface
 * Based on traces/fallback/00000001.json structure
 * Used for testing complete block processing and state transitions
 */
export interface BlockTraceTestVector {
  pre_state: {
    state_root: Hex
    keyvals: Array<{
      key: Hex
      value: Hex
    }>
  }
  block: {
    header: {
      parent: Hex
      parent_state_root: Hex
      extrinsic_hash: Hex
      slot: number
      epoch_mark: {
        entropy: Hex
        tickets_entropy: Hex
        validators: Array<{
          bandersnatch: Hex
          ed25519: Hex
        }>
      } | null
      tickets_mark: Array<{
        id: Hex
        entry_index: number
      }> | null
      author_index: number
      entropy_source: Hex
      offenders_mark: Hex[]
      seal: Hex
    }
    extrinsic: {
      tickets: Array<{
        attempt: number
        signature: Hex
      }>
      preimages: Array<{
        requester: number
        blob: Hex
      }>
      guarantees: Array<{
        report: WorkReport
        slot: number
        signatures: Array<{
          validator_index: number
          signature: Hex
        }>
      }>
      assurances: Array<{
        anchor: Hex
        bitfield: Hex
        validator_index: number
        signature: Hex
      }>
      disputes: {
        verdicts: Array<{
          target: Hex
          age: number
          votes: Array<{
            vote: boolean
            index: number
            signature: Hex
          }>
        }>
        culprits: Array<{
          target: Hex
          key: Hex
          signature: Hex
        }>
        faults: Array<{
          target: Hex
          vote: boolean
          key: Hex
          signature: Hex
        }>
      }
    }
  }
  post_state: {
    state_root: Hex
    keyvals: Array<{
      key: Hex
      value: Hex
    }>
  }
}
