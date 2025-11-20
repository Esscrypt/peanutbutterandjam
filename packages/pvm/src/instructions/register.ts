/**
 * Register Operations Instructions
 *
 * MOVE_REG, SBRK, and bit manipulation instructions
 */

import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { MEMORY_CONFIG, OPCODES } from '../config'
import { BaseInstruction } from './base'
import { alignToPage } from '../alignment-helpers'

/**
 * MOVE_REG instruction (opcode 0x100)
 * Move register value as specified in Gray Paper
 * Gray Paper formula: reg'_D = reg_A
 */
export class MOVE_REGInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MOVE_REG
  readonly name = 'MOVE_REG'
  readonly description = 'Move register value'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428, 436:
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination from LOW nibble
    // r_A = min(12, floor(instructions[ι+1] / 16)) - source from HIGH nibble
    // Formula: reg'_D = reg_A
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value = this.getRegisterValue(context.registers, registerA) // Read from source

    // Write source value to destination: reg'_D = reg_A
    this.setRegisterValue(context.registers, registerD, value)

    // Log after update to show the actual register state
    context.log('MOVE_REG: Move register value', {
      registerD,
      registerA,
      value: value.toString(),
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      registers: [...context.registers].map(r => r.toString()), // Copy array to show post-update state
      r10AfterUpdate: context.registers[10]?.toString(), // Explicitly log r10 to verify update
    })

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * SBRK instruction (opcode 0x101)
 * Allocate memory as specified in Gray Paper
 * Gray Paper formula: reg'_D ≡ min(x ∈ pvmreg): x ≥ h ∧ Nrange{x}{reg_A} ⊄ readable{memory} ∧ Nrange{x}{reg_A} ⊆ writable{memory'}
 *
 * Implementation follows Go reference from jam-test-vectors/traces/README.md
 */
export class SBRKInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SBRK
  readonly name = 'SBRK'
  execute(context: InstructionContext): InstructionResult {
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const valueA = this.getRegisterValue(context.registers, registerA)

    context.log('SBRK: Allocate memory', {
      registerD,
      registerA,
      valueA: valueA.toString(),
      pc: context.pc,
      currentHeapPointer: context.ram.currentHeapPointer,
    })

    const ram = context.ram
    const currentHeapPointer = BigInt(ram.currentHeapPointer)

    // Go implementation: if valueA == 0, return current heap pointer
    if (valueA === 0n) {
      // The guest is querying the current heap pointer
      this.setRegisterValue(context.registers, registerD, currentHeapPointer)
      return { resultCode: null }
    }

    // P_func: page alignment function (rnp in Gray Paper)
    // Aligns address up to next page boundary: Cpvmpagesize * ceil(x / Cpvmpagesize)
    const pageSize = MEMORY_CONFIG.PAGE_SIZE // Z_P = Cpvmpagesize = 4096

    const nextPageBoundary = alignToPage(ram.currentHeapPointer)
    const newHeapPointer = ram.currentHeapPointer + Number(valueA)

    // https://paritytech.github.io/matrix-archiver/archive/_21ddsEwXlCWnreEGuqXZ_3Apolkadot.io/index.html#$_RkIlMDNZrROw_6WDXpbllO2VSbjY1FNTIfDjVZhhdw
    if(newHeapPointer > MEMORY_CONFIG.MAX_MEMORY_ADDRESS) { 
      this.setRegisterValue(context.registers, registerD, 0n)
      return { resultCode: null }
    }


    // If new heap pointer exceeds next page boundary, allocate pages
    if (newHeapPointer > nextPageBoundary) {
      const finalBoundary = alignToPage(newHeapPointer)
      const idxStart = Math.floor(nextPageBoundary / pageSize) // Z_P
      const idxEnd = Math.floor(finalBoundary / pageSize) // Z_P
      const pageCount = idxEnd - idxStart

      ram.allocatePages(idxStart, pageCount)
    }

    // Advance the heap
    ram.currentHeapPointer = newHeapPointer

    // Return the previous heap pointer (before allocation)
    this.setRegisterValue(context.registers, registerD, BigInt(newHeapPointer))

    return { resultCode: null }
  }
}

/**
 * COUNT_SET_BITS_64 instruction (opcode 0x102)
 * Count set bits in 64-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = Σ(i=0 to 63) bitsfunc{8}(reg_A)[i]
 */
export class COUNT_SET_BITS_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.COUNT_SET_BITS_64
  readonly name = 'COUNT_SET_BITS_64'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428, 443:
    // Two Registers format:
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination from LOW nibble
    // r_A = min(12, floor(instructions[ι+1] / 16)) - source from HIGH nibble
    // Formula: reg'_D = Σ(i=0 to 63) bitsfunc{8}(reg_A)[i]
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value = this.getRegisterValue(context.registers, registerA)

    // Count set bits using bit manipulation
    let count = 0n
    let temp = value
    while (temp !== 0n) {
      count += temp & 1n
      temp >>= 1n
    }

    context.log('COUNT_SET_BITS_64: Count set bits in 64-bit register', {
      registerD,
      registerA,
      value,
      count,
    })
    this.setRegisterValue(context.registers, registerD, count)

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * COUNT_SET_BITS_32 instruction (opcode 0x103)
 * Count set bits in 32-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = Σ(i=0 to 31) bitsfunc{4}(reg_A mod 2^32)[i]
 */
export class COUNT_SET_BITS_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.COUNT_SET_BITS_32
  readonly name = 'COUNT_SET_BITS_32'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428, 444:
    // Two Registers format:
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination from LOW nibble
    // r_A = min(12, floor(instructions[ι+1] / 16)) - source from HIGH nibble
    // Formula: reg'_D = Σ(i=0 to 31) bitsfunc{4}(reg_A mod 2^32)[i]
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Count set bits using bit manipulation
    let count = 0n
    let temp = value
    while (temp !== 0n) {
      count += temp & 1n
      temp >>= 1n
    }

    this.setRegisterValue(context.registers, registerD, count)

    context.log('COUNT_SET_BITS_32: Count set bits in 32-bit register', {
      registerD,
      registerA,
      value: value.toString(),
      count: count.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}

/**
 * LEADING_ZERO_BITS_64 instruction (opcode 0x104)
 * Count leading zero bits in 64-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{65}) where Σ(i=0 to i<n) revbitsfunc{8}(reg_A)[i] = 0
 */
export class LEADING_ZERO_BITS_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LEADING_ZERO_BITS_64
  readonly name = 'LEADING_ZERO_BITS_64'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428, 445:
    // Two Registers format:
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination from LOW nibble
    // r_A = min(12, floor(instructions[ι+1] / 16)) - source from HIGH nibble
    // Formula: reg'_D = max(n ∈ Nmax{65}) where Σ(i=0 to i<n) revbitsfunc{8}(reg_A)[i] = 0
    const registerD = this.getRegisterA(context.instruction.operands) // r_D from low nibble
    const registerA = this.getRegisterB(context.instruction.operands) // r_A from high nibble
    const value = this.getRegisterValue(context.registers, registerA)

    // Count leading zeros
    let count = 0n
    const temp = value
    for (let i = 63; i >= 0; i--) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    context.log('LEADING_ZERO_BITS_64: Count leading zero bits in 64-bit register', {
      registerD,
      registerA,
      value: value.toString(),
      count: count.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}

/**
 * LEADING_ZERO_BITS_32 instruction (opcode 0x105)
 * Count leading zero bits in 32-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{33}) where Σ(i=0 to i<n) revbitsfunc{4}(reg_A mod 2^32)[i] = 0
 */
export class LEADING_ZERO_BITS_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LEADING_ZERO_BITS_32
  readonly name = 'LEADING_ZERO_BITS_32'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428, 446:
    // Two Registers format:
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination from LOW nibble
    // r_A = min(12, floor(instructions[ι+1] / 16)) - source from HIGH nibble
    // Formula: reg'_D = max(n ∈ Nmax{33}) where Σ(i=0 to i<n) revbitsfunc{4}(reg_A mod 2^32)[i] = 0
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Count leading zeros
    let count = 0n
    const temp = value
    for (let i = 31; i >= 0; i--) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    context.log('LEADING_ZERO_BITS_32: Count leading zero bits in 32-bit register', {
      registerD,
      registerA,
      value: value.toString(),
      count: count.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}

/**
 * TRAILING_ZERO_BITS_64 instruction (opcode 0x106)
 * Count trailing zero bits in 64-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{65}) where Σ(i=0 to i<n) bitsfunc{8}(reg_A)[i] = 0
 */
export class TRAILING_ZERO_BITS_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.TRAILING_ZERO_BITS_64
  readonly name = 'TRAILING_ZERO_BITS_64'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428, 447:
    // Two Registers format:
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination from LOW nibble
    // r_A = min(12, floor(instructions[ι+1] / 16)) - source from HIGH nibble
    // Formula: reg'_D = max(n ∈ Nmax{65}) where Σ(i=0 to i<n) bitsfunc{8}(reg_A)[i] = 0
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value = this.getRegisterValue(context.registers, registerA)

    // Count trailing zeros
    let count = 0n
    const temp = value
    for (let i = 0; i < 64; i++) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    context.log('TRAILING_ZERO_BITS_64: Count trailing zero bits in 64-bit register', {
      registerD,
      registerA,
      value: value.toString(),
      count: count.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }

}

/**
 * TRAILING_ZERO_BITS_32 instruction (opcode 0x107)
 * Count trailing zero bits in 32-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{33}) where Σ(i=0 to i<n) bitsfunc{4}(reg_A mod 2^32)[i] = 0
 */
export class TRAILING_ZERO_BITS_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.TRAILING_ZERO_BITS_32
  readonly name = 'TRAILING_ZERO_BITS_32'
  readonly description = 'Count trailing zero bits in 32-bit register'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428, 448:
    // Two Registers format:
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination from LOW nibble
    // r_A = min(12, floor(instructions[ι+1] / 16)) - source from HIGH nibble
    // Formula: reg'_D = max(n ∈ Nmax{33}) where Σ(i=0 to i<n) bitsfunc{4}(reg_A mod 2^32)[i] = 0
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Count trailing zeros
    let count = 0n
    const temp = value
    for (let i = 0; i < 32; i++) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    context.log('TRAILING_ZERO_BITS_32: Count trailing zero bits in 32-bit register', {
      registerD,
      registerA,
      value: value.toString(),
      count: count.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}

/**
 * SIGN_EXTEND_8 instruction (opcode 0x108)
 * Sign extend 8-bit value as specified in Gray Paper
 * Gray Paper formula: reg'_D = unsigned{signedn{1}{reg_A mod 2^8}}
 */
export class SIGN_EXTEND_8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SIGN_EXTEND_8
  readonly name = 'SIGN_EXTEND_8'
  readonly description = 'Sign extend 8-bit value'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Two Registers format
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination (low nibble)
    // r_A = min(12, ⌊instructions[ι+1]/16⌋) - source (high nibble)
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value = this.getRegisterValue(context.registers, registerA) % 2n ** 8n

    // Gray Paper: reg'_D = unsigned{signedn{1}{reg_A mod 2^8}}
    // signedn{1}(x) = signfunc{1}(x) = x if x < 128, else x - 256
    // unsigned{} converts signed value back to unsigned 64-bit
    // This is equivalent to bitwise sign extension
    const signBit = value & (1n << 7n)
    const extendedValue = signBit ? value | ~((1n << 8n) - 1n) : value

    this.setRegisterValue(context.registers, registerD, extendedValue)

    context.log('SIGN_EXTEND_8: Sign extend 8-bit value', {
      registerD,
      registerA,
      value: value.toString(),
      extendedValue: extendedValue.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}

/**
 * SIGN_EXTEND_16 instruction (opcode 0x109)
 * Sign extend 16-bit value as specified in Gray Paper
 * Gray Paper formula: reg'_D = unsigned{signedn{2}{reg_A mod 2^16}}
 * Gray Paper pvm.tex line 450: "Two Registers" format
 */
export class SIGN_EXTEND_16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SIGN_EXTEND_16
  readonly name = 'SIGN_EXTEND_16'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper pvm.tex lines 418-428: "Two Registers" format
    // r_D = min(12, (instructions[ι+1]) mod 16) - destination (LOW nibble)
    // r_A = min(12, floor(instructions[ι+1]/16)) - source (HIGH nibble)
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 16n

    // Gray Paper: reg'_D = unsigned{signedn{2}{reg_A mod 2^16}}
    // signedn{2}(x) = signfunc{2}(x) = x if x < 0x8000, else x - 0x10000
    // unsigned{} converts signed value back to unsigned 64-bit
    const signedValue = value < 0x8000n ? value : value - 0x10000n
    const extendedValue = signedValue < 0n ? signedValue + 2n ** 64n : signedValue

    this.setRegisterValue(context.registers, registerD, extendedValue)

    context.log('SIGN_EXTEND_16: Sign extend 16-bit value', {
      registerD,
      registerA,
      value: value.toString(),
      extendedValue: extendedValue.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}

/**
 * ZERO_EXTEND_16 instruction (opcode 0x10A)
 * Zero extend 16-bit value as specified in Gray Paper
 * Gray Paper formula: reg'_D = reg_A mod 2^16
 */
export class ZERO_EXTEND_16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ZERO_EXTEND_16
  readonly name = 'ZERO_EXTEND_16'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Two Registers format
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 16n

    // Zero extend 16-bit to 64-bit (no change needed since we're already using BigInt)
    this.setRegisterValue(context.registers, registerD, value)

    context.log('ZERO_EXTEND_16: Zero extend 16-bit value', {
      registerD,
      registerA,
      value: value.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}

/**
 * REVERSE_BYTES instruction (opcode 0x10B)
 * Reverse byte order as specified in Gray Paper
 * Gray Paper pvm.tex line 452: ∀i ∈ N_8 : encode[8]{reg'_D}[i] = encode[8]{reg_A}[7-i]
 *
 * Gray Paper pvm.tex line 418-428: "Two Registers" format
 * r_D = min(12, (instructions[ι+1]) mod 16) - destination (low nibble)
 * r_A = min(12, ⌊instructions[ι+1]/16⌋) - source (high nibble)
 */
export class REVERSE_BYTESInstruction extends BaseInstruction {
  readonly opcode = OPCODES.REVERSE_BYTES
  readonly name = 'REVERSE_BYTES'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Two Registers format
    const { registerD, registerA } = this.parseTwoRegisters(
      context.instruction.operands,
    )
    const value = this.getRegisterValue(context.registers, registerA)

    // Reverse byte order (8 bytes)
    let reversed = 0n
    for (let i = 0; i < 8; i++) {
      const byte = (value >> BigInt(i * 8)) & 0xffn
      reversed |= byte << BigInt((7 - i) * 8)
    }

    this.setRegisterValue(context.registers, registerD, reversed)

    context.log('REVERSE_BYTES: Reverse byte order', {
      registerD,
      registerA,
      value: value.toString(),
      reversed: reversed.toString(),
      pc: context.pc.toString(),
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    return { resultCode: null }
  }
}
