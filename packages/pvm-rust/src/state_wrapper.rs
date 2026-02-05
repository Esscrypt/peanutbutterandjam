//! Singleton PVM state wrapper (mirrors PVMWasmWrapper in assembly/wasm-wrapper.ts).
//! Holds global state and drives step/run_blob.

use crate::codec::{
    decode_blob, decode_accumulate_args, decode_implications_pair, decode_program_from_preimage,
    encode_implications_pair,
    AccountEntry, CompleteServiceAccount, DeferredTransfer, Implications, ImplicationsPair,
    PartialState, ProvisionEntry,
};
use crate::config::{
    FetchSystemConstantsConfig, ARGS_SEGMENT_START, DEFAULT_GAS_LIMIT, HALT_ADDRESS,
    RESULT_CODE_FAULT, RESULT_CODE_HALT, RESULT_CODE_HOST, RESULT_CODE_OOG, RESULT_CODE_PANIC,
    STACK_SEGMENT_END,
};
use crate::host_functions::base::HostFunctionContext;
use crate::host_functions::get_host_function;
use crate::instructions::registry::InstructionRegistry;
use crate::instructions::registry_instructions::register_all_instructions;
use crate::mock_ram::MockRam;
use crate::parser::PvmParser;
use crate::ram::PvmRam;
use crate::simple_ram::SimpleRam;
use crate::types::{InstructionContext, InstructionResult, MemoryAccessType, Ram, RegisterState};
use std::collections::HashMap;
use std::sync::Mutex;

/// Execution status (mirrors Status enum in wasm-wrapper.ts).
#[repr(i32)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Ok = 0,
    Halt = 1,
    Panic = 2,
    Fault = 3,
    Host = 4,
    Oog = 5,
}

/// RAM type (mirrors RAMType in assembly/index.ts).
#[repr(i32)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RAMType {
    PvmRam = 0,
    SimpleRAM = 1,
    MockRAM = 2,
}

/// RAM backend enum for state: one of the three implementations.
pub enum RamEnum {
    Pvm(PvmRam),
    Simple(SimpleRam),
    Mock(MockRam),
}

impl Ram for RamEnum {
    fn read_octets(&mut self, address: u32, count: u32) -> crate::types::ReadResult {
        match self {
            RamEnum::Pvm(r) => r.read_octets(address, count),
            RamEnum::Simple(r) => r.read_octets(address, count),
            RamEnum::Mock(r) => r.read_octets(address, count),
        }
    }
    fn write_octets(&mut self, address: u32, values: &[u8]) -> crate::types::WriteResult {
        match self {
            RamEnum::Pvm(r) => r.write_octets(address, values),
            RamEnum::Simple(r) => r.write_octets(address, values),
            RamEnum::Mock(r) => r.write_octets(address, values),
        }
    }
    fn current_heap_pointer(&self) -> u32 {
        match self {
            RamEnum::Pvm(r) => r.current_heap_pointer(),
            RamEnum::Simple(r) => r.current_heap_pointer(),
            RamEnum::Mock(r) => r.current_heap_pointer(),
        }
    }
    fn set_current_heap_pointer(&mut self, value: u32) {
        match self {
            RamEnum::Pvm(r) => r.set_current_heap_pointer(value),
            RamEnum::Simple(r) => r.set_current_heap_pointer(value),
            RamEnum::Mock(r) => r.set_current_heap_pointer(value),
        }
    }
    fn allocate_pages(&mut self, start_page: u32, count: u32) {
        match self {
            RamEnum::Pvm(r) => r.allocate_pages(start_page, count),
            RamEnum::Simple(r) => r.allocate_pages(start_page, count),
            RamEnum::Mock(r) => r.allocate_pages(start_page, count),
        }
    }
    fn is_readable_with_fault(&self, address: u32, size: u32) -> crate::types::FaultCheckResult {
        match self {
            RamEnum::Pvm(r) => r.is_readable_with_fault(address, size),
            RamEnum::Simple(r) => r.is_readable_with_fault(address, size),
            RamEnum::Mock(r) => r.is_readable_with_fault(address, size),
        }
    }
    fn initialize_memory_layout(
        &mut self,
        argument_data: &[u8],
        read_only_data: &[u8],
        read_write_data: &[u8],
        stack_size: u32,
        heap_zero_padding_size: u32,
    ) {
        match self {
            RamEnum::Pvm(r) => r.initialize_memory_layout(argument_data, read_only_data, read_write_data, stack_size, heap_zero_padding_size),
            RamEnum::Simple(r) => r.initialize_memory_layout(argument_data, read_only_data, read_write_data, stack_size, heap_zero_padding_size),
            RamEnum::Mock(r) => r.initialize_memory_layout(argument_data, read_only_data, read_write_data, stack_size, heap_zero_padding_size),
        }
    }
    fn is_writable_with_fault(&self, address: u32, size: u32) -> crate::types::FaultCheckResult {
        match self {
            RamEnum::Pvm(r) => r.is_writable_with_fault(address, size),
            RamEnum::Simple(r) => r.is_writable_with_fault(address, size),
            RamEnum::Mock(r) => r.is_writable_with_fault(address, size),
        }
    }
    fn set_page_access_rights(&mut self, address: u32, length: u32, access_type: MemoryAccessType) {
        match self {
            RamEnum::Pvm(r) => r.set_page_access_rights(address, length, access_type),
            RamEnum::Simple(r) => r.set_page_access_rights(address, length, access_type),
            RamEnum::Mock(r) => r.set_page_access_rights(address, length, access_type),
        }
    }
    fn init_page(&mut self, address: u32, length: u32, access_type: MemoryAccessType) {
        match self {
            RamEnum::Pvm(r) => r.init_page(address, length, access_type),
            RamEnum::Simple(r) => r.init_page(address, length, access_type),
            RamEnum::Mock(r) => r.init_page(address, length, access_type),
        }
    }
    fn write_octets_during_initialization(&mut self, address: u32, values: &[u8]) {
        match self {
            RamEnum::Pvm(r) => r.write_octets_during_initialization(address, values),
            RamEnum::Simple(r) => r.write_octets_during_initialization(address, values),
            RamEnum::Mock(r) => r.write_octets_during_initialization(address, values),
        }
    }
    fn get_page_dump(&self, page_index: u32) -> Vec<u8> {
        match self {
            RamEnum::Pvm(r) => r.get_page_dump(page_index),
            RamEnum::Simple(r) => r.get_page_dump(page_index),
            RamEnum::Mock(r) => r.get_page_dump(page_index),
        }
    }
    fn reset(&mut self) {
        match self {
            RamEnum::Pvm(r) => r.reset(),
            RamEnum::Simple(r) => r.reset(),
            RamEnum::Mock(r) => r.reset(),
        }
    }
    fn last_load_address(&self) -> u32 {
        match self {
            RamEnum::Pvm(r) => r.last_load_address(),
            RamEnum::Simple(r) => r.last_load_address(),
            RamEnum::Mock(r) => r.last_load_address(),
        }
    }
    fn last_load_value(&self) -> u64 {
        match self {
            RamEnum::Pvm(r) => r.last_load_value(),
            RamEnum::Simple(r) => r.last_load_value(),
            RamEnum::Mock(r) => r.last_load_value(),
        }
    }
    fn last_store_address(&self) -> u32 {
        match self {
            RamEnum::Pvm(r) => r.last_store_address(),
            RamEnum::Simple(r) => r.last_store_address(),
            RamEnum::Mock(r) => r.last_store_address(),
        }
    }
    fn last_store_value(&self) -> u64 {
        match self {
            RamEnum::Pvm(r) => r.last_store_value(),
            RamEnum::Simple(r) => r.last_store_value(),
            RamEnum::Mock(r) => r.last_store_value(),
        }
    }
    fn clear_last_memory_op(&mut self) {
        match self {
            RamEnum::Pvm(r) => r.clear_last_memory_op(),
            RamEnum::Simple(r) => r.clear_last_memory_op(),
            RamEnum::Mock(r) => r.clear_last_memory_op(),
        }
    }
}

fn get_registry() -> &'static InstructionRegistry {
    use std::sync::OnceLock;
    static REGISTRY: OnceLock<InstructionRegistry> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let mut r = InstructionRegistry::new();
        register_all_instructions(&mut r);
        r
    })
}

/// Global PVM state for NAPI.
pub struct PvmState {
    pub ram_type: i32,
    pub program_counter: u32,
    pub gas_left: u32,
    pub status: Status,
    pub exit_arg: u32,
    pub result_code: u8,
    pub registers: RegisterState,
    pub code: Vec<u8>,
    pub bitmask: Vec<u8>,
    pub jump_table: Vec<u32>,
    pub ram: RamEnum,
    pub last_load_address: u32,
    pub last_load_value: u64,
    pub last_store_address: u32,
    pub last_store_value: u64,
    /// Opcode (code byte) of the last executed instruction; for trace dump use pvm package getInstructionName(opcode).
    pub last_opcode: u8,
    pub has_accumulation_context: bool,
    /// Set by YIELD host (25) in accumulation; 32-byte hash for accumulation result. Returned by get_accumulation_context.
    pub yield_hash: Option<Vec<u8>>,
    /// Set by ECALLI when returning RESULT_CODE_HOST (Gray Paper: immed_X).
    pub host_call_id: u32,
    /// Set by CHECKPOINT host (17) when has_accumulation_context; executor copies regular → exceptional.
    pub checkpoint_requested: bool,
    /// Accumulate inputs for FETCH selectors 14,15: each element is encoded AccumulateInput bytes. Set via setup_accumulate_invocation(encoded_accumulate_inputs) or set_accumulate_inputs.
    pub accumulate_inputs_encoded: Vec<Vec<u8>>,
    /// FETCH selector 7: encoded work package. Set via set_fetch_work_package.
    pub work_package_encoded: Option<Vec<u8>>,
    /// FETCH selector 8: auth config blob.
    pub auth_config: Option<Vec<u8>>,
    /// FETCH selector 9: auth token blob.
    pub auth_token: Option<Vec<u8>>,
    /// FETCH selector 10: encoded refine context.
    pub refine_context_encoded: Option<Vec<u8>>,
    /// FETCH selectors 11,12: encoded work item summaries per item.
    pub work_item_summaries: Option<Vec<Vec<u8>>>,
    /// FETCH selector 13: work item payloads per item.
    pub work_item_payloads: Option<Vec<Vec<u8>>>,
    /// LOG host function output; drained by executor via get_and_clear_log_messages().
    pub log_messages: Vec<String>,
    /// Entropy accumulator for FETCH selector 1. Set from setup_accumulate_invocation.
    pub entropy_accumulator: Option<Vec<u8>>,
    /// Accumulation config: num cores (for BLESS/ASSIGN/FETCH context). Set from setup.
    pub accumulation_num_cores: u32,
    /// Accumulation config: num validators. Set from setup.
    pub accumulation_num_validators: u32,
    /// Accumulation config: auth queue size. Set from setup.
    pub accumulation_auth_queue_size: u32,
    /// Timeslot from decode_accumulate_args(args). Set from setup for SOLICIT etc.
    pub timeslot: Option<u64>,
    /// Config for FETCH selector 0 (system constants) and FORGET/EJECT expunge. Set from setup.
    pub accumulation_fetch_config: Option<FetchSystemConstantsConfig>,
    /// Service ID from implications (im_id). Set from decode_implications_pair(context).regular.id for INFO/LOOKUP/etc.
    pub accumulation_service_id: Option<u64>,
    /// Accounts map from implications (im_state.ps_accounts). Set from decode_implications_pair(context) for INFO/LOOKUP/etc.
    pub accumulation_accounts: Option<HashMap<u64, CompleteServiceAccount>>,
    /// Full decoded regular implications at setup (for re-encoding with updated accounts/yield).
    pub accumulation_implications_regular: Option<Implications>,
    /// Full decoded exceptional implications at setup (for re-encoding).
    pub accumulation_implications_exceptional: Option<Implications>,
    /// Deferred transfers from TRANSFER host during this invocation; merged into regular.xfers when encoding.
    pub accumulation_pending_xfers: Vec<DeferredTransfer>,
    /// Regular implications state (imX.state). One struct like AS: manager, assigners, delegator, registrar, alwaysaccers, authqueue, stagingset, accounts. Populated from setup; BLESS/ASSIGN/DESIGNATE mutate it; merged into regular when encoding.
    pub accumulation_regular_state: PartialState,
    /// imX.nextfreeid. Updated by NEW when allocating public ID; merged into regular when encoding.
    pub accumulation_nextfreeid: u32,
    /// Provisions (PROVIDE adds (service_id, preimage)). Initialized from implications at setup; merged into regular.provisions when encoding.
    pub accumulation_provisions: Vec<ProvisionEntry>,
}

impl PvmState {
    fn reset_program_state(&mut self) {
        self.program_counter = 0;
        self.gas_left = DEFAULT_GAS_LIMIT;
        self.status = Status::Ok;
        self.exit_arg = 0;
        self.result_code = RESULT_CODE_HALT;
        self.registers = [0u64; 13];
        self.ram.reset();
        self.last_opcode = 0;
        self.host_call_id = 0;
        self.yield_hash = None;
        self.checkpoint_requested = false;
        self.accumulate_inputs_encoded.clear();
        self.work_package_encoded = None;
        self.auth_config = None;
        self.auth_token = None;
        self.refine_context_encoded = None;
        self.work_item_summaries = None;
        self.work_item_payloads = None;
        self.log_messages.clear();
        self.entropy_accumulator = None;
        self.accumulation_num_cores = 0;
        self.accumulation_num_validators = 0;
        self.accumulation_auth_queue_size = 0;
        self.timeslot = None;
        self.accumulation_fetch_config = None;
        self.accumulation_service_id = None;
        self.accumulation_accounts = None;
        self.accumulation_implications_regular = None;
        self.accumulation_implications_exceptional = None;
        self.accumulation_pending_xfers.clear();
        self.accumulation_regular_state = PartialState::default();
        self.accumulation_provisions.clear();
    }
}

impl Default for PvmState {
    fn default() -> Self {
        Self {
            ram_type: RAMType::PvmRam as i32,
            program_counter: 0,
            gas_left: DEFAULT_GAS_LIMIT,
            status: Status::Panic,
            exit_arg: 0,
            result_code: RESULT_CODE_PANIC,
            registers: [0u64; 13],
            code: vec![],
            bitmask: vec![],
            jump_table: vec![],
            ram: RamEnum::Mock(MockRam::new()),
            last_load_address: 0,
            last_load_value: 0,
            last_store_address: 0,
            last_store_value: 0,
            last_opcode: 0,
            has_accumulation_context: false,
            yield_hash: None,
            host_call_id: 0,
            checkpoint_requested: false,
            accumulate_inputs_encoded: vec![],
            work_package_encoded: None,
            auth_config: None,
            auth_token: None,
            refine_context_encoded: None,
            work_item_summaries: None,
            work_item_payloads: None,
            log_messages: vec![],
            entropy_accumulator: None,
            accumulation_num_cores: 0,
            accumulation_num_validators: 0,
            accumulation_auth_queue_size: 0,
            timeslot: None,
            accumulation_fetch_config: None,
            accumulation_service_id: None,
            accumulation_accounts: None,
            accumulation_implications_regular: None,
            accumulation_implications_exceptional: None,
            accumulation_pending_xfers: vec![],
            accumulation_regular_state: PartialState::default(),
            accumulation_nextfreeid: 0,
            accumulation_provisions: vec![],
        }
    }
}

static STATE: Mutex<Option<PvmState>> = Mutex::new(None);

pub fn get_state() -> std::sync::MutexGuard<'static, Option<PvmState>> {
    STATE.lock().expect("pvm state lock")
}

/// Build current regular implications from state (merge accounts, bless, assign, xfers, etc.).
/// Used for CHECKPOINT snapshot (imY' = imX) and for get_accumulation_context_encoded.
/// Accounts are sorted by service_id so the encoded context matches TypeScript (codec sorts before encode).
fn build_current_regular_implications(state: &PvmState) -> Option<Implications> {
    let mut regular = state.accumulation_implications_regular.clone()?;
    let mut accounts_vec: Vec<AccountEntry> = state
        .accumulation_accounts
        .as_ref()?
        .iter()
        .map(|(id, acc)| AccountEntry {
            service_id: *id as u32,
            account: acc.clone(),
        })
        .collect();
    accounts_vec.sort_by_key(|e| e.service_id);
    let yield_hash = state.yield_hash.clone();
    let pending_xfers = state.accumulation_pending_xfers.clone();
    let nextfreeid = state.accumulation_nextfreeid;

    regular.nextfreeid = nextfreeid;
    regular.state = state.accumulation_regular_state.clone();
    regular.state.accounts = accounts_vec;
    regular.xfers.extend(pending_xfers);
    regular.provisions = state.accumulation_provisions.clone();
    regular.yield_hash = yield_hash;
    Some(regular)
}

/// Build updated implications pair from current state (accounts + yield) and return encoded buffer.
/// Matches WASM getAccumulationContext: caller gets full encoded pair to decode and use as updated context.
pub fn get_accumulation_context_encoded(
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Option<Vec<u8>> {
    let g = STATE.lock().expect("pvm state lock");
    let state = g.as_ref()?;
    if !state.has_accumulation_context {
        return None;
    }
    let mut regular = build_current_regular_implications(state)?;
    let exceptional = state.accumulation_implications_exceptional.clone()?;
    let yield_hash = state.yield_hash.clone();
    drop(g);

    // imX (regular) gets current yield; imY (exceptional) keeps snapshot yield from CHECKPOINT (Gray Paper; match AS).
    regular.yield_hash = yield_hash;

    let pair = ImplicationsPair {
        regular,
        exceptional,
    };
    Some(encode_implications_pair(
        &pair,
        num_cores,
        num_validators,
        auth_queue_size,
    ))
}

pub fn init_state(ram_type: i32) {
    let mut g = STATE.lock().expect("pvm state lock");
    let ram = match ram_type {
        x if x == RAMType::SimpleRAM as i32 => RamEnum::Simple(SimpleRam::new()),
        x if x == RAMType::MockRAM as i32 => RamEnum::Mock(MockRam::new()),
        _ => RamEnum::Pvm(PvmRam::new()),
    };
    *g = Some(PvmState {
        ram_type,
        ram,
        ..PvmState::default()
    });
}

pub fn reset_state() {
    let mut g = STATE.lock().expect("pvm state lock");
    if let Some(s) = g.as_mut() {
        s.reset_program_state();
    }
}

/// Params for setup_accumulate_from_preimage (from setup_accumulate_invocation).
pub struct SetupAccumulateParams<'a> {
    pub program: &'a [u8],
    pub args: &'a [u8],
    /// Encoded implications pair (regular × exceptional). Decoded to set accumulation_service_id and accumulation_accounts.
    pub encoded_context: &'a [u8],
    pub gas_limit: u32,
    pub num_cores: u32,
    pub num_validators: u32,
    pub auth_queue_size: u32,
    pub entropy_accumulator: &'a [u8],
    pub encoded_work_items: &'a [u8],
    /// Per-item encoded accumulate inputs for FETCH 14/15. When present, sets accumulate_inputs_encoded (unified with setup).
    pub encoded_accumulate_inputs: Option<Vec<Vec<u8>>>,
    pub config_preimage_expunge_period: u32,
    pub config_epoch_duration: u32,
    pub config_max_block_gas: u64,
    pub config_max_refine_gas: u64,
    pub config_max_tickets_per_extrinsic: u16,
    pub config_tickets_per_validator: u16,
    pub config_slot_duration: u16,
    pub config_rotation_period: u16,
    pub config_num_ec_pieces_per_segment: u32,
    pub config_contest_duration: u32,
    pub config_max_lookup_anchorage: u32,
    pub config_ec_piece_size: u32,
}

/// Setup state for accumulation invocation from preimage blob and args (Gray Paper Y function).
/// Decodes preimage, sets code/bitmask, initializes RAM, stores config/entropy/timeslot, sets PC=5 and gas. Returns true on success.
pub fn setup_accumulate_from_preimage(params: SetupAccumulateParams<'_>) -> bool {
    let mut g = STATE.lock().expect("pvm state lock");
    let Some(state) = g.as_mut() else {
        return false;
    };
    let Some(decoded) = decode_program_from_preimage(params.program) else {
        state.status = Status::Panic;
        state.result_code = RESULT_CODE_PANIC;
        return false;
    };
    // Y format: the program's code field is the instruction blob in deblob format (code + bitmask + jump table).
    let Some(decoded_blob) = decode_blob(&decoded.code) else {
        state.status = Status::Panic;
        state.result_code = RESULT_CODE_PANIC;
        return false;
    };
    let code_len = decoded_blob.code.len();
    let ext_len = code_len + 16;
    let mut extended_code = vec![0u8; ext_len];
    extended_code[..code_len].copy_from_slice(&decoded_blob.code);
    let mut extended_bitmask = vec![1u8; ext_len + 25];
    extended_bitmask[..decoded_blob.bitmask.len().min(ext_len)].copy_from_slice(&decoded_blob.bitmask);
    state.code = extended_code;
    state.bitmask = extended_bitmask;
    state.jump_table = decoded_blob.jump_table;
    state.ram.reset();
    state.ram.initialize_memory_layout(
        params.args,
        &decoded.ro_data,
        &decoded.rw_data,
        decoded.stack_size,
        decoded.heap_zero_padding_size,
    );
    state.program_counter = 5;
    state.gas_left = params.gas_limit;
    state.status = Status::Ok;
    state.result_code = RESULT_CODE_HALT;
    state.registers = [0u64; 13];
    state.registers[0] = u64::from(HALT_ADDRESS);
    state.registers[1] = u64::from(STACK_SEGMENT_END);
    state.registers[7] = u64::from(ARGS_SEGMENT_START);
    state.registers[8] = params.args.len() as u64;
    state.exit_arg = 0;
    state.host_call_id = 0;
    state.has_accumulation_context = true;
    state.entropy_accumulator = if params.entropy_accumulator.len() == 32 {
        Some(params.entropy_accumulator.to_vec())
    } else {
        None
    };
    state.accumulation_num_cores = params.num_cores;
    state.accumulation_num_validators = params.num_validators;
    state.accumulation_auth_queue_size = params.auth_queue_size;
    state.timeslot = decode_accumulate_args(params.args).map(|r| r.value.timeslot);
    state.accumulation_fetch_config = Some(FetchSystemConstantsConfig {
        num_cores: params.num_cores,
        preimage_expunge_period: params.config_preimage_expunge_period,
        epoch_duration: params.config_epoch_duration,
        max_refine_gas: params.config_max_refine_gas,
        max_block_gas: params.config_max_block_gas,
        max_tickets_per_extrinsic: params.config_max_tickets_per_extrinsic as u32,
        max_lookup_anchorage: params.config_max_lookup_anchorage,
        tickets_per_validator: params.config_tickets_per_validator as u32,
        slot_duration: params.config_slot_duration as u32,
        rotation_period: params.config_rotation_period as u32,
        num_validators: params.num_validators,
        ec_piece_size: params.config_ec_piece_size,
        num_ec_pieces_per_segment: params.config_num_ec_pieces_per_segment,
        contest_duration: params.config_contest_duration,
    });

    // Decode implications pair to set service_id and accounts for INFO/LOOKUP/READ/WRITE host functions.
    let num_cores_i = params.num_cores as i32;
    let num_validators_i = params.num_validators as i32;
    let auth_queue_size_i = params.auth_queue_size as i32;
    if let Some(pair_result) = decode_implications_pair(
        params.encoded_context,
        num_cores_i,
        num_validators_i,
        auth_queue_size_i,
    ) {
        let pair = &pair_result.value;
        let _account_count = pair.regular.state.accounts.len();
        crate::host_log!(
            "[setup_accumulate] decoded implications pair: regular.accounts.len()={}",
            _account_count
        );
        state.accumulation_implications_regular = Some(pair.regular.clone());
        state.accumulation_implications_exceptional = Some(pair.exceptional.clone());
        let regular = &pair.regular;
        state.accumulation_service_id = Some(regular.id as u64);
        let mut accounts = HashMap::new();
        for entry in &regular.state.accounts {
            accounts
                .entry(entry.service_id as u64)
                .or_insert_with(|| entry.account.clone());
        }
        state.accumulation_accounts = Some(accounts);
        state.accumulation_pending_xfers.clear();
        state.accumulation_regular_state = regular.state.clone();
        state.accumulation_nextfreeid = regular.nextfreeid;
        state.accumulation_provisions = regular.provisions.clone();
    } else {
        crate::host_log!(
            "[setup_accumulate] decode_implications_pair returned None (context_len={}); accumulation_accounts will stay None",
            params.encoded_context.len()
        );
    }

    if let Some(ref inputs) = params.encoded_accumulate_inputs {
        state.accumulate_inputs_encoded = inputs.clone();
    }

    true
}

/// One step: fetch instruction at PC, execute, advance or halt. Returns true if execution should continue.
pub fn next_step_impl(state: &mut PvmState) -> bool {
    state.host_call_id = 0;
    if state.code.is_empty() {
        state.status = Status::Halt;
        return false;
    }
    let pc = state.program_counter;
    if pc as usize >= state.code.len() {
        state.status = Status::Halt;
        state.result_code = RESULT_CODE_HALT;
        return false;
    }
    if state.gas_left == 0 {
        state.status = Status::Oog;
        state.result_code = RESULT_CODE_OOG;
        return false;
    }

    // Match TypeScript/AssemblyScript: always execute at current PC (use bitmask only for Fskip).
    // TS does not skip non-opcode slots; it runs every position and advances by instruction length.
    let parser = PvmParser::new();
    let fskip = parser.skip(pc as i32, &state.bitmask);
    let instruction_length = 1 + fskip;
    let opcode = state.code[pc as usize] as i32;
    let operands_end = (pc as usize + instruction_length as usize).min(state.code.len());
    let operands = &state.code[(pc as usize + 1)..operands_end];

    let registry = get_registry();
    let Some(handler) = registry.get_handler(opcode) else {
        state.status = Status::Panic;
        state.result_code = RESULT_CODE_PANIC;
        return false;
    };

    state.last_opcode = opcode as u8;
    state.gas_left = state.gas_left.saturating_sub(1);

    // Do not clear last memory op here so ECALLI (and other non-memory steps) retain the previous
    // instruction's load/store for trace; matches WASM trace (Store:[addr,value] at ECALLI).
    let pc_before = state.program_counter;
    let mut host_call_id_out = state.host_call_id;
    let mut context = InstructionContext {
        code: &state.code,
        bitmask: &state.bitmask,
        registers: &mut state.registers,
        program_counter: state.program_counter,
        gas_remaining: state.gas_left,
        operands,
        fskip,
        jump_table: &state.jump_table,
        ram: &mut state.ram,
        host_call_id_out: Some(&mut host_call_id_out),
    };
    let result = handler.execute(&mut context);
    let last_load_address = context.ram.last_load_address();
    let last_load_value = context.ram.last_load_value();
    let last_store_address = context.ram.last_store_address();
    let last_store_value = context.ram.last_store_value();
    let program_counter_after = context.program_counter;
    drop(context);
    state.host_call_id = host_call_id_out;
    state.last_load_address = last_load_address;
    state.last_load_value = last_load_value;
    state.last_store_address = last_store_address;
    state.last_store_value = last_store_value;

    if result.result_code == RESULT_CODE_HOST as i32 {
        // During accumulation invocation, only allow host IDs from AS pvm.ts handleAccumulationHostCall:
        // general 0-5, log 100, accumulation 14-26. Others: deduct 10 gas, set r7=WHAT, advance PC, continue.
        if state.has_accumulation_context {
            let id = state.host_call_id as u64;
            let allowed = (id <= 5) || (id == 100) || (id >= 14 && id <= 26);
            if !allowed {
                const HOST_BASE_GAS: u32 = 10;
                if state.gas_left < HOST_BASE_GAS {
                    state.status = Status::Oog;
                    state.result_code = RESULT_CODE_OOG;
                    return false;
                }
                state.gas_left = state.gas_left.saturating_sub(HOST_BASE_GAS);
                use crate::config::REG_WHAT;
                state.registers[7] = REG_WHAT;
                state.program_counter = pc + instruction_length as u32;
                return true;
            }
        }
        if let Some(handler) = get_host_function(state.host_call_id) {
            // All host functions (including LOG) use base 10 gas to match jamtestnet / expected traces.
            const HOST_BASE_GAS: u32 = 10;
            let host_base_gas = HOST_BASE_GAS;
            if state.gas_left < host_base_gas {
                state.status = Status::Oog;
                state.result_code = RESULT_CODE_OOG;
                return false;
            }
            state.gas_left = state.gas_left.saturating_sub(host_base_gas);

            let mut host_ctx = HostFunctionContext {
                registers: &mut state.registers,
                ram: &mut state.ram,
                gas_remaining: &mut state.gas_left,
                service_id: state.accumulation_service_id,
                service_account: None,
                accounts: state.accumulation_accounts.as_mut(),
                manager_id: if state.has_accumulation_context {
                    Some(state.accumulation_regular_state.manager as u64)
                } else {
                    None
                },
                registrar_id: if state.has_accumulation_context {
                    Some(state.accumulation_regular_state.registrar as u64)
                } else {
                    None
                },
                nextfreeid: if state.has_accumulation_context {
                    Some(&mut state.accumulation_nextfreeid)
                } else {
                    None
                },
                lookup_timeslot: None,
                timeslot: state.timeslot,
                expunge_period: state
                    .accumulation_fetch_config
                    .as_ref()
                    .map(|c| c.preimage_expunge_period as u64),
                refine_context: None,
                yield_hash: if state.has_accumulation_context {
                    Some(&mut state.yield_hash)
                } else {
                    None
                },
                provisions: if state.has_accumulation_context {
                    Some(&mut state.accumulation_provisions)
                } else {
                    None
                },
                xfers: if state.has_accumulation_context {
                    Some(&mut state.accumulation_pending_xfers)
                } else {
                    None
                },
                delegator_id: if state.has_accumulation_context {
                    Some(state.accumulation_regular_state.delegator as u64)
                } else {
                    None
                },
                num_validators: if state.accumulation_num_validators > 0 {
                    Some(state.accumulation_num_validators)
                } else {
                    None
                },
                accumulation_state: if state.has_accumulation_context {
                    Some(&mut state.accumulation_regular_state)
                } else {
                    None
                },
                checkpoint_requested: if state.has_accumulation_context {
                    Some(&mut state.checkpoint_requested)
                } else {
                    None
                },
                num_cores: if state.accumulation_num_cores > 0 {
                    Some(state.accumulation_num_cores)
                } else {
                    None
                },
                fetch_entropy_accumulator: state.entropy_accumulator.as_deref(),
                fetch_authorizer_trace: None,
                fetch_export_segments: None,
                fetch_import_segments: None,
                fetch_work_item_index: None,
                fetch_accumulate_inputs: if state.accumulate_inputs_encoded.is_empty() {
                    None
                } else {
                    Some(state.accumulate_inputs_encoded.as_slice())
                },
                fetch_work_package_encoded: state.work_package_encoded.as_deref(),
                fetch_auth_config: state.auth_config.as_deref(),
                fetch_auth_token: state.auth_token.as_deref(),
                fetch_refine_context_encoded: state.refine_context_encoded.as_deref(),
                fetch_work_item_summaries: state.work_item_summaries.as_deref(),
                fetch_work_item_payloads: state.work_item_payloads.as_deref(),
                log_messages: Some(&mut state.log_messages),
                fetch_system_constants_config: state.accumulation_fetch_config.as_ref(),
            };
            let host_result = handler.execute(&mut host_ctx);
            // Gray Paper line 752: imY' = imX. When CHECKPOINT (17) ran it set checkpoint_requested.
            // Snapshot current regular into exceptional so panic/OOG reverts to this checkpoint.
            if state.checkpoint_requested {
                if let Some(snapshot) = build_current_regular_implications(state) {
                    state.accumulation_implications_exceptional = Some(snapshot);
                }
                state.checkpoint_requested = false;
            }
            if host_result.should_continue() {
                state.program_counter = pc + instruction_length as u32;
                return true;
            }
            state.status = match host_result.result_code {
                x if x == RESULT_CODE_HALT => Status::Halt,
                x if x == RESULT_CODE_PANIC => Status::Panic,
                x if x == RESULT_CODE_FAULT => Status::Fault,
                x if x == RESULT_CODE_OOG => Status::Oog,
                _ => Status::Panic,
            };
            state.result_code = host_result.result_code;
            return false;
        }
        // Unknown host function (Gray Paper pvm_invocations.tex 206-210). Match AS: set r7 = WHAT, advance PC, continue.
        use crate::config::REG_WHAT;
        state.registers[7] = REG_WHAT;
        state.program_counter = pc + instruction_length as u32;
        return true;
    }

    if result.result_code != InstructionResult::CONTINUE {
        state.status = match result.result_code as u8 {
            x if x == RESULT_CODE_HALT => Status::Halt,
            x if x == RESULT_CODE_PANIC => Status::Panic,
            x if x == RESULT_CODE_FAULT => Status::Fault,
            x if x == RESULT_CODE_HOST => Status::Host,
            x if x == RESULT_CODE_OOG => Status::Oog,
            _ => Status::Panic,
        };
        state.result_code = result.result_code as u8;
        state.exit_arg = if result.has_fault_address {
            result.fault_address
        } else {
            0
        };
        return false;
    }

    if program_counter_after != pc_before {
        state.program_counter = program_counter_after;
    } else {
        state.program_counter = pc + instruction_length as u32;
    }
    true
}

/// Run blob: decode, parse, load code, reset, then step until halt.
pub fn run_blob_impl(program: &[u8]) {
    let mut g = STATE.lock().expect("pvm state lock");
    let Some(state) = g.as_mut() else {
        return;
    };
    let parser = PvmParser::new();
    let parse_result = parser.parse_program(program);
    if !parse_result.success {
        state.status = Status::Panic;
        state.result_code = RESULT_CODE_PANIC;
        return;
    }
    state.code = parse_result.extended_code;
    state.bitmask = parse_result.bitmask;
    state.jump_table = parse_result.jump_table;
    state.reset_program_state();
    while next_step_impl(state) {}
}

/// Prepare blob: decode, parse, load code and reset; do not run.
pub fn prepare_blob_impl(program: &[u8]) {
    let mut g = STATE.lock().expect("pvm state lock");
    let Some(state) = g.as_mut() else {
        return;
    };
    let parser = PvmParser::new();
    let parse_result = parser.parse_program(program);
    if !parse_result.success {
        state.status = Status::Panic;
        state.result_code = RESULT_CODE_PANIC;
        return;
    }
    state.code = parse_result.extended_code;
    state.bitmask = parse_result.bitmask;
    state.jump_table = parse_result.jump_table;
    state.reset_program_state();
}

/// Initialize memory layout on the current state's RAM (Gray Paper 770–802). Use after prepareBlob when testing with PvmRam so heap/stack/args/ro exist.
pub fn init_memory_layout_impl(
    argument_data: &[u8],
    read_only_data: &[u8],
    read_write_data: &[u8],
    stack_size: u32,
    heap_zero_padding_size: u32,
) {
    let mut g = STATE.lock().expect("pvm state lock");
    if let Some(state) = g.as_mut() {
        state.ram.initialize_memory_layout(
            argument_data,
            read_only_data,
            read_write_data,
            stack_size,
            heap_zero_padding_size,
        );
    }
}

/// Initialize a page in the current state's RAM (for test vectors). access_type: 0 = None, 1 = Read, 2 = Write.
pub fn init_page_impl(address: u32, length: u32, access_type: u8) {
    let access = match access_type {
        1 => MemoryAccessType::Read,
        2 => MemoryAccessType::Write,
        _ => MemoryAccessType::None,
    };
    let mut g = STATE.lock().expect("pvm state lock");
    if let Some(state) = g.as_mut() {
        state.ram.init_page(address, length, access);
    }
}

/// Write octets to current state's RAM at address (for test vectors initial memory).
/// Uses write_octets_during_initialization so initial data can be written to any mapped page
/// (including read-only), matching TypeScript test-vector-helper (writeOctetsDuringInitialization).
pub fn set_memory_impl(address: u32, data: &[u8]) {
    let mut g = STATE.lock().expect("pvm state lock");
    if let Some(state) = g.as_mut() {
        state.ram.write_octets_during_initialization(address, data);
    }
}
