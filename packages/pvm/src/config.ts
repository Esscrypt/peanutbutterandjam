/**
 * PVM Configuration Constants
 *
 * Centralized configuration for the PVM runtime, following Gray Paper specifications
 * Based on Appendix A instruction tables from the Gray Paper
 */

// Gas configuration
export const GAS_CONFIG = {
  DEFAULT_GAS_LIMIT: 4_294_967_296n, // 2^32
  MIN_GAS_COST: 1n,
  MAX_GAS_COST: 1_000_000n,
} as const

// Memory configuration
export const MEMORY_CONFIG = {
  RESERVED_MEMORY_START: 65_536n, // 64KB (2^16)
  MAX_MEMORY_ADDRESS: 2_147_483_647n, // 2^31 - 1
  INITIAL_ZONE_SIZE: 65_536n, // 64KB (2^16) - Gray Paper Cpvminitzonesize
  PAGE_SIZE: 4_096n, // 4KB (2^12) - Gray Paper Cpvmpagesize
  DYNAMIC_ADDRESS_ALIGNMENT: 2, // Gray Paper Cpvmdynaddralign
} as const

// Program initialization configuration
export const INIT_CONFIG = {
  INIT_ZONE_SIZE: 65_536n, // 64KB (2^16) - Gray Paper Cpvminitzonesize
  INIT_INPUT_SIZE: 16_777_216n, // 16MB (2^24) - Gray Paper Cpvminitinputsize
} as const

// Register configuration
export const REGISTER_CONFIG = {
  COUNT_64BIT: 8n, // r0-r7
  COUNT_32BIT: 5n, // r8-r12
  TOTAL_COUNT: 13n,
} as const

// Instruction configuration
export const INSTRUCTION_CONFIG = {
  MAX_OPCODE: 255n,
  MAX_OPERANDS: 8n,
  DEFAULT_LENGTH: 4n,
} as const

// Result codes as specified in Gray Paper
export const RESULT_CODES = {
  HALT: 0, // The invocation completed and halted normally
  PANIC: 1, // The invocation completed with a panic
  FAULT: 2, // The invocation completed with a page fault
  HOST: 3, // The invocation completed with a host-call fault
  OOG: 4, // The invocation completed by running out of gas
} as const

// Fault types
export const FAULT_TYPES = {
  MEMORY_READ: 'memory_read',
  MEMORY_WRITE: 'memory_write',
  BASIC_BLOCK: 'basic_block',
  JUMP_TABLE: 'jump_table',
  GAS_LIMIT: 'gas_limit',
  GAS: 'gas',
  HOST_CALL: 'host_call',
  PANIC: 'panic',
} as const

// Gray Paper Appendix A Opcode definitions
export const OPCODES = {
  // Instructions without Arguments
  TRAP: 0n, // Panic
  FALLTHROUGH: 1n, // No operation

  // Instructions with Arguments of One Immediate
  ECALLI: 10n, // Host call with immediate value

  // Instructions with Arguments of One Register and One Extended Width Immediate
  LOAD_IMM_64: 20n, // Load 64-bit immediate into register

  // Instructions with Arguments of Two Immediates
  STORE_IMM_U8: 30n, // Store 8-bit immediate to memory
  STORE_IMM_U16: 31n, // Store 16-bit immediate to memory
  STORE_IMM_U32: 32n, // Store 32-bit immediate to memory
  STORE_IMM_U64: 33n, // Store 64-bit immediate to memory

  // Instructions with Arguments of One Offset
  JUMP: 40n, // Unconditional jump

  // Instructions with Arguments of One Register & One Immediate
  JUMP_IND: 50n, // Indirect jump
  LOAD_IMM: 51n, // Load immediate into register
  LOAD_U8: 52n, // Load unsigned 8-bit from memory
  LOAD_I8: 53n, // Load signed 8-bit from memory
  LOAD_U16: 54n, // Load unsigned 16-bit from memory
  LOAD_I16: 55n, // Load signed 16-bit from memory
  LOAD_U32: 56n, // Load unsigned 32-bit from memory
  LOAD_I32: 57n, // Load signed 32-bit from memory
  LOAD_U64: 58n, // Load unsigned 64-bit from memory
  STORE_U8: 59n, // Store 8-bit to memory
  STORE_U16: 60n, // Store 16-bit to memory
  STORE_U32: 61n, // Store 32-bit to memory
  STORE_U64: 62n, // Store 64-bit to memory

  // Instructions with Arguments of One Register & Two Immediates
  STORE_IMM_IND_U8: 70n, // Store immediate to indexed memory (8-bit)
  STORE_IMM_IND_U16: 71n, // Store immediate to indexed memory (16-bit)
  STORE_IMM_IND_U32: 72n, // Store immediate to indexed memory (32-bit)
  STORE_IMM_IND_U64: 73n, // Store immediate to indexed memory (64-bit)

  // Instructions with Arguments of One Register, One Immediate and One Offset
  LOAD_IMM_JUMP: 80n, // Load immediate and jump
  BRANCH_EQ_IMM: 81n, // Branch if equal to immediate
  BRANCH_NE_IMM: 82n, // Branch if not equal to immediate
  BRANCH_LT_U_IMM: 83n, // Branch if less than immediate (unsigned)
  BRANCH_LE_U_IMM: 84n, // Branch if less than or equal to immediate (unsigned)
  BRANCH_GE_U_IMM: 85n, // Branch if greater than or equal to immediate (unsigned)
  BRANCH_GT_U_IMM: 86n, // Branch if greater than immediate (unsigned)
  BRANCH_LT_S_IMM: 87n, // Branch if less than immediate (signed)
  BRANCH_LE_S_IMM: 88n, // Branch if less than or equal to immediate (signed)
  BRANCH_GE_S_IMM: 89n, // Branch if greater than or equal to immediate (signed)
  BRANCH_GT_S_IMM: 90n, // Branch if greater than immediate (signed)

  // Instructions with Arguments of Two Registers
  MOVE_REG: 100n, // Move register to register
  SBRK: 101n, // Allocate memory
  COUNT_SET_BITS_64: 102n, // Count set bits in 64-bit register
  COUNT_SET_BITS_32: 103n, // Count set bits in 32-bit register
  LEADING_ZERO_BITS_64: 104n, // Count leading zero bits in 64-bit register
  LEADING_ZERO_BITS_32: 105n, // Count leading zero bits in 32-bit register
  TRAILING_ZERO_BITS_64: 106n, // Count trailing zero bits in 64-bit register
  TRAILING_ZERO_BITS_32: 107n, // Count trailing zero bits in 32-bit register
  SIGN_EXTEND_8: 108n, // Sign extend 8-bit value
  SIGN_EXTEND_16: 109n, // Sign extend 16-bit value
  ZERO_EXTEND_16: 110n, // Zero extend 16-bit value
  REVERSE_Uint8Array: 111n, // Reverse byte order

  // Instructions with Arguments of Two Registers & One Immediate
  STORE_IND_U8: 120n, // Store to indexed memory (8-bit)
  STORE_IND_U16: 121n, // Store to indexed memory (16-bit)
  STORE_IND_U32: 122n, // Store to indexed memory (32-bit)
  STORE_IND_U64: 123n, // Store to indexed memory (64-bit)
  LOAD_IND_U8: 124n, // Load from indexed memory (8-bit)
  LOAD_IND_I8: 125n, // Load from indexed memory (8-bit signed)
  LOAD_IND_U16: 126n, // Load from indexed memory (16-bit)
  LOAD_IND_I16: 127n, // Load from indexed memory (16-bit signed)
  LOAD_IND_U32: 128n, // Load from indexed memory (32-bit)
  LOAD_IND_I32: 129n, // Load from indexed memory (32-bit signed)
  LOAD_IND_U64: 130n, // Load from indexed memory (64-bit)
  ADD_IMM_32: 131n, // Add immediate to 32-bit register
  AND_IMM: 132n, // Bitwise AND with immediate
  XOR_IMM: 133n, // Bitwise XOR with immediate
  OR_IMM: 134n, // Bitwise OR with immediate
  MUL_IMM_32: 135n, // Multiply 32-bit register by immediate
  SET_LT_U_IMM: 136n, // Set if less than immediate (unsigned)
  SET_LT_S_IMM: 137n, // Set if less than immediate (signed)
  SHLO_L_IMM_32: 138n, // Shift left by immediate (32-bit)
  SHLO_R_IMM_32: 139n, // Shift right logical by immediate (32-bit)
  SHAR_R_IMM_32: 140n, // Shift right arithmetic by immediate (32-bit)
  NEG_ADD_IMM_32: 141n, // Negate and add immediate (32-bit)
  SET_GT_U_IMM: 142n, // Set if greater than immediate (unsigned)
  SET_GT_S_IMM: 143n, // Set if greater than immediate (signed)
  SHLO_L_IMM_ALT_32: 144n, // Alternative shift left by immediate (32-bit)
  SHLO_R_IMM_ALT_32: 145n, // Alternative shift right logical by immediate (32-bit)
  SHAR_R_IMM_ALT_32: 146n, // Alternative shift right arithmetic by immediate (32-bit)
  CMOV_IZ_IMM: 147n, // Conditional move if zero with immediate
  CMOV_NZ_IMM: 148n, // Conditional move if not zero with immediate
  ADD_IMM_64: 149n, // Add immediate to 64-bit register
  MUL_IMM_64: 150n, // Multiply 64-bit register by immediate
  SHLO_L_IMM_64: 151n, // Shift left by immediate (64-bit)
  SHLO_R_IMM_64: 152n, // Shift right logical by immediate (64-bit)
  SHAR_R_IMM_64: 153n, // Shift right arithmetic by immediate (64-bit)
  NEG_ADD_IMM_64: 154n, // Negate and add immediate (64-bit)
  SHLO_L_IMM_ALT_64: 155n, // Alternative shift left by immediate (64-bit)
  SHLO_R_IMM_ALT_64: 156n, // Alternative shift right logical by immediate (64-bit)
  SHAR_R_IMM_ALT_64: 157n, // Alternative shift right arithmetic by immediate (64-bit)
  ROT_R_64_IMM: 158n, // Rotate right by immediate (64-bit)
  ROT_R_64_IMM_ALT: 159n, // Alternative rotate right by immediate (64-bit)
  ROT_R_32_IMM: 160n, // Rotate right by immediate (32-bit)
  ROT_R_32_IMM_ALT: 161n, // Alternative rotate right by immediate (32-bit)

  // Instructions with Arguments of Two Registers & One Offset
  BRANCH_EQ: 170n, // Branch if equal
  BRANCH_NE: 171n, // Branch if not equal
  BRANCH_LT_U: 172n, // Branch if less than (unsigned)
  BRANCH_LT_S: 173n, // Branch if less than (signed)
  BRANCH_GE_U: 174n, // Branch if greater than or equal (unsigned)
  BRANCH_GE_S: 175n, // Branch if greater than or equal (signed)

  // Instructions with Arguments of Two Registers and Two Immediates
  LOAD_IMM_JUMP_IND: 180n, // Load immediate and indirect jump

  // Instructions with Arguments of Three Registers
  ADD_32: 190n, // Add 32-bit registers
  SUB_32: 191n, // Subtract 32-bit registers
  MUL_32: 192n, // Multiply 32-bit registers
  DIV_U_32: 193n, // Divide 32-bit registers (unsigned)
  DIV_S_32: 194n, // Divide 32-bit registers (signed)
  REM_U_32: 195n, // Remainder 32-bit registers (unsigned)
  REM_S_32: 196n, // Remainder 32-bit registers (signed)
  SHLO_L_32: 197n, // Shift left (32-bit)
  SHLO_R_32: 198n, // Shift right logical (32-bit)
  SHAR_R_32: 199n, // Shift right arithmetic (32-bit)
  ADD_64: 200n, // Add 64-bit registers
  SUB_64: 201n, // Subtract 64-bit registers
  MUL_64: 202n, // Multiply 64-bit registers
  DIV_U_64: 203n, // Divide 64-bit registers (unsigned)
  DIV_S_64: 204n, // Divide 64-bit registers (signed)
  REM_U_64: 205n, // Remainder 64-bit registers (unsigned)
  REM_S_64: 206n, // Remainder 64-bit registers (signed)
  SHLO_L_64: 207n, // Shift left (64-bit)
  SHLO_R_64: 208n, // Shift right logical (64-bit)
  SHAR_R_64: 209n, // Shift right arithmetic (64-bit)
  AND: 210n, // Bitwise AND
  XOR: 211n, // Bitwise XOR
  OR: 212n, // Bitwise OR
  MUL_UPPER_S_S: 213n, // Multiply upper bits (signed × signed)
  MUL_UPPER_U_U: 214n, // Multiply upper bits (unsigned × unsigned)
  MUL_UPPER_S_U: 215n, // Multiply upper bits (signed × unsigned)
  SET_LT_U: 216n, // Set if less than (unsigned)
  SET_LT_S: 217n, // Set if less than (signed)
  CMOV_IZ: 218n, // Conditional move if zero
  CMOV_NZ: 219n, // Conditional move if not zero
  ROT_L_64: 220n, // Rotate left (64-bit)
  ROT_L_32: 221n, // Rotate left (32-bit)
  ROT_R_64: 222n, // Rotate right (64-bit)
  ROT_R_32: 223n, // Rotate right (32-bit)
  AND_INV: 224n, // Bitwise AND with inverse
  OR_INV: 225n, // Bitwise OR with inverse
  XNOR: 226n, // Bitwise XNOR
  MAX: 227n, // Maximum (signed)
  MAX_U: 228n, // Maximum (unsigned)
  MIN: 229n, // Minimum (signed)
  MIN_U: 230n, // Minimum (unsigned)
} as const

// Gray Paper Is-Authorized constants
export const IS_AUTHORIZED_CONFIG = {
  PACKAGE_AUTH_GAS: 50_000_000n, // Cpackageauthgas = 50,000,000
  MAX_AUTH_CODE_SIZE: 64_000n, // Cmaxauthcodesize = 64,000
} as const

// Gray Paper Refine Invocation constants
export const REFINE_CONFIG = {
  PACKAGE_REF_GAS: 5_000_000_000n, // Cpackagerefgas = 5,000,000,000
  MAX_SERVICE_CODE_SIZE: 4_000_000n, // Cmaxservicecodesize = 4,000,000
  SEGMENT_SIZE: 4_104n, // Csegmentsize = 4104
  MAX_PACKAGE_EXPORTS: 3_072n, // Cmaxpackageexports = 3,072
} as const

// Gray Paper Accumulate Invocation constants
export const ACCUMULATE_INVOCATION_CONFIG = {
  MAX_SERVICE_CODE_SIZE: 4_000_000n, // Cmaxservicecodesize = 4,000,000
  MIN_PUBLIC_INDEX: 1_000_000n, // Cminpublicindex = 1,000,000
  ENTROPY_ACCUMULATOR: 'entropy', // Placeholder for entropy accumulator
} as const

// Instruction length mapping based on Gray Paper skip distance calculations
export const INSTRUCTION_LENGTHS = {
  // Instructions without Arguments (length 1)
  TRAP: 1n,
  FALLTHROUGH: 1n,

  // Instructions with Arguments of One Immediate (variable length)
  ECALLI: 2n, // 1 byte opcode + 1 byte immediate

  // Instructions with Arguments of One Register and One Extended Width Immediate
  LOAD_IMM_64: 10n, // 1 byte opcode + 1 byte register + 8 Uint8Array immediate

  // Instructions with Arguments of Two Immediates (variable length)
  STORE_IMM_U8: 3n, // 1 byte opcode + 1 byte address + 1 byte value
  STORE_IMM_U16: 4n, // 1 byte opcode + 1 byte address + 2 Uint8Array value
  STORE_IMM_U32: 6n, // 1 byte opcode + 1 byte address + 4 Uint8Array value
  STORE_IMM_U64: 10n, // 1 byte opcode + 1 byte address + 8 Uint8Array value

  // Instructions with Arguments of One Offset (variable length)
  JUMP: 3n, // 1 byte opcode + 2 Uint8Array offset

  // Instructions with Arguments of One Register & One Immediate (variable length)
  JUMP_IND: 3n, // 1 byte opcode + 1 byte register + 1 byte immediate
  LOAD_IMM: 3n, // 1 byte opcode + 1 byte register + 1 byte immediate
  LOAD_U8: 3n, // 1 byte opcode + 1 byte register + 1 byte address
  LOAD_I8: 3n, // 1 byte opcode + 1 byte register + 1 byte address
  LOAD_U16: 4n, // 1 byte opcode + 1 byte register + 2 Uint8Array address
  LOAD_I16: 4n, // 1 byte opcode + 1 byte register + 2 Uint8Array address
  LOAD_U32: 6n, // 1 byte opcode + 1 byte register + 4 Uint8Array address
  LOAD_I32: 6n, // 1 byte opcode + 1 byte register + 4 Uint8Array address
  LOAD_U64: 10n, // 1 byte opcode + 1 byte register + 8 Uint8Array address
  STORE_U8: 3n, // 1 byte opcode + 1 byte register + 1 byte address
  STORE_U16: 4n, // 1 byte opcode + 1 byte register + 2 Uint8Array address
  STORE_U32: 6n, // 1 byte opcode + 1 byte register + 4 Uint8Array address
  STORE_U64: 10n, // 1 byte opcode + 1 byte register + 8 Uint8Array address

  // Instructions with Arguments of One Register & Two Immediates
  STORE_IMM_IND_U8: 4n, // 1 byte opcode + 1 byte register + 1 byte offset + 1 byte value
  STORE_IMM_IND_U16: 5n, // 1 byte opcode + 1 byte register + 1 byte offset + 2 Uint8Array value
  STORE_IMM_IND_U32: 7n, // 1 byte opcode + 1 byte register + 1 byte offset + 4 Uint8Array value
  STORE_IMM_IND_U64: 11n, // 1 byte opcode + 1 byte register + 1 byte offset + 8 Uint8Array value

  // Instructions with Arguments of One Register, One Immediate and One Offset
  LOAD_IMM_JUMP: 5n, // 1 byte opcode + 1 byte register + 1 byte immediate + 2 Uint8Array offset
  BRANCH_EQ_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_NE_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_LT_U_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_LE_U_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_GE_U_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_GT_U_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_LT_S_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_LE_S_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_GE_S_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  BRANCH_GT_S_IMM: 4n, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset

  // Instructions with Arguments of Two Registers (length 2)
  MOVE_REG: 2n,
  SBRK: 2n,
  COUNT_SET_BITS_64: 2n,
  COUNT_SET_BITS_32: 2n,
  LEADING_ZERO_BITS_64: 2n,
  LEADING_ZERO_BITS_32: 2n,
  TRAILING_ZERO_BITS_64: 2n,
  TRAILING_ZERO_BITS_32: 2n,
  SIGN_EXTEND_8: 2n,
  SIGN_EXTEND_16: 2n,
  ZERO_EXTEND_16: 2n,
  REVERSE_Uint8Array: 2n,

  // Instructions with Arguments of Two Registers & One Immediate (variable length)
  STORE_IND_U8: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte immediate
  STORE_IND_U16: 4n, // 1 byte opcode + 2 Uint8Array registers + 2 Uint8Array immediate
  STORE_IND_U32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  STORE_IND_U64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  LOAD_IND_U8: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte immediate
  LOAD_IND_I8: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte immediate
  LOAD_IND_U16: 4n, // 1 byte opcode + 2 Uint8Array registers + 2 Uint8Array immediate
  LOAD_IND_I16: 4n, // 1 byte opcode + 2 Uint8Array registers + 2 Uint8Array immediate
  LOAD_IND_U32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  LOAD_IND_I32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  LOAD_IND_U64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  ADD_IMM_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  AND_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  XOR_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  OR_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  MUL_IMM_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  SET_LT_U_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SET_LT_S_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHLO_L_IMM_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  SHLO_R_IMM_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  SHAR_R_IMM_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  NEG_ADD_IMM_32: 6n, // 1 byte + 2 Uint8Array registers + 4 Uint8Array immediate
  SET_GT_U_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SET_GT_S_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHLO_L_IMM_ALT_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  SHLO_R_IMM_ALT_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  SHAR_R_IMM_ALT_32: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  CMOV_IZ_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  CMOV_NZ_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  ADD_IMM_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  MUL_IMM_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHLO_L_IMM_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHLO_R_IMM_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHAR_R_IMM_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  NEG_ADD_IMM_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHLO_L_IMM_ALT_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHLO_R_IMM_ALT_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  SHAR_R_IMM_ALT_64: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  ROT_R_64_IMM: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  ROT_R_64_IMM_ALT: 10n, // 1 byte opcode + 2 Uint8Array registers + 8 Uint8Array immediate
  ROT_R_32_IMM: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate
  ROT_R_32_IMM_ALT: 6n, // 1 byte opcode + 2 Uint8Array registers + 4 Uint8Array immediate

  // Instructions with Arguments of Two Registers & One Offset (variable length)
  BRANCH_EQ: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte offset
  BRANCH_NE: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte offset
  BRANCH_LT_U: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte offset
  BRANCH_LT_S: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte offset
  BRANCH_GE_U: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte offset
  BRANCH_GE_S: 3n, // 1 byte opcode + 2 Uint8Array registers + 1 byte offset

  // Instructions with Arguments of Two Registers and Two Immediates
  LOAD_IMM_JUMP_IND: 6n, // 1 byte opcode + 2 Uint8Array registers + 1 byte immediate + 2 Uint8Array immediate

  // Instructions with Arguments of Three Registers (length 3)
  ADD_32: 3n,
  SUB_32: 3n,
  MUL_32: 3n,
  DIV_U_32: 3n,
  DIV_S_32: 3n,
  REM_U_32: 3n,
  REM_S_32: 3n,
  SHLO_L_32: 3n,
  SHLO_R_32: 3n,
  SHAR_R_32: 3n,
  ADD_64: 3n,
  SUB_64: 3n,
  MUL_64: 3n,
  DIV_U_64: 3n,
  DIV_S_64: 3n,
  REM_U_64: 3n,
  REM_S_64: 3n,
  SHLO_L_64: 3n,
  SHLO_R_64: 3n,
  SHAR_R_64: 3n,
  AND: 3n,
  XOR: 3n,
  OR: 3n,
  MUL_UPPER_S_S: 3n,
  MUL_UPPER_U_U: 3n,
  MUL_UPPER_S_U: 3n,
  SET_LT_U: 3n,
  SET_LT_S: 3n,
  CMOV_IZ: 3n,
  CMOV_NZ: 3n,
  ROT_L_64: 3n,
  ROT_L_32: 3n,
  ROT_R_64: 3n,
  ROT_R_32: 3n,
  AND_INV: 3n,
  OR_INV: 3n,
  XNOR: 3n,
  MAX: 3n,
  MAX_U: 3n,
  MIN: 3n,
  MIN_U: 3n,
} as const

// Gas costs for instructions (all cost 1 as per Gray Paper)
export const INSTRUCTION_GAS_COSTS = Object.fromEntries(
  Object.values(OPCODES).map((opcode) => [opcode, 1n]),
) as Record<number, bigint>

// Memory gas costs
export const MEMORY_GAS_COSTS = {
  BASE_READ_COST: 1n,
  BASE_WRITE_COST: 1n,
  PER_OCTET_READ_COST: 1n,
  PER_OCTET_WRITE_COST: 1n,
  ALLOCATION_COST: 1n,
} as const

// Default values
export const DEFAULTS = {
  UNKNOWN_INSTRUCTION_LENGTH: 1n,
  DEFAULT_GAS_COST: 1n,
  DEFAULT_MEMORY_COST: 1n,
} as const

// General function identifiers from Gray Paper Appendix B.7
export const GENERAL_FUNCTIONS = {
  GAS: 0n,
  FETCH: 1n,
  LOOKUP: 2n,
  READ: 3n,
  WRITE: 4n,
  INFO: 5n,
  HISTORICAL_LOOKUP: 6n,
  EXPORT: 7n,
  MACHINE: 8n,
  PEEK: 9n,
  POKE: 10n,
  PAGES: 11n,
  INVOKE: 12n,
  EXPUNGE: 13n,
} as const

// Accumulate function identifiers from Gray Paper Appendix B.7
export const ACCUMULATE_FUNCTIONS = {
  BLESS: 14n,
  ASSIGN: 15n,
  DESIGNATE: 16n,
  CHECKPOINT: 17n,
  NEW: 18n,
  UPGRADE: 19n,
  TRANSFER: 20n,
  EJECT: 21n,
  QUERY: 22n,
  SOLICIT: 23n,
  FORGET: 24n,
  YIELD: 25n,
  PROVIDE: 26n,
} as const

// Error codes returned by Accumulate functions (from Gray Paper)
export const ACCUMULATE_ERROR_CODES = {
  NONE: 2n ** 64n - 1n, // The return value indicating an item does not exist
  WHAT: 2n ** 64n - 2n, // Name unknown
  OOB: 2n ** 64n - 3n, // The inner PVM memory index provided for reading/writing is not accessible
  WHO: 2n ** 64n - 4n, // Index unknown
  FULL: 2n ** 64n - 5n, // Storage full or resource already allocated
  CORE: 2n ** 64n - 6n, // Core index unknown
  CASH: 2n ** 64n - 7n, // Insufficient funds
  LOW: 2n ** 64n - 8n, // Gas limit too low
  HUH: 2n ** 64n - 9n, // The item is already solicited, cannot be forgotten or the operation is invalid due to privilege level
  OK: 0n, // The return value indicating general success
} as const
