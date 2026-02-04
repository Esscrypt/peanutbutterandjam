//! Host function base types and trait (mirrors assembly/host-functions/general/base.ts and accumulate/base.ts).

use crate::codec::{AlwaysAccerEntry, CompleteServiceAccount, ProvisionEntry};
use crate::config::{FetchSystemConstantsConfig, RESULT_CODE_FAULT, RESULT_CODE_HALT, RESULT_CODE_OOG, RESULT_CODE_PANIC};
use crate::host_functions::refine::RefineContext;
use crate::types::{RegisterState, Ram};
use std::collections::HashMap;

/// Sentinel for "continue execution" (Gray Paper: 255).
pub const HOST_RESULT_CONTINUE: u8 = 255;

/// Result of a host function call. 255 = continue; 0-5 = halt/panic/fault/oog.
#[derive(Clone, Debug)]
pub struct HostFunctionResult {
    pub result_code: u8,
}

impl HostFunctionResult {
    #[must_use]
    pub const fn continue_execution() -> Self {
        Self {
            result_code: HOST_RESULT_CONTINUE,
        }
    }

    #[must_use]
    pub const fn halt() -> Self {
        Self {
            result_code: RESULT_CODE_HALT,
        }
    }

    #[must_use]
    pub const fn panic() -> Self {
        Self {
            result_code: RESULT_CODE_PANIC,
        }
    }

    #[must_use]
    pub const fn fault() -> Self {
        Self {
            result_code: RESULT_CODE_FAULT,
        }
    }

    #[must_use]
    pub const fn oog() -> Self {
        Self {
            result_code: RESULT_CODE_OOG,
        }
    }

    #[must_use]
    pub const fn should_continue(&self) -> bool {
        self.result_code == HOST_RESULT_CONTINUE
    }
}

/// State slice for BLESS (Ω_B). When provided, host updates manager, delegator, registrar, assigners, alwaysaccers.
#[derive(Default)]
pub struct BlessState {
    pub manager: u32,
    pub delegator: u32,
    pub registrar: u32,
    pub assigners: Vec<u32>,
    pub alwaysaccers: Vec<AlwaysAccerEntry>,
}

/// State slice for ASSIGN (Ω_A). assigners[c] = service ID for core c; authqueue[c] = 80 entries of 32 bytes each.
#[derive(Default)]
pub struct AssignState {
    pub assigners: Vec<u32>,
    /// Per core: 80 entries of 32 bytes (Cauthqueuesize × 32).
    pub authqueue: Vec<Vec<Vec<u8>>>,
}

/// Context passed to host functions (registers, ram, gas). Mirrors HostFunctionContext.
/// Optional params (service_id, service_account, accounts) are set by refine/accumulate executors for LOOKUP/READ/WRITE/INFO/HISTORICAL_LOOKUP.
pub struct HostFunctionContext<'a> {
    pub registers: &'a mut RegisterState,
    pub ram: &'a mut dyn Ram,
    pub gas_remaining: &'a mut u32,
    /// Current service ID (for LOOKUP, READ, WRITE, INFO, HISTORICAL_LOOKUP when params provided).
    pub service_id: Option<u64>,
    /// Current service account, mutable for WRITE (when params provided).
    pub service_account: Option<&'a mut CompleteServiceAccount>,
    /// All accounts map for resolving service by ID. Mutable for NEW (insert new service).
    pub accounts: Option<&'a mut HashMap<u64, CompleteServiceAccount>>,
    /// Manager service ID (imX.state.manager). Only manager can create gratis services; when provided.
    pub manager_id: Option<u64>,
    /// Registrar service ID (imX.state.registrar). Registrar can create reserved-ID services; when provided.
    pub registrar_id: Option<u64>,
    /// Next free service ID (imX.nextfreeid). Updated by NEW when allocating public ID; when provided.
    pub nextfreeid: Option<&'a mut u32>,
    /// Timeslot for historical lookup (HISTORICAL_LOOKUP when params provided).
    pub lookup_timeslot: Option<u64>,
    /// Current timeslot for accumulation (SOLICIT when appending to [x,y]; when params provided).
    pub timeslot: Option<u64>,
    /// Expunge period for FORGET (y < t - Cexpungeperiod; when params provided).
    pub expunge_period: Option<u64>,
    /// Refine context (m, e) for export, machine, peek, poke, pages, invoke, expunge (when provided).
    pub refine_context: Option<&'a mut dyn RefineContext>,
    /// Accumulation yield hash (32 bytes). Set by YIELD host when has_accumulation_context (when provided).
    pub yield_hash: Option<&'a mut Option<Vec<u8>>>,
    /// Accumulation provisions (PROVIDE adds (service_id, preimage) when provided).
    pub provisions: Option<&'a mut Vec<ProvisionEntry>>,
    /// Delegator service ID (imX.state.delegator). Only delegator can DESIGNATE; when provided.
    pub delegator_id: Option<u64>,
    /// Cvalcount from config. Used by DESIGNATE for validators array size; when provided.
    pub num_validators: Option<u32>,
    /// Staging set (imX.state.stagingset). DESIGNATE updates with new validators; when provided.
    pub stagingset: Option<&'a mut Vec<Vec<u8>>>,
    /// Set to true by CHECKPOINT host when accumulation context present; executor copies regular → exceptional.
    pub checkpoint_requested: Option<&'a mut bool>,
    /// Ccorecount from config. Used by BLESS/ASSIGN for assigners array size; when provided.
    pub num_cores: Option<u32>,
    /// State slice for BLESS. Host writes manager, delegator, registrar, assigners, alwaysaccers; when provided.
    pub bless_state: Option<&'a mut BlessState>,
    /// State slice for ASSIGN. Host updates assigners[c] and authqueue[c]; when provided.
    pub assign_state: Option<&'a mut AssignState>,
    /// FETCH selector 1: entropy accumulator (n); when provided.
    pub fetch_entropy_accumulator: Option<&'a [u8]>,
    /// FETCH selector 2: authorizer trace (r); when provided.
    pub fetch_authorizer_trace: Option<&'a [u8]>,
    /// FETCH selector 3,4: export segments [work_item][extrinsic_index]; when provided.
    pub fetch_export_segments: Option<&'a [Vec<Vec<u8>>]>,
    /// FETCH selector 5,6: import segments [work_item][segment_index]; when provided.
    pub fetch_import_segments: Option<&'a [Vec<Vec<u8>>]>,
    /// FETCH selector 4,6: work item index (sentinel u64::MAX = not set); when provided.
    pub fetch_work_item_index: Option<u64>,
    /// FETCH selectors 14,15: accumulate inputs as pre-encoded AccumulateInput bytes per item; when provided.
    pub fetch_accumulate_inputs: Option<&'a [Vec<u8>]>,
    /// FETCH selector 7: encoded work package (encodeWorkPackage(p)); when provided.
    pub fetch_work_package_encoded: Option<&'a [u8]>,
    /// FETCH selector 8: work package auth config blob; when provided.
    pub fetch_auth_config: Option<&'a [u8]>,
    /// FETCH selector 9: work package auth token blob; when provided.
    pub fetch_auth_token: Option<&'a [u8]>,
    /// FETCH selector 10: encoded refine context (encodeRefineContext(p.context)); when provided.
    pub fetch_refine_context_encoded: Option<&'a [u8]>,
    /// FETCH selectors 11,12: work item summaries (encoded S(w) per item); selector 11 = var seq, 12 = by index; when provided.
    pub fetch_work_item_summaries: Option<&'a [Vec<u8>]>,
    /// FETCH selector 13: work item payloads; when provided.
    pub fetch_work_item_payloads: Option<&'a [Vec<u8>]>,
    /// LOG host function: push formatted messages here; executor drains via get_and_clear_log_messages().
    pub log_messages: Option<&'a mut Vec<String>>,
    /// FETCH selector 0 (system constants). When provided, used instead of handler default.
    pub fetch_system_constants_config: Option<&'a FetchSystemConstantsConfig>,
}

/// Trait for host function implementations (general and accumulate).
pub trait HostFunction: Send + Sync {
    /// Function ID (FUNC_* constant).
    fn function_id(&self) -> u8;
    /// Human-readable name.
    fn name(&self) -> &'static str;
    /// Execute the host function. May mutate context (registers, ram, gas).
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult;
}
