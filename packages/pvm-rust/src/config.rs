//! PVM configuration constants (mirrors assembly/config.ts).
//! Gray Paper specifications, Appendix A instruction tables.

// ============================================================================
// Gas Configuration
// ============================================================================
pub const DEFAULT_GAS_LIMIT: u32 = 0xFFFF_FFFF; // 2^32 - 1 (max u32)
pub const MIN_GAS_COST: u32 = 1;
pub const MAX_GAS_COST: u32 = 1_000_000;

// ============================================================================
// Memory Configuration
// ============================================================================
pub const RESERVED_MEMORY_END: u32 = 65_536;       // 64KB (2^16)
pub const MAX_MEMORY_ADDRESS: u32 = 2_147_483_647; // 2^31 - 1
pub const INITIAL_ZONE_SIZE: u32 = 65_536;         // 64KB - Gray Paper Cpvminitzonesize
pub const PAGE_SIZE: u32 = 4096;                   // 4KB - Gray Paper Cpvmpagesize
pub const DYNAMIC_ADDRESS_ALIGNMENT: u32 = 2;     // Gray Paper Cpvmdynaddralign

// ============================================================================
// Program Initialization Configuration
// ============================================================================
pub const ZONE_SIZE: u32 = 65_536;      // 64KB - Gray Paper Cpvminitzonesize
pub const INIT_INPUT_SIZE: u32 = 16_777_216; // 16MB (2^24) - Gray Paper Cpvminitinputsize

// ============================================================================
// Register Initialization Constants (Gray Paper equation 803-811)
// ============================================================================
/// r0: HALT address - jumping here causes PVM to halt. Gray Paper: 2^32 - 2^16 = 0xffff0000
pub const HALT_ADDRESS: u32 = 4294901760;
/// r1: Stack segment end (exclusive). Gray Paper: 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize
pub const STACK_SEGMENT_END: u32 = 4_278_059_008; // 0xFEFE0000
/// r7: Arguments segment start. Gray Paper: 2^32 - Cpvminitzonesize - Cpvminitinputsize
pub const ARGS_SEGMENT_START: u32 = 4_278_124_544; // 0xfeff0000

// ============================================================================
// Result Codes (Gray Paper)
// ============================================================================
pub const RESULT_CODE_HALT: u8 = 0;
pub const RESULT_CODE_PANIC: u8 = 1;
pub const RESULT_CODE_FAULT: u8 = 2;
pub const RESULT_CODE_HOST: u8 = 3;
pub const RESULT_CODE_OOG: u8 = 4;

// ============================================================================
// Opcodes (Gray Paper Appendix A)
// ============================================================================
pub const OPCODE_TRAP: u8 = 0;
pub const OPCODE_FALLTHROUGH: u8 = 1;
pub const OPCODE_ECALLI: u8 = 10;
pub const OPCODE_LOAD_IMM_64: u8 = 20;
pub const OPCODE_STORE_IMM_U8: u8 = 30;
pub const OPCODE_STORE_IMM_U16: u8 = 31;
pub const OPCODE_STORE_IMM_U32: u8 = 32;
pub const OPCODE_STORE_IMM_U64: u8 = 33;
pub const OPCODE_JUMP: u8 = 40;
pub const OPCODE_JUMP_IND: u8 = 50;
pub const OPCODE_LOAD_IMM: u8 = 51;
pub const OPCODE_LOAD_U8: u8 = 52;
pub const OPCODE_LOAD_I8: u8 = 53;
pub const OPCODE_LOAD_U16: u8 = 54;
pub const OPCODE_LOAD_I16: u8 = 55;
pub const OPCODE_LOAD_U32: u8 = 56;
pub const OPCODE_LOAD_I32: u8 = 57;
pub const OPCODE_LOAD_U64: u8 = 58;
pub const OPCODE_STORE_U8: u8 = 59;
pub const OPCODE_STORE_U16: u8 = 60;
pub const OPCODE_STORE_U32: u8 = 61;
pub const OPCODE_STORE_U64: u8 = 62;
pub const OPCODE_STORE_IMM_IND_U8: u8 = 70;
pub const OPCODE_STORE_IMM_IND_U16: u8 = 71;
pub const OPCODE_STORE_IMM_IND_U32: u8 = 72;
pub const OPCODE_STORE_IMM_IND_U64: u8 = 73;
pub const OPCODE_LOAD_IMM_JUMP: u8 = 80;
pub const OPCODE_BRANCH_EQ_IMM: u8 = 81;
pub const OPCODE_BRANCH_NE_IMM: u8 = 82;
pub const OPCODE_BRANCH_LT_U_IMM: u8 = 83;
pub const OPCODE_BRANCH_LE_U_IMM: u8 = 84;
pub const OPCODE_BRANCH_GE_U_IMM: u8 = 85;
pub const OPCODE_BRANCH_GT_U_IMM: u8 = 86;
pub const OPCODE_BRANCH_LT_S_IMM: u8 = 87;
pub const OPCODE_BRANCH_LE_S_IMM: u8 = 88;
pub const OPCODE_BRANCH_GE_S_IMM: u8 = 89;
pub const OPCODE_BRANCH_GT_S_IMM: u8 = 90;
pub const OPCODE_MOVE_REG: u8 = 100;
pub const OPCODE_SBRK: u8 = 101;
pub const OPCODE_COUNT_SET_BITS_64: u8 = 102;
pub const OPCODE_COUNT_SET_BITS_32: u8 = 103;
pub const OPCODE_LEADING_ZERO_BITS_64: u8 = 104;
pub const OPCODE_LEADING_ZERO_BITS_32: u8 = 105;
pub const OPCODE_TRAILING_ZERO_BITS_64: u8 = 106;
pub const OPCODE_TRAILING_ZERO_BITS_32: u8 = 107;
pub const OPCODE_SIGN_EXTEND_8: u8 = 108;
pub const OPCODE_SIGN_EXTEND_16: u8 = 109;
pub const OPCODE_ZERO_EXTEND_16: u8 = 110;
pub const OPCODE_REVERSE_BYTES: u8 = 111;
pub const OPCODE_STORE_IND_U8: u8 = 120;
pub const OPCODE_STORE_IND_U16: u8 = 121;
pub const OPCODE_STORE_IND_U32: u8 = 122;
pub const OPCODE_STORE_IND_U64: u8 = 123;
pub const OPCODE_LOAD_IND_U8: u8 = 124;
pub const OPCODE_LOAD_IND_I8: u8 = 125;
pub const OPCODE_LOAD_IND_U16: u8 = 126;
pub const OPCODE_LOAD_IND_I16: u8 = 127;
pub const OPCODE_LOAD_IND_U32: u8 = 128;
pub const OPCODE_LOAD_IND_I32: u8 = 129;
pub const OPCODE_LOAD_IND_U64: u8 = 130;
pub const OPCODE_ADD_IMM_32: u8 = 131;
pub const OPCODE_AND_IMM: u8 = 132;
pub const OPCODE_XOR_IMM: u8 = 133;
pub const OPCODE_OR_IMM: u8 = 134;
pub const OPCODE_MUL_IMM_32: u8 = 135;
pub const OPCODE_SET_LT_U_IMM: u8 = 136;
pub const OPCODE_SET_LT_S_IMM: u8 = 137;
pub const OPCODE_SHLO_L_IMM_32: u8 = 138;
pub const OPCODE_SHLO_R_IMM_32: u8 = 139;
pub const OPCODE_SHAR_R_IMM_32: u8 = 140;
pub const OPCODE_NEG_ADD_IMM_32: u8 = 141;
pub const OPCODE_SET_GT_U_IMM: u8 = 142;
pub const OPCODE_SET_GT_S_IMM: u8 = 143;
pub const OPCODE_SHLO_L_IMM_ALT_32: u8 = 144;
pub const OPCODE_SHLO_R_IMM_ALT_32: u8 = 145;
pub const OPCODE_SHAR_R_IMM_ALT_32: u8 = 146;
pub const OPCODE_CMOV_IZ_IMM: u8 = 147;
pub const OPCODE_CMOV_NZ_IMM: u8 = 148;
pub const OPCODE_ADD_IMM_64: u8 = 149;
pub const OPCODE_MUL_IMM_64: u8 = 150;
pub const OPCODE_SHLO_L_IMM_64: u8 = 151;
pub const OPCODE_SHLO_R_IMM_64: u8 = 152;
pub const OPCODE_SHAR_R_IMM_64: u8 = 153;
pub const OPCODE_NEG_ADD_IMM_64: u8 = 154;
pub const OPCODE_SHLO_L_IMM_ALT_64: u8 = 155;
pub const OPCODE_SHLO_R_IMM_ALT_64: u8 = 156;
pub const OPCODE_SHAR_R_IMM_ALT_64: u8 = 157;
pub const OPCODE_ROT_R_64_IMM: u8 = 158;
pub const OPCODE_ROT_R_64_IMM_ALT: u8 = 159;
pub const OPCODE_ROT_R_32_IMM: u8 = 160;
pub const OPCODE_ROT_R_32_IMM_ALT: u8 = 161;
pub const OPCODE_BRANCH_EQ: u8 = 170;
pub const OPCODE_BRANCH_NE: u8 = 171;
pub const OPCODE_BRANCH_LT_U: u8 = 172;
pub const OPCODE_BRANCH_LT_S: u8 = 173;
pub const OPCODE_BRANCH_GE_U: u8 = 174;
pub const OPCODE_BRANCH_GE_S: u8 = 175;
pub const OPCODE_LOAD_IMM_JUMP_IND: u8 = 180;
pub const OPCODE_ADD_32: u8 = 190;
pub const OPCODE_SUB_32: u8 = 191;
pub const OPCODE_MUL_32: u8 = 192;
pub const OPCODE_DIV_U_32: u8 = 193;
pub const OPCODE_DIV_S_32: u8 = 194;
pub const OPCODE_REM_U_32: u8 = 195;
pub const OPCODE_REM_S_32: u8 = 196;
pub const OPCODE_SHLO_L_32: u8 = 197;
pub const OPCODE_SHLO_R_32: u8 = 198;
pub const OPCODE_SHAR_R_32: u8 = 199;
pub const OPCODE_ADD_64: u8 = 200;
pub const OPCODE_SUB_64: u8 = 201;
pub const OPCODE_MUL_64: u8 = 202;
pub const OPCODE_DIV_U_64: u8 = 203;
pub const OPCODE_DIV_S_64: u8 = 204;
pub const OPCODE_REM_U_64: u8 = 205;
pub const OPCODE_REM_S_64: u8 = 206;
pub const OPCODE_SHLO_L_64: u8 = 207;
pub const OPCODE_SHLO_R_64: u8 = 208;
pub const OPCODE_SHAR_R_64: u8 = 209;
pub const OPCODE_AND: u8 = 210;
pub const OPCODE_XOR: u8 = 211;
pub const OPCODE_OR: u8 = 212;
pub const OPCODE_MUL_UPPER_S_S: u8 = 213;
pub const OPCODE_MUL_UPPER_U_U: u8 = 214;
pub const OPCODE_MUL_UPPER_S_U: u8 = 215;
pub const OPCODE_SET_LT_U: u8 = 216;
pub const OPCODE_SET_LT_S: u8 = 217;
pub const OPCODE_CMOV_IZ: u8 = 218;
pub const OPCODE_CMOV_NZ: u8 = 219;
pub const OPCODE_ROT_L_64: u8 = 220;
pub const OPCODE_ROT_L_32: u8 = 221;
pub const OPCODE_ROT_R_64: u8 = 222;
pub const OPCODE_ROT_R_32: u8 = 223;
pub const OPCODE_AND_INV: u8 = 224;
pub const OPCODE_OR_INV: u8 = 225;
pub const OPCODE_XNOR: u8 = 226;
pub const OPCODE_MAX: u8 = 227;
pub const OPCODE_MAX_U: u8 = 228;
pub const OPCODE_MIN: u8 = 229;
pub const OPCODE_MIN_U: u8 = 230;

// ============================================================================
// Gray Paper Constants (mirrors assembly/config.ts + pbnj-types-compat)
// ============================================================================
pub const PACKAGE_AUTH_GAS: u32 = 50_000_000;
pub const MAX_AUTH_CODE_SIZE: u32 = 64_000;
pub const PACKAGE_REF_GAS: u64 = 5_000_000_000;
pub const MAX_SERVICE_CODE_SIZE: u32 = 4_000_000;
pub const SEGMENT_SIZE: u32 = 4_104;
pub const MAX_PACKAGE_EXPORTS: u32 = 3_072;
pub const MIN_PUBLIC_INDEX: u32 = 65536;

// Deposit (DEPOSIT_CONSTANTS)
pub const C_ITEM_DEPOSIT: u64 = 10;
pub const C_BYTE_DEPOSIT: u64 = 1;
pub const C_BASE_DEPOSIT: u64 = 100;

// Work report (WORK_REPORT_CONSTANTS)
pub const C_REPORT_ACC_GAS: u64 = 10_000_000;
pub const C_MAX_REPORT_DEPS: u32 = 8;
pub const C_MAX_REPORT_VAR_SIZE: u32 = 49152; // 48 * 2^10

// Authorization (AUTHORIZATION_CONSTANTS)
pub const C_AUTH_POOL_SIZE: u32 = 8;
pub const C_AUTH_QUEUE_SIZE: u32 = 80;

// Work package (WORK_PACKAGE_CONSTANTS)
pub const C_MAX_PACKAGE_ITEMS: u32 = 16;
pub const C_MAX_PACKAGE_XTS: u32 = 128;
pub const C_MAX_PACKAGE_IMPORTS: u32 = 3072;
pub const C_MAX_PACKAGE_EXPORTS: u32 = 3072;
pub const C_MAX_BUNDLE_SIZE: u32 = 13_791_360;

// Time (TIME_CONSTANTS)
pub const C_ROTATION_PERIOD: u32 = 10;
pub const C_ASSURANCE_TIMEOUT_PERIOD: u32 = 5;
pub const C_EXPUNGE_PERIOD: u32 = 19200;
pub const C_MAX_LOOKUP_ANCHORAGE: u32 = 14400;

// History (HISTORY_CONSTANTS)
pub const C_RECENT_HISTORY_LEN: u32 = 8;

// Segment (SEGMENT_CONSTANTS)
pub const C_EC_PIECE_SIZE: u32 = 684;
pub const C_SEGMENT_EC_PIECES: u32 = 256; // configNumEcPiecesPerSegment default

// Transfer (TRANSFER_CONSTANTS)
pub const C_MEMO_SIZE: u32 = 128;

// Ticket (TICKET_CONSTANTS)
pub const C_MAX_BLOCK_TICKETS: u32 = 256; // config default
pub const C_TICKET_ENTRIES: u32 = 2;
pub const C_EPOCH_TAIL_START: u32 = 500; // configContestDuration default

/// Runtime config for FETCH selector 0 (system constants). Mirrors PVM instance config in AS.
#[derive(Clone, Debug)]
pub struct FetchSystemConstantsConfig {
    pub num_cores: u32,
    pub preimage_expunge_period: u32,
    pub epoch_duration: u32,
    pub max_refine_gas: u64,
    pub max_block_gas: u64,
    pub max_tickets_per_extrinsic: u32,
    pub max_lookup_anchorage: u32,
    pub tickets_per_validator: u32,
    pub slot_duration: u32,
    pub rotation_period: u32,
    pub num_validators: u32,
    pub ec_piece_size: u32,
    pub num_ec_pieces_per_segment: u32,
    pub contest_duration: u32,
}

impl Default for FetchSystemConstantsConfig {
    fn default() -> Self {
        Self {
            num_cores: 341,
            preimage_expunge_period: C_EXPUNGE_PERIOD,
            epoch_duration: 600,
            max_refine_gas: PACKAGE_REF_GAS,
            max_block_gas: 3_500_000_000,
            max_tickets_per_extrinsic: C_MAX_BLOCK_TICKETS,
            max_lookup_anchorage: C_MAX_LOOKUP_ANCHORAGE,
            tickets_per_validator: C_TICKET_ENTRIES,
            slot_duration: 6,
            rotation_period: C_ROTATION_PERIOD,
            num_validators: 1023,
            ec_piece_size: C_EC_PIECE_SIZE,
            num_ec_pieces_per_segment: C_SEGMENT_EC_PIECES,
            contest_duration: C_EPOCH_TAIL_START,
        }
    }
}

// ============================================================================
// General Function Identifiers (Gray Paper Appendix B.7)
// ============================================================================
pub const FUNC_GAS: u8 = 0;
pub const FUNC_FETCH: u8 = 1;
pub const FUNC_LOOKUP: u8 = 2;
pub const FUNC_READ: u8 = 3;
pub const FUNC_WRITE: u8 = 4;
pub const FUNC_INFO: u8 = 5;
pub const FUNC_HISTORICAL_LOOKUP: u8 = 6;
pub const FUNC_EXPORT: u8 = 7;
pub const FUNC_MACHINE: u8 = 8;
pub const FUNC_PEEK: u8 = 9;
pub const FUNC_POKE: u8 = 10;
pub const FUNC_PAGES: u8 = 11;
pub const FUNC_INVOKE: u8 = 12;
pub const FUNC_EXPUNGE: u8 = 13;
pub const FUNC_LOG: u8 = 100;

// ============================================================================
// Accumulate Function Identifiers (Gray Paper Appendix B.7)
// ============================================================================
pub const FUNC_BLESS: u8 = 14;
pub const FUNC_ASSIGN: u8 = 15;
pub const FUNC_DESIGNATE: u8 = 16;
pub const FUNC_CHECKPOINT: u8 = 17;
pub const FUNC_NEW: u8 = 18;
pub const FUNC_UPGRADE: u8 = 19;
pub const FUNC_TRANSFER: u8 = 20;
pub const FUNC_EJECT: u8 = 21;
pub const FUNC_QUERY: u8 = 22;
pub const FUNC_SOLICIT: u8 = 23;
pub const FUNC_FORGET: u8 = 24;
pub const FUNC_YIELD: u8 = 25;
pub const FUNC_PROVIDE: u8 = 26;

// ============================================================================
// Accumulate Error Codes (Gray Paper section 31.2)
// ============================================================================
// i64 variants: used in TS for internal checks; Rust host functions use u64 REG_* in registers[7].
#[allow(dead_code)]
pub const ERROR_NONE: i64 = -1;
#[allow(dead_code)]
pub const ERROR_WHAT: i64 = -2;
#[allow(dead_code)]
pub const ERROR_OOB: i64 = -3;
#[allow(dead_code)]
pub const ERROR_WHO: i64 = -4;
#[allow(dead_code)]
pub const ERROR_FULL: i64 = -5;
#[allow(dead_code)]
pub const ERROR_CORE: i64 = -6;
#[allow(dead_code)]
pub const ERROR_CASH: i64 = -7;
#[allow(dead_code)]
pub const ERROR_LOW: i64 = -8;
#[allow(dead_code)]
pub const ERROR_HUH: i64 = -9;
#[allow(dead_code)]
pub const ERROR_OK: i64 = 0;

/// Same error codes as u64 for register results (Gray Paper: registers[7]).
/// TS: ACCUMULATE_ERROR_CODES in packages/pvm/src/config.ts; used in read/write/info (NONE), write/export (FULL), peek/poke/pages (OK, WHO, OOB, HUH), etc.
pub const REG_NONE: u64 = u64::MAX;           // 2^64 - 1
/// WHAT = name unknown; used when unknown host function is called (state_wrapper, TS executor set r7 = WHAT).
pub const REG_WHAT: u64 = u64::MAX - 1;       // 2^64 - 2
pub const REG_OOB: u64 = u64::MAX - 2;        // 2^64 - 3
pub const REG_WHO: u64 = u64::MAX - 3;        // 2^64 - 4
pub const REG_FULL: u64 = u64::MAX - 4;       // 2^64 - 5
pub const REG_CORE: u64 = u64::MAX - 5;       // 2^64 - 6
/// CASH = insufficient funds; TS transfer can return it; Rust accumulate stubs not yet.
#[allow(dead_code)]
pub const REG_CASH: u64 = u64::MAX - 6;       // 2^64 - 7
/// LOW = gas limit too low; used by TRANSFER when gas limit < dest minmemogas (TS), or 0 in Rust stub.
pub const REG_LOW: u64 = u64::MAX - 7;        // 2^64 - 8
pub const REG_HUH: u64 = u64::MAX - 8;        // 2^64 - 9
pub const REG_OK: u64 = 0;

// ============================================================================
// Helper
// ============================================================================

/// True if opcode is a basic block termination instruction (trap, fallthrough, jump, branch).
#[must_use]
pub const fn is_termination_instruction(opcode: u8) -> bool {
    if opcode == OPCODE_TRAP || opcode == OPCODE_FALLTHROUGH {
        return true;
    }
    if opcode == OPCODE_JUMP || opcode == OPCODE_JUMP_IND {
        return true;
    }
    if opcode == OPCODE_LOAD_IMM_JUMP || opcode == OPCODE_LOAD_IMM_JUMP_IND {
        return true;
    }
    if opcode >= OPCODE_BRANCH_EQ && opcode <= OPCODE_BRANCH_GE_S {
        return true;
    }
    if opcode >= OPCODE_BRANCH_EQ_IMM && opcode <= OPCODE_BRANCH_GT_S_IMM {
        return true;
    }
    false
}

// ============================================================================
// Alignment helpers (Gray Paper equation 766)
// ============================================================================

/// Align size to page boundary: PAGE_SIZE * ceil(size / PAGE_SIZE).
#[must_use]
pub const fn align_to_page(size: u32) -> u32 {
    let n = (size + PAGE_SIZE - 1) / PAGE_SIZE;
    n * PAGE_SIZE
}

/// Align size to zone boundary: ZONE_SIZE * ceil(size / ZONE_SIZE).
#[must_use]
pub const fn align_to_zone(size: u32) -> u32 {
    let n = (size + ZONE_SIZE - 1) / ZONE_SIZE;
    n * ZONE_SIZE
}
