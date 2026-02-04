//! Helpers for accumulate host functions (mirrors assembly/host-functions/accumulate/base.ts).
//! No AccumulateHostFunctionContext in Rust; implementations use HostFunctionContext and set
//! register error codes (REG_WHO, REG_HUH, etc.) when they would need implications.


/// Set r7 to an accumulate error code (1:1 with AS setAccumulateError).
#[inline]
pub fn set_accumulate_error(registers: &mut [u64; 13], code: u64) {
    registers[7] = code;
}

/// Set r7 to success value (e.g. REG_OK or gas counter). (1:1 with AS setAccumulateSuccess.)
#[inline]
pub fn set_accumulate_success(registers: &mut [u64; 13], value: u64) {
    registers[7] = value;
}

/// Accumulate error codes for use in host functions (u64 for registers[7]).
/// Matches TS ACCUMULATE_ERROR_CODES; used in set_accumulate_error / set_accumulate_success.
pub mod codes {
    use crate::config::{
        REG_CASH, REG_CORE, REG_FULL, REG_HUH, REG_LOW, REG_NONE, REG_OOB, REG_OK, REG_WHO,
    };
    pub const NONE: u64 = REG_NONE;
    /// Success; TS: setAccumulateSuccess(registers) in forget, eject, bless, assign, provide, etc.
    #[allow(dead_code)]
    pub const OK: u64 = REG_OK;
    pub const WHO: u64 = REG_WHO;
    pub const OOB: u64 = REG_OOB;
    /// FULL = e.g. write/export; TS write.ts/export.ts; Rust general/write.rs and export.rs use config::REG_FULL directly.
    #[allow(dead_code)]
    pub const FULL: u64 = REG_FULL;
    pub const CORE: u64 = REG_CORE;
    /// Insufficient funds; TS transfer can return it when full logic is implemented.
    #[allow(dead_code)]
    pub const CASH: u64 = REG_CASH;
    /// Gas limit too low; TS transfer sets when gasLimit < destService.minmemogas; Rust transfer when r9 (gas_limit) == 0.
    pub const LOW: u64 = REG_LOW;
    pub const HUH: u64 = REG_HUH;
}

/// Ccorecount used by BLESS/ASSIGN when no config (match AS default).
pub const DEFAULT_NUM_CORES: u32 = 341;

/// Cauthqueuesize (80) for ASSIGN auth queue size.
pub const C_AUTH_QUEUE_SIZE: u32 = 80;

/// Validator size in bytes for DESIGNATE (336).
pub const VALIDATOR_SIZE: u32 = 336;

/// Cvalcount when no config (match AS default).
pub const DEFAULT_NUM_VALIDATORS: u32 = 1023;

/// Max service ID (2^32). Gray Paper: serviceid ≡ Nbits{32}.
pub const MAX_SERVICE_ID: u64 = 4_294_967_296;
