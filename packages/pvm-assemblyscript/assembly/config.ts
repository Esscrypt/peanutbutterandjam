/**
 * PVM Configuration Constants (AssemblyScript)
 *
 * Centralized configuration for the PVM runtime, following Gray Paper specifications
 * Based on Appendix A instruction tables from the Gray Paper
 */

// ============================================================================
// Gas Configuration
// ============================================================================
export const DEFAULT_GAS_LIMIT: u32 = u32(4_294_967_296) // 2^32
export const MIN_GAS_COST: u32 = 1
export const MAX_GAS_COST: u32 = 1_000_000

// ============================================================================
// Memory Configuration
// ============================================================================
export const RESERVED_MEMORY_END: u32 = 65_536 // 64KB (2^16)
export const MAX_MEMORY_ADDRESS: u32 = 2_147_483_647 // 2^31 - 1
export const INITIAL_ZONE_SIZE: u32 = 65_536 // 64KB (2^16) - Gray Paper Cpvminitzonesize
export const PAGE_SIZE: u32 = 4096 // 4KB (2^12) - Gray Paper Cpvmpagesize
export const DYNAMIC_ADDRESS_ALIGNMENT: u32 = 2 // Gray Paper Cpvmdynaddralign

// ============================================================================
// Program Initialization Configuration
// ============================================================================
export const ZONE_SIZE: u32 = 65_536 // 64KB (2^16) - Gray Paper Cpvminitzonesize
export const INIT_INPUT_SIZE: u32 = 16_777_216 // 16MB (2^24) - Gray Paper Cpvminitinputsize

// ============================================================================
// Register Initialization Constants (Gray Paper equation 803-811)
// Reference: https://graypaper.fluffylabs.dev/#/579bd12/2c7c012cb101
// ============================================================================

// r0: HALT address - jumping to this address causes the PVM to halt
// Gray Paper: 2^32 - 2^16 = 0xffff0000
export const HALT_ADDRESS: u32 = 4294901760 // 2 ** 32 - 2 ** 16 = 0xffff0000

// r1: Stack segment end address (exclusive)
// Gray Paper: 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize
// This is the end address of the stack region (STACK_SEGMENT)
export const STACK_SEGMENT_END: u32 = 4_278_059_008 // 0xFEFE0000

// r7: Arguments segment start address
// Gray Paper: 2^32 - Cpvminitzonesize - Cpvminitinputsize
// This is the start address of the arguments/output region (ARGS_SEGMENT)
export const ARGS_SEGMENT_START: u32 = 4_278_124_544 // 0xfeff0000

// ============================================================================
// Result Codes (Gray Paper)
// ============================================================================
export const RESULT_CODE_HALT: u8 = 0 // The invocation completed and halted normally
export const RESULT_CODE_PANIC: u8 = 1 // The invocation completed with a panic
export const RESULT_CODE_FAULT: i32 = 2 // The invocation completed with a page fault
export const RESULT_CODE_HOST: u8 = 3 // The invocation completed with a host-call fault
export const RESULT_CODE_OOG: u8 = 4 // The invocation completed by running out of gas

// ============================================================================
// Opcodes (Gray Paper Appendix A)
// ============================================================================

// Instructions without Arguments
export const OPCODE_TRAP: u8 = 0 // Panic
export const OPCODE_FALLTHROUGH: u8 = 1 // No operation

// Instructions with Arguments of One Immediate
export const OPCODE_ECALLI: u8 = 10 // Host call with immediate value

// Instructions with Arguments of One Register and One Extended Width Immediate
export const OPCODE_LOAD_IMM_64: u8 = 20 // Load 64-bit immediate into register

// Instructions with Arguments of Two Immediates
export const OPCODE_STORE_IMM_U8: u8 = 30 // Store 8-bit immediate to memory
export const OPCODE_STORE_IMM_U16: u8 = 31 // Store 16-bit immediate to memory
export const OPCODE_STORE_IMM_U32: u8 = 32 // Store 32-bit immediate to memory
export const OPCODE_STORE_IMM_U64: u8 = 33 // Store 64-bit immediate to memory

// Instructions with Arguments of One Offset
export const OPCODE_JUMP: u8 = 40 // Unconditional jump

// Instructions with Arguments of One Register & One Immediate
export const OPCODE_JUMP_IND: u8 = 50 // Indirect jump
export const OPCODE_LOAD_IMM: u8 = 51 // Load immediate into register
export const OPCODE_LOAD_U8: u8 = 52 // Load unsigned 8-bit from memory
export const OPCODE_LOAD_I8: u8 = 53 // Load signed 8-bit from memory
export const OPCODE_LOAD_U16: u8 = 54 // Load unsigned 16-bit from memory
export const OPCODE_LOAD_I16: u8 = 55 // Load signed 16-bit from memory
export const OPCODE_LOAD_U32: u8 = 56 // Load unsigned 32-bit from memory
export const OPCODE_LOAD_I32: u8 = 57 // Load signed 32-bit from memory
export const OPCODE_LOAD_U64: u8 = 58 // Load unsigned 64-bit from memory
export const OPCODE_STORE_U8: u8 = 59 // Store 8-bit to memory
export const OPCODE_STORE_U16: u8 = 60 // Store 16-bit to memory
export const OPCODE_STORE_U32: u8 = 61 // Store 32-bit to memory
export const OPCODE_STORE_U64: u8 = 62 // Store 64-bit to memory

// Instructions with Arguments of One Register & Two Immediates
export const OPCODE_STORE_IMM_IND_U8: u8 = 70 // Store immediate to indexed memory (8-bit)
export const OPCODE_STORE_IMM_IND_U16: u8 = 71 // Store immediate to indexed memory (16-bit)
export const OPCODE_STORE_IMM_IND_U32: u8 = 72 // Store immediate to indexed memory (32-bit)
export const OPCODE_STORE_IMM_IND_U64: u8 = 73 // Store immediate to indexed memory (64-bit)

// Instructions with Arguments of One Register, One Immediate and One Offset
export const OPCODE_LOAD_IMM_JUMP: u8 = 80 // Load immediate and jump
export const OPCODE_BRANCH_EQ_IMM: u8 = 81 // Branch if equal to immediate
export const OPCODE_BRANCH_NE_IMM: u8 = 82 // Branch if not equal to immediate
export const OPCODE_BRANCH_LT_U_IMM: u8 = 83 // Branch if less than immediate (unsigned)
export const OPCODE_BRANCH_LE_U_IMM: u8 = 84 // Branch if less than or equal to immediate (unsigned)
export const OPCODE_BRANCH_GE_U_IMM: u8 = 85 // Branch if greater than or equal to immediate (unsigned)
export const OPCODE_BRANCH_GT_U_IMM: u8 = 86 // Branch if greater than immediate (unsigned)
export const OPCODE_BRANCH_LT_S_IMM: u8 = 87 // Branch if less than immediate (signed)
export const OPCODE_BRANCH_LE_S_IMM: u8 = 88 // Branch if less than or equal to immediate (signed)
export const OPCODE_BRANCH_GE_S_IMM: u8 = 89 // Branch if greater than or equal to immediate (signed)
export const OPCODE_BRANCH_GT_S_IMM: u8 = 90 // Branch if greater than immediate (signed)

// Instructions with Arguments of Two Registers
export const OPCODE_MOVE_REG: u8 = 100 // Move register to register
export const OPCODE_SBRK: u8 = 101 // Allocate memory
export const OPCODE_COUNT_SET_BITS_64: u8 = 102 // Count set bits in 64-bit register
export const OPCODE_COUNT_SET_BITS_32: u8 = 103 // Count set bits in 32-bit register
export const OPCODE_LEADING_ZERO_BITS_64: u8 = 104 // Count leading zero bits in 64-bit register
export const OPCODE_LEADING_ZERO_BITS_32: u8 = 105 // Count leading zero bits in 32-bit register
export const OPCODE_TRAILING_ZERO_BITS_64: u8 = 106 // Count trailing zero bits in 64-bit register
export const OPCODE_TRAILING_ZERO_BITS_32: u8 = 107 // Count trailing zero bits in 32-bit register
export const OPCODE_SIGN_EXTEND_8: u8 = 108 // Sign extend 8-bit value
export const OPCODE_SIGN_EXTEND_16: u8 = 109 // Sign extend 16-bit value
export const OPCODE_ZERO_EXTEND_16: u8 = 110 // Zero extend 16-bit value
export const OPCODE_REVERSE_BYTES: u8 = 111 // Reverse byte order

// Instructions with Arguments of Two Registers & One Immediate
export const OPCODE_STORE_IND_U8: u8 = 120 // Store to indexed memory (8-bit)
export const OPCODE_STORE_IND_U16: u8 = 121 // Store to indexed memory (16-bit)
export const OPCODE_STORE_IND_U32: u8 = 122 // Store to indexed memory (32-bit)
export const OPCODE_STORE_IND_U64: u8 = 123 // Store to indexed memory (64-bit)
export const OPCODE_LOAD_IND_U8: u8 = 124 // Load from indexed memory (8-bit)
export const OPCODE_LOAD_IND_I8: u8 = 125 // Load from indexed memory (8-bit signed)
export const OPCODE_LOAD_IND_U16: u8 = 126 // Load from indexed memory (16-bit)
export const OPCODE_LOAD_IND_I16: u8 = 127 // Load from indexed memory (16-bit signed)
export const OPCODE_LOAD_IND_U32: u8 = 128 // Load from indexed memory (32-bit)
export const OPCODE_LOAD_IND_I32: u8 = 129 // Load from indexed memory (32-bit signed)
export const OPCODE_LOAD_IND_U64: u8 = 130 // Load from indexed memory (64-bit)
export const OPCODE_ADD_IMM_32: u8 = 131 // Add immediate to 32-bit register
export const OPCODE_AND_IMM: u8 = 132 // Bitwise AND with immediate
export const OPCODE_XOR_IMM: u8 = 133 // Bitwise XOR with immediate
export const OPCODE_OR_IMM: u8 = 134 // Bitwise OR with immediate
export const OPCODE_MUL_IMM_32: u8 =  135 // Multiply 32-bit register by immediate
export const OPCODE_SET_LT_U_IMM: u8 = 136 // Set if less than immediate (unsigned)
export const OPCODE_SET_LT_S_IMM: u8 = 137 // Set if less than immediate (signed)
export const OPCODE_SHLO_L_IMM_32: u8 = 138 // Shift left by immediate (32-bit)
export const OPCODE_SHLO_R_IMM_32: u8 = 139 // Shift right logical by immediate (32-bit)
export const OPCODE_SHAR_R_IMM_32: u8 = 140 // Shift right arithmetic by immediate (32-bit)
export const OPCODE_NEG_ADD_IMM_32: u8 = 141 // Negate and add immediate (32-bit)
export const OPCODE_SET_GT_U_IMM: u8 = 142 // Set if greater than immediate (unsigned)
export const OPCODE_SET_GT_S_IMM: u8 = 143 // Set if greater than immediate (signed)
export const OPCODE_SHLO_L_IMM_ALT_32: u8 = 144 // Alternative shift left by immediate (32-bit)
export const OPCODE_SHLO_R_IMM_ALT_32: u8 = 145 // Alternative shift right logical by immediate (32-bit)
export const OPCODE_SHAR_R_IMM_ALT_32: u8 = 146 // Alternative shift right arithmetic by immediate (32-bit)
export const OPCODE_CMOV_IZ_IMM: u8 = 147 // Conditional move if zero with immediate
export const OPCODE_CMOV_NZ_IMM: u8 = 148 // Conditional move if not zero with immediate
export const OPCODE_ADD_IMM_64: u8 = 149 // Add immediate to 64-bit register
export const OPCODE_MUL_IMM_64: u8 = 150 // Multiply 64-bit register by immediate
export const OPCODE_SHLO_L_IMM_64: u8 = 151 // Shift left by immediate (64-bit)
export const OPCODE_SHLO_R_IMM_64: u8 = 152 // Shift right logical by immediate (64-bit)
export const OPCODE_SHAR_R_IMM_64: u8 = 153 // Shift right arithmetic by immediate (64-bit)
export const OPCODE_NEG_ADD_IMM_64: u8 = 154 // Negate and add immediate (64-bit)
export const OPCODE_SHLO_L_IMM_ALT_64: u8 = 155 // Alternative shift left by immediate (64-bit)
export const OPCODE_SHLO_R_IMM_ALT_64: u8 = 156 // Alternative shift right logical by immediate (64-bit)
export const OPCODE_SHAR_R_IMM_ALT_64: u8 = 157 // Alternative shift right arithmetic by immediate (64-bit)
export const OPCODE_ROT_R_64_IMM: u8 = 158 // Rotate right by immediate (64-bit)
export const OPCODE_ROT_R_64_IMM_ALT: u8 = 159 // Alternative rotate right by immediate (64-bit)
export const OPCODE_ROT_R_32_IMM: u8 = 160 // Rotate right by immediate (32-bit)
export const OPCODE_ROT_R_32_IMM_ALT: u8 = 161 // Alternative rotate right by immediate (32-bit)

// Instructions with Arguments of Two Registers & One Offset
export const OPCODE_BRANCH_EQ: u8 = 170 // Branch if equal
export const OPCODE_BRANCH_NE: u8 = 171 // Branch if not equal
export const OPCODE_BRANCH_LT_U: u8 = 172 // Branch if less than (unsigned)
export const OPCODE_BRANCH_LT_S: u8 = 173 // Branch if less than (signed)
export const OPCODE_BRANCH_GE_U: u8 = 174 // Branch if greater than or equal (unsigned)
export const OPCODE_BRANCH_GE_S: u8 = 175 // Branch if greater than or equal (signed)

// Instructions with Arguments of Two Registers and Two Immediates
export const OPCODE_LOAD_IMM_JUMP_IND: u8 = 180 // Load immediate and indirect jump

// Instructions with Arguments of Three Registers
export const OPCODE_ADD_32: u8 = 190 // Add 32-bit registers
export const OPCODE_SUB_32: u8 = 191 // Subtract 32-bit registers
export const OPCODE_MUL_32: u8 = 192 // Multiply 32-bit registers
export const OPCODE_DIV_U_32: u8 = 193 // Divide 32-bit registers (unsigned)
export const OPCODE_DIV_S_32: u8 = 194 // Divide 32-bit registers (signed)
export const OPCODE_REM_U_32: u8 = 195 // Remainder 32-bit registers (unsigned)
export const OPCODE_REM_S_32: u8 = 196 // Remainder 32-bit registers (signed)
export const OPCODE_SHLO_L_32: u8 = 197 // Shift left (32-bit)
export const OPCODE_SHLO_R_32: u8 = 198 // Shift right logical (32-bit)
export const OPCODE_SHAR_R_32: u8 = 199 // Shift right arithmetic (32-bit)
export const OPCODE_ADD_64: u8 = 200 // Add 64-bit registers
export const OPCODE_SUB_64: u8 = 201 // Subtract 64-bit registers
export const OPCODE_MUL_64: u8 = 202 // Multiply 64-bit registers
export const OPCODE_DIV_U_64: u8 = 203 // Divide 64-bit registers (unsigned)
export const OPCODE_DIV_S_64: u8 = 204 // Divide 64-bit registers (signed)
export const OPCODE_REM_U_64: u8 = 205 // Remainder 64-bit registers (unsigned)
export const OPCODE_REM_S_64: u8 = 206 // Remainder 64-bit registers (signed)
export const OPCODE_SHLO_L_64: u8 = 207 // Shift left (64-bit)
export const OPCODE_SHLO_R_64: u8 = 208 // Shift right logical (64-bit)
export const OPCODE_SHAR_R_64: u8 = 209 // Shift right arithmetic (64-bit)
export const OPCODE_AND: u8 = 210 // Bitwise AND
export const OPCODE_XOR: u8 = 211 // Bitwise XOR
export const OPCODE_OR: u8 = 212 // Bitwise OR
export const OPCODE_MUL_UPPER_S_S: u8 = 213 // Multiply upper bits (signed × signed)
export const OPCODE_MUL_UPPER_U_U: u8 = 214 // Multiply upper bits (unsigned × unsigned)
export const OPCODE_MUL_UPPER_S_U: u8 = 215 // Multiply upper bits (signed × unsigned)
export const OPCODE_SET_LT_U: u8 = 216 // Set if less than (unsigned)
export const OPCODE_SET_LT_S: u8 = 217 // Set if less than (signed)
export const OPCODE_CMOV_IZ: u8 = 218 // Conditional move if zero
export const OPCODE_CMOV_NZ: u8 = 219 // Conditional move if not zero
export const OPCODE_ROT_L_64: u8 = 220 // Rotate left (64-bit)
export const OPCODE_ROT_L_32: u8 = 221 // Rotate left (32-bit)
export const OPCODE_ROT_R_64: u8 = 222 // Rotate right (64-bit)
export const OPCODE_ROT_R_32: u8 = 223 // Rotate right (32-bit)
export const OPCODE_AND_INV: u8 = 224 // Bitwise AND with inverse
export const OPCODE_OR_INV: u8 = 225 // Bitwise OR with inverse
export const OPCODE_XNOR: u8 = 226 // Bitwise XNOR
export const OPCODE_MAX: u8 = 227 // Maximum (signed)
export const OPCODE_MAX_U: u8 = 228 // Maximum (unsigned)
export const OPCODE_MIN: u8 = 229 // Minimum (signed)
export const OPCODE_MIN_U: u8 = 230 // Minimum (unsigned)

// ============================================================================
// Gray Paper Constants
// ============================================================================
export const PACKAGE_AUTH_GAS: u32 = 50_000_000 // Cpackageauthgas = 50,000,000
export const MAX_AUTH_CODE_SIZE: u32 = 64_000 // Cmaxauthcodesize = 64,000

export const PACKAGE_REF_GAS: u64 = 5_000_000_000 // Cpackagerefgas = 5,000,000,000
export const MAX_SERVICE_CODE_SIZE: u32 = 4_000_000 // Cmaxservicecodesize = 4,000,000
export const SEGMENT_SIZE: u32 = 4_104 // Csegmentsize = 4104
export const MAX_PACKAGE_EXPORTS: u32 = 3_072 // Cmaxpackageexports = 3,072

export const MIN_PUBLIC_INDEX: u32 = 65536 // Cminpublicindex = 2^16

// ============================================================================
// General Function Identifiers (Gray Paper Appendix B.7)
// ============================================================================
export const FUNC_GAS: u8 = 0
export const FUNC_FETCH: u8 = 1
export const FUNC_LOOKUP: u8 = 2
export const FUNC_READ: u8 = 3
export const FUNC_WRITE: u8 = 4
export const FUNC_INFO: u8 = 5
export const FUNC_HISTORICAL_LOOKUP: u8 = 6
export const FUNC_EXPORT: u8 = 7
export const FUNC_MACHINE: u8 = 8
export const FUNC_PEEK: u8 = 9
export const FUNC_POKE: u8 = 10
export const FUNC_PAGES: u8 = 11
export const FUNC_INVOKE: u8 = 12
export const FUNC_EXPUNGE: u8 = 13
export const FUNC_LOG: u8 = 100

// ============================================================================
// Accumulate Function Identifiers (Gray Paper Appendix B.7)
// ============================================================================
export const FUNC_BLESS: u8 = 14
export const FUNC_ASSIGN: u8 = 15
export const FUNC_DESIGNATE: u8 = 16
export const FUNC_CHECKPOINT: u8 = 17
export const FUNC_NEW: u8 = 18
export const FUNC_UPGRADE: u8 = 19
export const FUNC_TRANSFER: u8 = 20
export const FUNC_EJECT: u8 = 21
export const FUNC_QUERY: u8 = 22
export const FUNC_SOLICIT: u8 = 23
export const FUNC_FORGET: u8 = 24
export const FUNC_YIELD: u8 = 25
export const FUNC_PROVIDE: u8 = 26

// ============================================================================
// Accumulate Error Codes (Gray Paper section 31.2)
// ============================================================================
export const ERROR_NONE: i64 = -1 // The return value indicating an item does not exist (2^64 - 1)
export const ERROR_WHAT: i64 = -2 // Name unknown
export const ERROR_OOB: i64 = -3 // Memory index not accessible
export const ERROR_WHO: i64 = -4 // Index unknown
export const ERROR_FULL: i64 = -5 // Storage full or resource already allocated
export const ERROR_CORE: i64 = -6 // Core index unknown
export const ERROR_CASH: i64 = -7 // Insufficient funds
export const ERROR_LOW: i64 = -8 // Gas limit too low
export const ERROR_HUH: i64 = -9 // Already solicited, cannot be forgotten or operation invalid
export const ERROR_OK: i64 = 0 // General success

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an opcode is a basic block termination instruction
 *
 * @param opcode - The opcode to check
 * @returns true if the opcode is a termination instruction
 */
export function isTerminationInstruction(opcode: u8): boolean {
  // Trap and fallthrough
  if (opcode === OPCODE_TRAP || opcode === OPCODE_FALLTHROUGH) return true
  
  // Jumps
  if (opcode === OPCODE_JUMP || opcode === OPCODE_JUMP_IND) return true
  
  // Load-and-Jumps
  if (opcode === OPCODE_LOAD_IMM_JUMP || opcode === OPCODE_LOAD_IMM_JUMP_IND) return true
  
  // Branches (register-based)
  if (opcode >= OPCODE_BRANCH_EQ && opcode <= OPCODE_BRANCH_GE_S) return true // 170-175
  
  // Branches (immediate-based)
  if (opcode >= OPCODE_BRANCH_EQ_IMM && opcode <= OPCODE_BRANCH_GT_S_IMM) return true // 81-90
  
  return false
}

// ============================================================================
// Config Objects (for compatibility with TypeScript code)
// ============================================================================
// Note: AssemblyScript requires explicit type annotations for exported objects
// All config values are accessed via class static properties to avoid WASM export issues

export function REGISTER_INIT_STACK_SEGMENT_END(): u32 { return STACK_SEGMENT_END }
export function REGISTER_INIT_ARGS_SEGMENT_START(): u32 { return ARGS_SEGMENT_START }

// Compatibility shims - use classes with static readonly properties
// This provides proper typing in AssemblyScript while maintaining object-like access
export class INIT_CONFIG {
  static readonly ZONE_SIZE: u32 = ZONE_SIZE
  static readonly INIT_INPUT_SIZE: u32 = INIT_INPUT_SIZE
}

export class MEMORY_CONFIG {
  static readonly PAGE_SIZE: u32 = PAGE_SIZE
  static readonly RESERVED_MEMORY_END: u32 = RESERVED_MEMORY_END
  static readonly MAX_MEMORY_ADDRESS: u32 = MAX_MEMORY_ADDRESS
}

export class REGISTER_INIT {
  static readonly HALT_ADDRESS: u32 = HALT_ADDRESS
  static readonly STACK_SEGMENT_END: u32 = STACK_SEGMENT_END
  static readonly ARGS_SEGMENT_START: u32 = ARGS_SEGMENT_START
}

export class RESULT_CODES {
  static readonly HALT: u8 = RESULT_CODE_HALT
  static readonly PANIC: u8 = RESULT_CODE_PANIC
  static readonly FAULT: i32 = RESULT_CODE_FAULT
  static readonly HOST: u8 = RESULT_CODE_HOST
  static readonly OOG: u8 = RESULT_CODE_OOG
}

export class GENERAL_FUNCTIONS {
  static readonly GAS: u8 = FUNC_GAS
  static readonly FETCH: u8 = FUNC_FETCH
  static readonly LOOKUP: u8 = FUNC_LOOKUP
  static readonly READ: u8 = FUNC_READ
  static readonly WRITE: u8 = FUNC_WRITE
  static readonly INFO: u8 = FUNC_INFO
  static readonly HISTORICAL_LOOKUP: u8 = FUNC_HISTORICAL_LOOKUP
  static readonly EXPORT: u8 = FUNC_EXPORT
  static readonly MACHINE: u8 = FUNC_MACHINE
  static readonly PEEK: u8 = FUNC_PEEK
  static readonly POKE: u8 = FUNC_POKE
  static readonly PAGES: u8 = FUNC_PAGES
  static readonly INVOKE: u8 = FUNC_INVOKE
  static readonly EXPUNGE: u8 = FUNC_EXPUNGE
  static readonly LOG: u8 = FUNC_LOG
}

export class ACCUMULATE_FUNCTIONS {
  static readonly BLESS: u8 = FUNC_BLESS
  static readonly ASSIGN: u8 = FUNC_ASSIGN
  static readonly DESIGNATE: u8 = FUNC_DESIGNATE
  static readonly CHECKPOINT: u8 = FUNC_CHECKPOINT
  static readonly NEW: u8 = FUNC_NEW
  static readonly UPGRADE: u8 = FUNC_UPGRADE
  static readonly TRANSFER: u8 = FUNC_TRANSFER
  static readonly EJECT: u8 = FUNC_EJECT
  static readonly QUERY: u8 = FUNC_QUERY
  static readonly SOLICIT: u8 = FUNC_SOLICIT
  static readonly FORGET: u8 = FUNC_FORGET
  static readonly YIELD: u8 = FUNC_YIELD
  static readonly PROVIDE: u8 = FUNC_PROVIDE
}

export class ACCUMULATE_ERROR_CODES {
  static readonly NONE: i64 = ERROR_NONE
  static readonly WHAT: i64 = ERROR_WHAT
  static readonly OOB: i64 = ERROR_OOB
  static readonly WHO: i64 = ERROR_WHO
  static readonly FULL: i64 = ERROR_FULL
  static readonly CORE: i64 = ERROR_CORE
  static readonly CASH: i64 = ERROR_CASH
  static readonly LOW: i64 = ERROR_LOW
  static readonly HUH: i64 = ERROR_HUH
  static readonly OK: i64 = ERROR_OK
}

export class REFINE_CONFIG {
  // Empty class for compatibility
}
