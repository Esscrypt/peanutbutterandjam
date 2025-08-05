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
  RESERVED_MEMORY_START: 65_536, // 64KB (2^16)
  MAX_MEMORY_ADDRESS: 2_147_483_647, // 2^31 - 1
  INITIAL_ZONE_SIZE: 65_536, // 64KB (2^16) - Gray Paper Cpvminitzonesize
  PAGE_SIZE: 4_096, // 4KB (2^12) - Gray Paper Cpvmpagesize
  DYNAMIC_ADDRESS_ALIGNMENT: 2, // Gray Paper Cpvmdynaddralign
} as const

// Program initialization configuration
export const INIT_CONFIG = {
  INIT_ZONE_SIZE: 65_536, // 64KB (2^16) - Gray Paper Cpvminitzonesize
  INIT_INPUT_SIZE: 16_777_216, // 16MB (2^24) - Gray Paper Cpvminitinputsize
} as const

// Register configuration
export const REGISTER_CONFIG = {
  COUNT_64BIT: 8, // r0-r7
  COUNT_32BIT: 5, // r8-r12
  TOTAL_COUNT: 13,
} as const

// Instruction configuration
export const INSTRUCTION_CONFIG = {
  MAX_OPCODE: 255,
  MAX_OPERANDS: 8,
  DEFAULT_LENGTH: 4,
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
  TRAP: 0x00, // Panic
  FALLTHROUGH: 0x01, // No operation

  // Instructions with Arguments of One Immediate
  ECALLI: 0x10, // Host call with immediate value

  // Instructions with Arguments of One Register and One Extended Width Immediate
  LOAD_IMM_64: 0x20, // Load 64-bit immediate into register

  // Instructions with Arguments of Two Immediates
  STORE_IMM_U8: 0x30, // Store 8-bit immediate to memory
  STORE_IMM_U16: 0x31, // Store 16-bit immediate to memory
  STORE_IMM_U32: 0x32, // Store 32-bit immediate to memory
  STORE_IMM_U64: 0x33, // Store 64-bit immediate to memory

  // Instructions with Arguments of One Offset
  JUMP: 0x40, // Unconditional jump

  // Instructions with Arguments of One Register & One Immediate
  JUMP_IND: 0x50, // Indirect jump
  LOAD_IMM: 0x51, // Load immediate into register
  LOAD_U8: 0x52, // Load unsigned 8-bit from memory
  LOAD_I8: 0x53, // Load signed 8-bit from memory
  LOAD_U16: 0x54, // Load unsigned 16-bit from memory
  LOAD_I16: 0x55, // Load signed 16-bit from memory
  LOAD_U32: 0x56, // Load unsigned 32-bit from memory
  LOAD_I32: 0x57, // Load signed 32-bit from memory
  LOAD_U64: 0x58, // Load unsigned 64-bit from memory
  STORE_U8: 0x59, // Store 8-bit to memory
  STORE_U16: 0x5a, // Store 16-bit to memory
  STORE_U32: 0x5b, // Store 32-bit to memory
  STORE_U64: 0x5c, // Store 64-bit to memory

  // Instructions with Arguments of One Register & Two Immediates
  STORE_IMM_IND_U8: 0x70, // Store immediate to indexed memory (8-bit)
  STORE_IMM_IND_U16: 0x71, // Store immediate to indexed memory (16-bit)
  STORE_IMM_IND_U32: 0x72, // Store immediate to indexed memory (32-bit)
  STORE_IMM_IND_U64: 0x73, // Store immediate to indexed memory (64-bit)

  // Instructions with Arguments of One Register, One Immediate and One Offset
  LOAD_IMM_JUMP: 0x80, // Load immediate and jump
  BRANCH_EQ_IMM: 0x81, // Branch if equal to immediate
  BRANCH_NE_IMM: 0x82, // Branch if not equal to immediate
  BRANCH_LT_U_IMM: 0x83, // Branch if less than immediate (unsigned)
  BRANCH_LE_U_IMM: 0x84, // Branch if less than or equal to immediate (unsigned)
  BRANCH_GE_U_IMM: 0x85, // Branch if greater than or equal to immediate (unsigned)
  BRANCH_GT_U_IMM: 0x86, // Branch if greater than immediate (unsigned)
  BRANCH_LT_S_IMM: 0x87, // Branch if less than immediate (signed)
  BRANCH_LE_S_IMM: 0x88, // Branch if less than or equal to immediate (signed)
  BRANCH_GE_S_IMM: 0x89, // Branch if greater than or equal to immediate (signed)
  BRANCH_GT_S_IMM: 0x8a, // Branch if greater than immediate (signed)

  // Instructions with Arguments of Two Registers
  MOVE_REG: 0x100, // Move register to register
  SBRK: 0x101, // Allocate memory
  COUNT_SET_BITS_64: 0x102, // Count set bits in 64-bit register
  COUNT_SET_BITS_32: 0x103, // Count set bits in 32-bit register
  LEADING_ZERO_BITS_64: 0x104, // Count leading zero bits in 64-bit register
  LEADING_ZERO_BITS_32: 0x105, // Count leading zero bits in 32-bit register
  TRAILING_ZERO_BITS_64: 0x106, // Count trailing zero bits in 64-bit register
  TRAILING_ZERO_BITS_32: 0x107, // Count trailing zero bits in 32-bit register
  SIGN_EXTEND_8: 0x108, // Sign extend 8-bit value
  SIGN_EXTEND_16: 0x109, // Sign extend 16-bit value
  ZERO_EXTEND_16: 0x10a, // Zero extend 16-bit value
  REVERSE_BYTES: 0x10b, // Reverse byte order

  // Instructions with Arguments of Two Registers & One Immediate
  STORE_IND_U8: 0x120, // Store to indexed memory (8-bit)
  STORE_IND_U16: 0x121, // Store to indexed memory (16-bit)
  STORE_IND_U32: 0x122, // Store to indexed memory (32-bit)
  STORE_IND_U64: 0x123, // Store to indexed memory (64-bit)
  LOAD_IND_U8: 0x124, // Load from indexed memory (8-bit)
  LOAD_IND_I8: 0x125, // Load from indexed memory (8-bit signed)
  LOAD_IND_U16: 0x126, // Load from indexed memory (16-bit)
  LOAD_IND_I16: 0x127, // Load from indexed memory (16-bit signed)
  LOAD_IND_U32: 0x128, // Load from indexed memory (32-bit)
  LOAD_IND_I32: 0x129, // Load from indexed memory (32-bit signed)
  LOAD_IND_U64: 0x12a, // Load from indexed memory (64-bit)
  ADD_IMM_32: 0x12b, // Add immediate to 32-bit register
  AND_IMM: 0x12c, // Bitwise AND with immediate
  XOR_IMM: 0x12d, // Bitwise XOR with immediate
  OR_IMM: 0x12e, // Bitwise OR with immediate
  MUL_IMM_32: 0x12f, // Multiply 32-bit register by immediate
  SET_LT_U_IMM: 0x130, // Set if less than immediate (unsigned)
  SET_LT_S_IMM: 0x131, // Set if less than immediate (signed)
  SHLO_L_IMM_32: 0x132, // Shift left by immediate (32-bit)
  SHLO_R_IMM_32: 0x133, // Shift right logical by immediate (32-bit)
  SHAR_R_IMM_32: 0x134, // Shift right arithmetic by immediate (32-bit)
  NEG_ADD_IMM_32: 0x135, // Negate and add immediate (32-bit)
  SET_GT_U_IMM: 0x136, // Set if greater than immediate (unsigned)
  SET_GT_S_IMM: 0x137, // Set if greater than immediate (signed)
  SHLO_L_IMM_ALT_32: 0x138, // Alternative shift left by immediate (32-bit)
  SHLO_R_IMM_ALT_32: 0x139, // Alternative shift right logical by immediate (32-bit)
  SHAR_R_IMM_ALT_32: 0x13a, // Alternative shift right arithmetic by immediate (32-bit)
  CMOV_IZ_IMM: 0x13b, // Conditional move if zero with immediate
  CMOV_NZ_IMM: 0x13c, // Conditional move if not zero with immediate
  ADD_IMM_64: 0x13d, // Add immediate to 64-bit register
  MUL_IMM_64: 0x13e, // Multiply 64-bit register by immediate
  SHLO_L_IMM_64: 0x13f, // Shift left by immediate (64-bit)
  SHLO_R_IMM_64: 0x140, // Shift right logical by immediate (64-bit)
  SHAR_R_IMM_64: 0x141, // Shift right arithmetic by immediate (64-bit)
  NEG_ADD_IMM_64: 0x142, // Negate and add immediate (64-bit)
  SHLO_L_IMM_ALT_64: 0x143, // Alternative shift left by immediate (64-bit)
  SHLO_R_IMM_ALT_64: 0x144, // Alternative shift right logical by immediate (64-bit)
  SHAR_R_IMM_ALT_64: 0x145, // Alternative shift right arithmetic by immediate (64-bit)
  ROT_R_64_IMM: 0x146, // Rotate right by immediate (64-bit)
  ROT_R_64_IMM_ALT: 0x147, // Alternative rotate right by immediate (64-bit)
  ROT_R_32_IMM: 0x148, // Rotate right by immediate (32-bit)
  ROT_R_32_IMM_ALT: 0x149, // Alternative rotate right by immediate (32-bit)

  // Instructions with Arguments of Two Registers & One Offset
  BRANCH_EQ: 0x170, // Branch if equal
  BRANCH_NE: 0x171, // Branch if not equal
  BRANCH_LT_U: 0x172, // Branch if less than (unsigned)
  BRANCH_LT_S: 0x173, // Branch if less than (signed)
  BRANCH_GE_U: 0x174, // Branch if greater than or equal (unsigned)
  BRANCH_GE_S: 0x175, // Branch if greater than or equal (signed)

  // Instructions with Arguments of Two Registers and Two Immediates
  LOAD_IMM_JUMP_IND: 0x180, // Load immediate and indirect jump

  // Instructions with Arguments of Three Registers
  ADD_32: 0x190, // Add 32-bit registers
  SUB_32: 0x191, // Subtract 32-bit registers
  MUL_32: 0x192, // Multiply 32-bit registers
  DIV_U_32: 0x193, // Divide 32-bit registers (unsigned)
  DIV_S_32: 0x194, // Divide 32-bit registers (signed)
  REM_U_32: 0x195, // Remainder 32-bit registers (unsigned)
  REM_S_32: 0x196, // Remainder 32-bit registers (signed)
  SHLO_L_32: 0x197, // Shift left (32-bit)
  SHLO_R_32: 0x198, // Shift right logical (32-bit)
  SHAR_R_32: 0x199, // Shift right arithmetic (32-bit)
  ADD_64: 0x200, // Add 64-bit registers
  SUB_64: 0x201, // Subtract 64-bit registers
  MUL_64: 0x202, // Multiply 64-bit registers
  DIV_U_64: 0x203, // Divide 64-bit registers (unsigned)
  DIV_S_64: 0x204, // Divide 64-bit registers (signed)
  REM_U_64: 0x205, // Remainder 64-bit registers (unsigned)
  REM_S_64: 0x206, // Remainder 64-bit registers (signed)
  SHLO_L_64: 0x207, // Shift left (64-bit)
  SHLO_R_64: 0x208, // Shift right logical (64-bit)
  SHAR_R_64: 0x209, // Shift right arithmetic (64-bit)
  AND: 0x210, // Bitwise AND
  XOR: 0x211, // Bitwise XOR
  OR: 0x212, // Bitwise OR
  MUL_UPPER_S_S: 0x213, // Multiply upper bits (signed × signed)
  MUL_UPPER_U_U: 0x214, // Multiply upper bits (unsigned × unsigned)
  MUL_UPPER_S_U: 0x215, // Multiply upper bits (signed × unsigned)
  SET_LT_U: 0x216, // Set if less than (unsigned)
  SET_LT_S: 0x217, // Set if less than (signed)
  CMOV_IZ: 0x218, // Conditional move if zero
  CMOV_NZ: 0x219, // Conditional move if not zero
  ROT_L_64: 0x220, // Rotate left (64-bit)
  ROT_L_32: 0x221, // Rotate left (32-bit)
  ROT_R_64: 0x222, // Rotate right (64-bit)
  ROT_R_32: 0x223, // Rotate right (32-bit)
  AND_INV: 0x224, // Bitwise AND with inverse
  OR_INV: 0x225, // Bitwise OR with inverse
  XNOR: 0x226, // Bitwise XNOR
  MAX: 0x227, // Maximum (signed)
  MAX_U: 0x228, // Maximum (unsigned)
  MIN: 0x229, // Minimum (signed)
  MIN_U: 0x22a, // Minimum (unsigned)
} as const

// Gray Paper Is-Authorized constants
export const IS_AUTHORIZED_CONFIG = {
  PACKAGE_AUTH_GAS: 50_000_000n, // Cpackageauthgas = 50,000,000
  MAX_AUTH_CODE_SIZE: 64_000, // Cmaxauthcodesize = 64,000
} as const

// Gray Paper Refine Invocation constants
export const REFINE_CONFIG = {
  PACKAGE_REF_GAS: 5_000_000_000n, // Cpackagerefgas = 5,000,000,000
  MAX_SERVICE_CODE_SIZE: 4_000_000, // Cmaxservicecodesize = 4,000,000
  SEGMENT_SIZE: 4_104, // Csegmentsize = 4104
  MAX_PACKAGE_EXPORTS: 3_072, // Cmaxpackageexports = 3,072
} as const

// Gray Paper Accumulate Invocation constants
export const ACCUMULATE_INVOCATION_CONFIG = {
  MAX_SERVICE_CODE_SIZE: 4_000_000, // Cmaxservicecodesize = 4,000,000
  MIN_PUBLIC_INDEX: 1_000_000, // Cminpublicindex = 1,000,000
  ENTROPY_ACCUMULATOR: 'entropy', // Placeholder for entropy accumulator
} as const

// Instruction length mapping based on Gray Paper skip distance calculations
export const INSTRUCTION_LENGTHS = {
  // Instructions without Arguments (length 1)
  [OPCODES.TRAP]: 1,
  [OPCODES.FALLTHROUGH]: 1,

  // Instructions with Arguments of One Immediate (variable length)
  [OPCODES.ECALLI]: 2, // 1 byte opcode + 1 byte immediate

  // Instructions with Arguments of One Register and One Extended Width Immediate
  [OPCODES.LOAD_IMM_64]: 10, // 1 byte opcode + 1 byte register + 8 bytes immediate

  // Instructions with Arguments of Two Immediates (variable length)
  [OPCODES.STORE_IMM_U8]: 3, // 1 byte opcode + 1 byte address + 1 byte value
  [OPCODES.STORE_IMM_U16]: 4, // 1 byte opcode + 1 byte address + 2 bytes value
  [OPCODES.STORE_IMM_U32]: 6, // 1 byte opcode + 1 byte address + 4 bytes value
  [OPCODES.STORE_IMM_U64]: 10, // 1 byte opcode + 1 byte address + 8 bytes value

  // Instructions with Arguments of One Offset (variable length)
  [OPCODES.JUMP]: 3, // 1 byte opcode + 2 bytes offset

  // Instructions with Arguments of One Register & One Immediate (variable length)
  [OPCODES.JUMP_IND]: 3, // 1 byte opcode + 1 byte register + 1 byte immediate
  [OPCODES.LOAD_IMM]: 3, // 1 byte opcode + 1 byte register + 1 byte immediate
  [OPCODES.LOAD_U8]: 3, // 1 byte opcode + 1 byte register + 1 byte address
  [OPCODES.LOAD_I8]: 3, // 1 byte opcode + 1 byte register + 1 byte address
  [OPCODES.LOAD_U16]: 4, // 1 byte opcode + 1 byte register + 2 bytes address
  [OPCODES.LOAD_I16]: 4, // 1 byte opcode + 1 byte register + 2 bytes address
  [OPCODES.LOAD_U32]: 6, // 1 byte opcode + 1 byte register + 4 bytes address
  [OPCODES.LOAD_I32]: 6, // 1 byte opcode + 1 byte register + 4 bytes address
  [OPCODES.LOAD_U64]: 10, // 1 byte opcode + 1 byte register + 8 bytes address
  [OPCODES.STORE_U8]: 3, // 1 byte opcode + 1 byte register + 1 byte address
  [OPCODES.STORE_U16]: 4, // 1 byte opcode + 1 byte register + 2 bytes address
  [OPCODES.STORE_U32]: 6, // 1 byte opcode + 1 byte register + 4 bytes address
  [OPCODES.STORE_U64]: 10, // 1 byte opcode + 1 byte register + 8 bytes address

  // Instructions with Arguments of One Register & Two Immediates
  [OPCODES.STORE_IMM_IND_U8]: 4, // 1 byte opcode + 1 byte register + 1 byte offset + 1 byte value
  [OPCODES.STORE_IMM_IND_U16]: 5, // 1 byte opcode + 1 byte register + 1 byte offset + 2 bytes value
  [OPCODES.STORE_IMM_IND_U32]: 7, // 1 byte opcode + 1 byte register + 1 byte offset + 4 bytes value
  [OPCODES.STORE_IMM_IND_U64]: 11, // 1 byte opcode + 1 byte register + 1 byte offset + 8 bytes value

  // Instructions with Arguments of One Register, One Immediate and One Offset
  [OPCODES.LOAD_IMM_JUMP]: 5, // 1 byte opcode + 1 byte register + 1 byte immediate + 2 bytes offset
  [OPCODES.BRANCH_EQ_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_NE_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_LT_U_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_LE_U_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_GE_U_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_GT_U_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_LT_S_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_LE_S_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_GE_S_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset
  [OPCODES.BRANCH_GT_S_IMM]: 4, // 1 byte opcode + 1 byte register + 1 byte immediate + 1 byte offset

  // Instructions with Arguments of Two Registers (length 2)
  [OPCODES.MOVE_REG]: 2,
  [OPCODES.SBRK]: 2,
  [OPCODES.COUNT_SET_BITS_64]: 2,
  [OPCODES.COUNT_SET_BITS_32]: 2,
  [OPCODES.LEADING_ZERO_BITS_64]: 2,
  [OPCODES.LEADING_ZERO_BITS_32]: 2,
  [OPCODES.TRAILING_ZERO_BITS_64]: 2,
  [OPCODES.TRAILING_ZERO_BITS_32]: 2,
  [OPCODES.SIGN_EXTEND_8]: 2,
  [OPCODES.SIGN_EXTEND_16]: 2,
  [OPCODES.ZERO_EXTEND_16]: 2,
  [OPCODES.REVERSE_BYTES]: 2,

  // Instructions with Arguments of Two Registers & One Immediate (variable length)
  [OPCODES.STORE_IND_U8]: 3, // 1 byte opcode + 2 bytes registers + 1 byte immediate
  [OPCODES.STORE_IND_U16]: 4, // 1 byte opcode + 2 bytes registers + 2 bytes immediate
  [OPCODES.STORE_IND_U32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.STORE_IND_U64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.LOAD_IND_U8]: 3, // 1 byte opcode + 2 bytes registers + 1 byte immediate
  [OPCODES.LOAD_IND_I8]: 3, // 1 byte opcode + 2 bytes registers + 1 byte immediate
  [OPCODES.LOAD_IND_U16]: 4, // 1 byte opcode + 2 bytes registers + 2 bytes immediate
  [OPCODES.LOAD_IND_I16]: 4, // 1 byte opcode + 2 bytes registers + 2 bytes immediate
  [OPCODES.LOAD_IND_U32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.LOAD_IND_I32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.LOAD_IND_U64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.ADD_IMM_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.AND_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.XOR_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.OR_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.MUL_IMM_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.SET_LT_U_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SET_LT_S_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHLO_L_IMM_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.SHLO_R_IMM_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.SHAR_R_IMM_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.NEG_ADD_IMM_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.SET_GT_U_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SET_GT_S_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHLO_L_IMM_ALT_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.SHLO_R_IMM_ALT_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.SHAR_R_IMM_ALT_32]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.CMOV_IZ_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.CMOV_NZ_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.ADD_IMM_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.MUL_IMM_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHLO_L_IMM_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHLO_R_IMM_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHAR_R_IMM_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.NEG_ADD_IMM_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHLO_L_IMM_ALT_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHLO_R_IMM_ALT_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.SHAR_R_IMM_ALT_64]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.ROT_R_64_IMM]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.ROT_R_64_IMM_ALT]: 10, // 1 byte opcode + 2 bytes registers + 8 bytes immediate
  [OPCODES.ROT_R_32_IMM]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate
  [OPCODES.ROT_R_32_IMM_ALT]: 6, // 1 byte opcode + 2 bytes registers + 4 bytes immediate

  // Instructions with Arguments of Two Registers & One Offset (variable length)
  [OPCODES.BRANCH_EQ]: 3, // 1 byte opcode + 2 bytes registers + 1 byte offset
  [OPCODES.BRANCH_NE]: 3, // 1 byte opcode + 2 bytes registers + 1 byte offset
  [OPCODES.BRANCH_LT_U]: 3, // 1 byte opcode + 2 bytes registers + 1 byte offset
  [OPCODES.BRANCH_LT_S]: 3, // 1 byte opcode + 2 bytes registers + 1 byte offset
  [OPCODES.BRANCH_GE_U]: 3, // 1 byte opcode + 2 bytes registers + 1 byte offset
  [OPCODES.BRANCH_GE_S]: 3, // 1 byte opcode + 2 bytes registers + 1 byte offset

  // Instructions with Arguments of Two Registers and Two Immediates
  [OPCODES.LOAD_IMM_JUMP_IND]: 6, // 1 byte opcode + 2 bytes registers + 1 byte immediate + 2 bytes immediate

  // Instructions with Arguments of Three Registers (length 3)
  [OPCODES.ADD_32]: 3,
  [OPCODES.SUB_32]: 3,
  [OPCODES.MUL_32]: 3,
  [OPCODES.DIV_U_32]: 3,
  [OPCODES.DIV_S_32]: 3,
  [OPCODES.REM_U_32]: 3,
  [OPCODES.REM_S_32]: 3,
  [OPCODES.SHLO_L_32]: 3,
  [OPCODES.SHLO_R_32]: 3,
  [OPCODES.SHAR_R_32]: 3,
  [OPCODES.ADD_64]: 3,
  [OPCODES.SUB_64]: 3,
  [OPCODES.MUL_64]: 3,
  [OPCODES.DIV_U_64]: 3,
  [OPCODES.DIV_S_64]: 3,
  [OPCODES.REM_U_64]: 3,
  [OPCODES.REM_S_64]: 3,
  [OPCODES.SHLO_L_64]: 3,
  [OPCODES.SHLO_R_64]: 3,
  [OPCODES.SHAR_R_64]: 3,
  [OPCODES.AND]: 3,
  [OPCODES.XOR]: 3,
  [OPCODES.OR]: 3,
  [OPCODES.MUL_UPPER_S_S]: 3,
  [OPCODES.MUL_UPPER_U_U]: 3,
  [OPCODES.MUL_UPPER_S_U]: 3,
  [OPCODES.SET_LT_U]: 3,
  [OPCODES.SET_LT_S]: 3,
  [OPCODES.CMOV_IZ]: 3,
  [OPCODES.CMOV_NZ]: 3,
  [OPCODES.ROT_L_64]: 3,
  [OPCODES.ROT_L_32]: 3,
  [OPCODES.ROT_R_64]: 3,
  [OPCODES.ROT_R_32]: 3,
  [OPCODES.AND_INV]: 3,
  [OPCODES.OR_INV]: 3,
  [OPCODES.XNOR]: 3,
  [OPCODES.MAX]: 3,
  [OPCODES.MAX_U]: 3,
  [OPCODES.MIN]: 3,
  [OPCODES.MIN_U]: 3,
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
  UNKNOWN_INSTRUCTION_LENGTH: 1,
  DEFAULT_GAS_COST: 1n,
  DEFAULT_MEMORY_COST: 1n,
} as const

// General function identifiers from Gray Paper Appendix B.7
export const GENERAL_FUNCTIONS = {
  GAS: 0,
  FETCH: 1,
  LOOKUP: 2,
  READ: 3,
  WRITE: 4,
  INFO: 5,
  HISTORICAL_LOOKUP: 6,
  EXPORT: 7,
  MACHINE: 8,
  PEEK: 9,
  POKE: 10,
  PAGES: 11,
  INVOKE: 12,
  EXPUNGE: 13,
} as const

// Accumulate function identifiers from Gray Paper Appendix B.7
export const ACCUMULATE_FUNCTIONS = {
  BLESS: 14,
  ASSIGN: 15,
  DESIGNATE: 16,
  CHECKPOINT: 17,
  NEW: 18,
  UPGRADE: 19,
  TRANSFER: 20,
  EJECT: 21,
  QUERY: 22,
  SOLICIT: 23,
  FORGET: 24,
  YIELD: 25,
  PROVIDE: 26,
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
