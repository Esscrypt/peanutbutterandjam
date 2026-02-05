//! PVM Rust implementation — NAPI bindings matching pvm-assemblyscript WASM API.
//! Structure mirrors packages/pvm-assemblyscript (config, types, codec, host_functions, instructions, pvm, ram).

#![allow(dead_code)]

/// Compile-time removable logging for host calls other than LOG(100). No-op unless built with `--features host_calls_logging`.
#[macro_export]
macro_rules! host_log {
    ($($t:tt)*) => {
        #[cfg(feature = "host_calls_logging")]
        eprintln!($($t)*);
    };
}

/// Log only on error paths (PANIC, HUH, FULL). Prints when `host_calls_errors_only` or `host_calls_logging` is enabled.
#[macro_export]
macro_rules! host_log_error {
    ($($t:tt)*) => {
        #[cfg(any(feature = "host_calls_logging", feature = "host_calls_errors_only"))]
        eprintln!($($t)*);
    };
}

mod config;
mod codec;
mod crypto;
mod host_functions;
mod instructions;
mod mock_ram;
mod parser;
mod pvm;
mod ram;
mod simple_ram;
mod state_wrapper;
mod types;

use napi::bindgen_prelude::{BigInt, *};
use napi_derive::napi;

use crate::codec::{decode_implications_pair, encode_implications_pair};
use crate::config::DEFAULT_GAS_LIMIT;
use crate::types::Ram;
use state_wrapper::{
    get_accumulation_context_encoded, get_state, init_memory_layout_impl, init_page_impl, init_state,
    next_step_impl, prepare_blob_impl, reset_state, run_blob_impl, set_memory_impl,
    setup_accumulate_from_preimage, SetupAccumulateParams, RAMType,
    Status,
};

// --- RAMType values (caller can use 0, 1, 2 or these getters) ---
#[napi]
pub fn get_ram_type_pvm_ram() -> i32 {
    RAMType::PvmRam as i32
}

#[napi]
pub fn get_ram_type_simple_ram() -> i32 {
    RAMType::SimpleRAM as i32
}

#[napi]
pub fn get_ram_type_mock_ram() -> i32 {
    RAMType::MockRAM as i32
}

// --- NAPI exports mirroring assembly/index.ts ---

#[napi]
pub fn init(ram_type: i32) {
    init_state(ram_type);
}

#[napi]
pub fn reset() {
    reset_state();
}

#[napi]
pub fn reset_generic(_program: Buffer, _registers: Buffer, _gas: u32) {
    reset_state();
}

#[napi]
pub fn reset_generic_with_memory(
    _program_ptr: Buffer,
    _registers_ptr: Buffer,
    _page_map_ptr: Buffer,
    _chunks_ptr: Buffer,
    _gas: u32,
) {
    reset_state();
}

#[napi]
pub fn next_step() -> bool {
    let mut g = get_state();
    g.as_mut().map_or(false, next_step_impl)
}

#[napi]
pub fn n_steps(steps: i32) -> bool {
    let mut g = get_state();
    let Some(state) = g.as_mut() else {
        return false;
    };
    let n = steps.max(0) as u32;
    for _ in 0..n {
        if !next_step_impl(state) {
            return false;
        }
    }
    true
}

#[napi]
pub fn run_blob(program: Buffer) {
    run_blob_impl(program.as_ref());
}

#[napi]
pub fn prepare_blob(program: Buffer) {
    prepare_blob_impl(program.as_ref());
}

/// AccumulateInvocationResult returned as object (gasConsumed, resultCode, output).
#[napi(object)]
pub struct AccumulateInvocationResultOutput {
    pub gas_consumed: u32,
    pub result_code: u8,
    pub output: Buffer,
}

#[napi]
pub fn accumulate_invocation(
    _gas_limit: u32,
    _program: Buffer,
    _args: Buffer,
    _context: Buffer,
    _num_cores: i32,
    _num_validators: i32,
    _auth_queue_size: i32,
    _entropy_accumulator: Buffer,
    _encoded_work_items: Buffer,
    _config_num_cores: i32,
    _config_preimage_expunge_period: u32,
    _config_epoch_duration: u32,
    _config_max_block_gas: i64,
    _config_tickets_per_validator: u16,
    _config_slot_duration: u16,
    _config_rotation_period: u16,
    _config_num_validators: u16,
) -> AccumulateInvocationResultOutput {
    let g = get_state();
    if g.is_none() {
        return AccumulateInvocationResultOutput {
            gas_consumed: 0,
            result_code: 1, // PANIC
            output: Vec::new().into(),
        };
    }
    AccumulateInvocationResultOutput {
        gas_consumed: 0,
        result_code: 1,
        output: Vec::new().into(),
    }
}

#[napi]
pub fn setup_accumulate_invocation(
    gas_limit: u32,
    program: Buffer,
    args: Buffer,
    context: Buffer,
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
    entropy_accumulator: Buffer,
    encoded_work_items: Buffer,
    encoded_accumulate_inputs: Option<Vec<Buffer>>,
    config_preimage_expunge_period: u32,
    config_epoch_duration: u32,
    config_max_block_gas: i64,
    config_max_refine_gas: i64,
    config_max_tickets_per_extrinsic: u16,
    config_tickets_per_validator: u16,
    config_slot_duration: u16,
    config_rotation_period: u16,
    config_num_ec_pieces_per_segment: u32,
    config_contest_duration: u32,
    config_max_lookup_anchorage: u32,
    config_ec_piece_size: u32,
) {
    let encoded_inputs = encoded_accumulate_inputs
        .map(|v| v.into_iter().map(|b| b.as_ref().to_vec()).collect());
    let params = SetupAccumulateParams {
        program: program.as_ref(),
        args: args.as_ref(),
        encoded_context: context.as_ref(),
        gas_limit,
        num_cores: num_cores.max(0) as u32,
        num_validators: num_validators.max(0) as u32,
        auth_queue_size: auth_queue_size.max(0) as u32,
        entropy_accumulator: entropy_accumulator.as_ref(),
        encoded_work_items: encoded_work_items.as_ref(),
        encoded_accumulate_inputs: encoded_inputs,
        config_preimage_expunge_period,
        config_epoch_duration,
        config_max_block_gas: config_max_block_gas.max(0) as u64,
        config_max_refine_gas: config_max_refine_gas.max(0) as u64,
        config_max_tickets_per_extrinsic,
        config_tickets_per_validator,
        config_slot_duration,
        config_rotation_period,
        config_num_ec_pieces_per_segment,
        config_contest_duration,
        config_max_lookup_anchorage,
        config_ec_piece_size,
    };
    setup_accumulate_from_preimage(params);
}

#[napi]
pub fn set_accumulate_inputs(inputs: Option<Vec<Buffer>>) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.accumulate_inputs_encoded = inputs
            .map(|v| v.into_iter().map(|b| b.as_ref().to_vec()).collect())
            .unwrap_or_default();
    }
}

#[napi]
pub fn set_fetch_work_package(encoded: Option<Buffer>) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.work_package_encoded = encoded.map(|b| b.as_ref().to_vec());
    }
}

#[napi]
pub fn set_fetch_auth_config(data: Option<Buffer>) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.auth_config = data.map(|b| b.as_ref().to_vec());
    }
}

#[napi]
pub fn set_fetch_auth_token(data: Option<Buffer>) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.auth_token = data.map(|b| b.as_ref().to_vec());
    }
}

#[napi]
pub fn set_fetch_refine_context(encoded: Option<Buffer>) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.refine_context_encoded = encoded.map(|b| b.as_ref().to_vec());
    }
}

#[napi]
pub fn set_fetch_work_item_summaries(summaries: Option<Vec<Buffer>>) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.work_item_summaries = summaries
            .map(|v| v.into_iter().map(|b| b.as_ref().to_vec()).collect());
    }
}

#[napi]
pub fn set_fetch_work_item_payloads(payloads: Option<Vec<Buffer>>) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.work_item_payloads = payloads
            .map(|v| v.into_iter().map(|b| b.as_ref().to_vec()).collect());
    }
}

#[napi(object)]
pub struct RunProgramResultOutput {
    pub gas_consumed: u32,
    pub result_code: u8,
}

#[napi]
pub fn run_program() -> RunProgramResultOutput {
    let mut g = get_state();
    let Some(state) = g.as_mut() else {
        return RunProgramResultOutput {
            gas_consumed: 0,
            result_code: 1,
        };
    };
    while next_step_impl(state) {}
    RunProgramResultOutput {
        gas_consumed: DEFAULT_GAS_LIMIT.saturating_sub(state.gas_left),
        result_code: state.result_code,
    }
}

#[napi]
pub fn get_program_counter() -> u32 {
    let g = get_state();
    g.as_ref().map_or(0, |s| s.program_counter)
}

#[napi]
pub fn set_next_program_counter(pc: u32) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.program_counter = pc;
    }
}

#[napi]
pub fn get_gas_left() -> u32 {
    let g = get_state();
    g.as_ref().map_or(0, |s| s.gas_left)
}

#[napi]
pub fn set_gas_left(gas: i64) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.gas_left = gas as u32;
    }
}

#[napi]
pub fn get_status() -> i32 {
    let g = get_state();
    g.as_ref()
        .map_or(Status::Panic as i32, |s| s.status as i32)
}

#[napi]
pub fn get_exit_arg() -> u32 {
    let g = get_state();
    g.as_ref().map_or(0, |s| s.exit_arg)
}

#[napi]
pub fn get_host_call_id() -> u32 {
    let g = get_state();
    g.as_ref().map_or(0, |s| s.host_call_id)
}

#[napi]
pub fn get_result_code() -> u32 {
    let g = get_state();
    g.as_ref().map_or(1, |s| s.result_code as u32)
}

/// Gray Paper equation 831: When HALT, result is the memory range [registers[7], registers[7]+registers[8]].
#[napi]
pub fn get_result() -> Buffer {
    let mut g = get_state();
    if let Some(state) = g.as_mut() {
        let offset = state.registers.get(7).copied().unwrap_or(0) as u32;
        let length = state.registers.get(8).copied().unwrap_or(0) as u32;
        if length == 0 {
            return Vec::new().into();
        }
        let read_result = state.ram.read_octets(offset, length);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return Vec::new().into();
        }
        return read_result.data.unwrap().into();
    }
    Vec::new().into()
}

/// Returns the 32-byte accumulation yield hash when set (e.g. by YIELD host).
/// Used when get_result() is empty (r7/r8 not set) but the run halted successfully with a yield.
#[napi]
pub fn get_yield_hash() -> Buffer {
    let g = get_state();
    g.as_ref()
        .and_then(|s| s.yield_hash.as_ref())
        .filter(|h| h.len() == 32)
        .cloned()
        .unwrap_or_default()
        .into()
}

#[napi]
pub fn get_last_opcode() -> u32 {
    let g = get_state();
    g.as_ref().map_or(0, |s| s.last_opcode as u32)
}

#[napi]
pub fn get_last_load_address() -> u32 {
    let g = get_state();
    g.as_ref().map_or(0, |s| s.last_load_address)
}

/// Returns last load value as BigInt so JS gets full u64 precision (see docs.rs/napi/struct.BigInt).
#[napi]
pub fn get_last_load_value() -> BigInt {
    let g = get_state();
    BigInt::from(g.as_ref().map_or(0, |s| s.last_load_value))
}

#[napi]
pub fn get_last_store_address() -> u32 {
    let g = get_state();
    g.as_ref().map_or(0, |s| s.last_store_address)
}

/// Returns last store value as BigInt so JS gets full u64 precision (see docs.rs/napi/struct.BigInt).
#[napi]
pub fn get_last_store_value() -> BigInt {
    let g = get_state();
    BigInt::from(g.as_ref().map_or(0, |s| s.last_store_value))
}

#[napi]
pub fn clear_last_memory_op() {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.last_load_address = 0;
        s.last_load_value = 0;
        s.last_store_address = 0;
        s.last_store_value = 0;
    }
}

/// Returns LOG host function messages since last drain and clears the queue. Executor should call after each step and forward to console.log.
#[napi]
pub fn get_and_clear_log_messages() -> Vec<String> {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        std::mem::take(&mut s.log_messages)
    } else {
        vec![]
    }
}

#[napi]
pub fn get_code() -> Buffer {
    let g = get_state();
    g.as_ref()
        .map_or(Vec::new(), |s| s.code.clone())
        .into()
}

#[napi]
pub fn get_bitmask() -> Buffer {
    let g = get_state();
    g.as_ref()
        .map_or(Vec::new(), |s| s.bitmask.clone())
        .into()
}

#[napi]
pub fn get_registers() -> Buffer {
    let g = get_state();
    let mut out = vec![0u8; 13 * 8];
    if let Some(s) = g.as_ref() {
        for (i, &r) in s.registers.iter().enumerate() {
            let start = i * 8;
            out[start..start + 8].copy_from_slice(&r.to_le_bytes());
        }
    }
    out.into()
}

#[napi]
pub fn set_registers(registers: Buffer) {
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        let buf = registers.as_ref();
        for (i, chunk) in buf.chunks_exact(8).take(13).enumerate() {
            let mut bytes = [0u8; 8];
            bytes.copy_from_slice(chunk);
            s.registers[i] = u64::from_le_bytes(bytes);
        }
    }
}

/// Single-register get; returns BigInt to match AS (getRegister returns u64 → bigint). i64 would become Number and lose precision.
#[napi]
pub fn get_register(index: u8) -> BigInt {
    if index >= 13 {
        return BigInt::from(0u64);
    }
    let g = get_state();
    BigInt::from(g.as_ref().map_or(0, |s| s.registers[index as usize]))
}

/// Single-register set; accepts BigInt to match AS (setRegister takes u64/bigint). i64 would truncate values above 2^53.
#[napi]
pub fn set_register(index: u8, value: BigInt) {
    if index >= 13 {
        return;
    }
    let (_, val, lossless) = value.get_u64();
    if !lossless {
        return; // value out of u64 range; ignore or could panic
    }
    let mut g = get_state();
    if let Some(s) = g.as_mut() {
        s.registers[index as usize] = val;
    }
}

#[napi]
pub fn get_page_dump(page_index: i32) -> Buffer {
    let g = get_state();
    g.as_ref()
        .map_or_else(
            || vec![0u8; 4096],
            |s| s.ram.get_page_dump(page_index as u32),
        )
        .into()
}

#[napi]
pub fn set_memory(address: u32, data: Buffer) {
    set_memory_impl(address, data.as_ref());
}

#[napi]
pub fn get_accumulation_context(
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Buffer {
    // Return full encoded implications pair (with updated accounts + yield) so caller can decode
    // and use as updated context, matching WASM getAccumulationContext.
    if let Some(encoded) = get_accumulation_context_encoded(num_cores, num_validators, auth_queue_size) {
        return encoded.into();
    }
    // Fallback: yield hash only (legacy 32-byte return)
    let g = get_state();
    g.as_ref()
        .and_then(|s| s.yield_hash.as_ref())
        .filter(|h| h.len() == 32)
        .cloned()
        .unwrap_or_default()
        .into()
}

#[napi]
pub fn has_accumulation_context() -> bool {
    let g = get_state();
    g.as_ref().map_or(false, |s| s.has_accumulation_context)
}

#[napi]
pub fn init_page(address: u32, length: u32, access_type: u8) {
    init_page_impl(address, length, access_type);
}

/// Initialize memory layout (Gray Paper 770–802) on current state's RAM. Use with PvmRam after prepareBlob so heap at 0x20000 etc. exist.
#[napi]
pub fn init_memory_layout(
    argument_data: Buffer,
    read_only_data: Buffer,
    read_write_data: Buffer,
    stack_size: u32,
    heap_zero_padding_size: u32,
) {
    init_memory_layout_impl(
        argument_data.as_ref(),
        read_only_data.as_ref(),
        read_write_data.as_ref(),
        stack_size,
        heap_zero_padding_size,
    );
}

#[napi]
pub fn initialize_program(_program: Buffer, _args: Buffer) {
    let g = get_state();
    if g.is_none() {
        init_state(RAMType::PvmRam as i32);
    }
}

// --- Codec helpers for equivalence tests (TS/AS vs Rust) ---

/// Encode value as little-endian fixed length (1, 2, 4, 8, 16, or 32 bytes). Matches @pbnjam/codec encodeFixedLength.
/// Value is passed as i64 (NAPI does not support u64); interpreted as u64 bit pattern.
#[napi]
pub fn encode_fixed_length(value: i64, length: i32) -> Buffer {
    let bytes = crate::codec::encode_fixed_length(value as u64, length);
    bytes.into()
}

/// Decode implications pair from bytes, re-encode to bytes. For round-trip equivalence tests (TS encode -> Rust decode+encode -> TS decode).
#[napi]
pub fn round_trip_implications(
    data: Buffer,
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Option<Buffer> {
    let pair_result = decode_implications_pair(
        data.as_ref(),
        num_cores,
        num_validators,
        auth_queue_size,
    )?;
    let encoded = encode_implications_pair(
        &pair_result.value,
        num_cores,
        num_validators,
        auth_queue_size,
    );
    Some(encoded.into())
}
