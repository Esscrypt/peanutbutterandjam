/**
 * Register Operations Instructions
 *
 * MOVE_REG, SBRK, and bit manipulation instructions
 */

import { alignToPage } from '../alignment-helpers'
import {
  MAX_MEMORY_ADDRESS,
  OPCODE_COUNT_SET_BITS_32,
  OPCODE_COUNT_SET_BITS_64,
  OPCODE_LEADING_ZERO_BITS_32,
  OPCODE_LEADING_ZERO_BITS_64,
  OPCODE_MOVE_REG,
  OPCODE_REVERSE_BYTES,
  OPCODE_SBRK,
  OPCODE_SIGN_EXTEND_8,
  OPCODE_SIGN_EXTEND_16,
  OPCODE_TRAILING_ZERO_BITS_32,
  OPCODE_TRAILING_ZERO_BITS_64,
  OPCODE_ZERO_EXTEND_16,
  PAGE_SIZE,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * MOVE_REG instruction (opcode 0x100)
 * Move register value as specified in Gray Paper
 * Gray Paper formula: reg'_D = reg_A
 */
export class MOVE_REGInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MOVE_REG
  name: string = 'MOVE_REG'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA)

    this.setRegisterValue(context.registers, registerD, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_SBRK
  name: string = 'SBRK'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const valueA = this.getRegisterValue(context.registers, registerA)

    const ram = context.ram
    const currentHeapPointer = u64(ram.currentHeapPointer)

    // Go implementation: if valueA == 0, return current heap pointer
    if (valueA === u64(0)) {
      this.setRegisterValue(context.registers, registerD, currentHeapPointer)
      return new InstructionResult(-1)
    }

    const nextPageBoundary = alignToPage(ram.currentHeapPointer)
    const newHeapPointer: u32 = ram.currentHeapPointer + u32(valueA)

    if (newHeapPointer > MAX_MEMORY_ADDRESS) {
      this.setRegisterValue(context.registers, registerD, u64(0))
      return new InstructionResult(-1)
    }

    // If new heap pointer exceeds next page boundary, allocate pages
    if (newHeapPointer > nextPageBoundary) {
      const finalBoundary = alignToPage(newHeapPointer)
      const idxStart = nextPageBoundary / PAGE_SIZE
      const idxEnd = finalBoundary / PAGE_SIZE
      const pageCount = idxEnd - idxStart

      ram.allocatePages(idxStart, pageCount)
    }

    // Advance the heap
    ram.currentHeapPointer = newHeapPointer

    // Return the previous heap pointer (before allocation)
    this.setRegisterValue(context.registers, registerD, u64(newHeapPointer))

    return new InstructionResult(-1)
  }
}

/**
 * COUNT_SET_BITS_64 instruction (opcode 0x102)
 * Count set bits in 64-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = Σ(i=0 to 63) bitsfunc{8}(reg_A)[i]
 */
export class COUNT_SET_BITS_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_COUNT_SET_BITS_64
  name: string = 'COUNT_SET_BITS_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA)

    // Count set bits using bit manipulation
    let count: u64 = u64(0)
    let temp = value
    while (temp !== u64(0)) {
      count += temp & u64(1)
      temp = temp >> u64(1)
    }

    this.setRegisterValue(context.registers, registerD, count)

    return new InstructionResult(-1)
  }
}

/**
 * COUNT_SET_BITS_32 instruction (opcode 0x103)
 * Count set bits in 32-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = Σ(i=0 to 31) bitsfunc{4}(reg_A mod 2^32)[i]
 */
export class COUNT_SET_BITS_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_COUNT_SET_BITS_32
  name: string = 'COUNT_SET_BITS_32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA) & u64(0xffffffff)

    // Count set bits using bit manipulation
    let count: u64 = u64(0)
    let temp = value
    while (temp !== u64(0)) {
      count += temp & u64(1)
      temp = temp >> u64(1)
    }

    this.setRegisterValue(context.registers, registerD, count)

    return new InstructionResult(-1)
  }
}

/**
 * LEADING_ZERO_BITS_64 instruction (opcode 0x104)
 * Count leading zero bits in 64-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{65}) where Σ(i=0 to i<n) revbitsfunc{8}(reg_A)[i] = 0
 */
export class LEADING_ZERO_BITS_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_LEADING_ZERO_BITS_64
  name: string = 'LEADING_ZERO_BITS_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA)

    // Count leading zeros
    let count: u64 = u64(0)
    const temp = value
    for (let i: i32 = 63; i >= 0; i--) {
      if ((temp & (u64(1) << u64(i))) === u64(0)) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    return new InstructionResult(-1)
  }
}

/**
 * LEADING_ZERO_BITS_32 instruction (opcode 0x105)
 * Count leading zero bits in 32-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{33}) where Σ(i=0 to i<n) revbitsfunc{4}(reg_A mod 2^32)[i] = 0
 */
export class LEADING_ZERO_BITS_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_LEADING_ZERO_BITS_32
  name: string = 'LEADING_ZERO_BITS_32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA) & u64(0xffffffff)

    // Count leading zeros
    let count: u64 = u64(0)
    const temp = value
    for (let i: i32 = 31; i >= 0; i--) {
      if ((temp & (u64(1) << u64(i))) === u64(0)) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    return new InstructionResult(-1)
  }
}

/**
 * TRAILING_ZERO_BITS_64 instruction (opcode 0x106)
 * Count trailing zero bits in 64-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{65}) where Σ(i=0 to i<n) bitsfunc{8}(reg_A)[i] = 0
 */
export class TRAILING_ZERO_BITS_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_TRAILING_ZERO_BITS_64
  name: string = 'TRAILING_ZERO_BITS_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA)

    // Count trailing zeros
    let count: u64 = u64(0)
    const temp = value
    for (let i: i32 = 0; i < 64; i++) {
      if ((temp & (u64(1) << u64(i))) === u64(0)) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    return new InstructionResult(-1)
  }
}

/**
 * TRAILING_ZERO_BITS_32 instruction (opcode 0x107)
 * Count trailing zero bits in 32-bit register as specified in Gray Paper
 * Gray Paper formula: reg'_D = max(n ∈ Nmax{33}) where Σ(i=0 to i<n) bitsfunc{4}(reg_A mod 2^32)[i] = 0
 */
export class TRAILING_ZERO_BITS_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_TRAILING_ZERO_BITS_32
  name: string = 'TRAILING_ZERO_BITS_32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA) & u64(0xffffffff)

    // Count trailing zeros
    let count: u64 = u64(0)
    const temp = value
    for (let i: i32 = 0; i < 32; i++) {
      if ((temp & (u64(1) << u64(i))) === u64(0)) {
        count++
      } else {
        break
      }
    }

    this.setRegisterValue(context.registers, registerD, count)

    return new InstructionResult(-1)
  }
}

/**
 * SIGN_EXTEND_8 instruction (opcode 0x108)
 * Sign extend 8-bit value as specified in Gray Paper
 * Gray Paper formula: reg'_D = unsigned{signedn{1}{reg_A mod 2^8}}
 */
export class SIGN_EXTEND_8Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SIGN_EXTEND_8
  name: string = 'SIGN_EXTEND_8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA) & u64(0xff)

    // Gray Paper: reg'_D = unsigned{signedn{1}{reg_A mod 2^8}}
    // signedn{1}(x) = signfunc{1}(x) = x if x < 128, else x - 256
    // unsigned{} converts signed value back to unsigned 64-bit
    // This is equivalent to bitwise sign extension
    const signBit = value & u64(0x80)
    const extendedValue = signBit !== u64(0) ? value | u64(0xffffffffffffff00) : value

    this.setRegisterValue(context.registers, registerD, extendedValue)

    return new InstructionResult(-1)
  }
}

/**
 * SIGN_EXTEND_16 instruction (opcode 0x109)
 * Sign extend 16-bit value as specified in Gray Paper
 * Gray Paper formula: reg'_D = unsigned{signedn{2}{reg_A mod 2^16}}
 */
export class SIGN_EXTEND_16Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SIGN_EXTEND_16
  name: string = 'SIGN_EXTEND_16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA) & u64(0xffff)

    // Gray Paper: reg'_D = unsigned{signedn{2}{reg_A mod 2^16}}
    // signedn{2}(x) = signfunc{2}(x) = x if x < 0x8000, else x - 0x10000
    // unsigned{} converts signed value back to unsigned 64-bit
    const signedValue = value < u64(0x8000) ? i64(value) : i64(value) - i64(0x10000)
    const extendedValue = signedValue < i64(0) ? u64(signedValue) : u64(signedValue)

    this.setRegisterValue(context.registers, registerD, extendedValue)

    return new InstructionResult(-1)
  }
}

/**
 * ZERO_EXTEND_16 instruction (opcode 0x10A)
 * Zero extend 16-bit value as specified in Gray Paper
 * Gray Paper formula: reg'_D = reg_A mod 2^16
 */
export class ZERO_EXTEND_16Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_ZERO_EXTEND_16
  name: string = 'ZERO_EXTEND_16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA) & u64(0xffff)

    this.setRegisterValue(context.registers, registerD, value)

    return new InstructionResult(-1)
  }
}

/**
 * REVERSE_BYTES instruction (opcode 0x10B)
 * Reverse byte order as specified in Gray Paper
 * Gray Paper pvm.tex line 452: ∀i ∈ N_8 : encode[8]{reg'_D}[i] = encode[8]{reg_A}[7-i]
 */
export class REVERSE_BYTESInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_REVERSE_BYTES
  name: string = 'REVERSE_BYTES'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegisters(context.operands)
    const registerD = parseResult.registerD
    const registerA = parseResult.registerA
    const value = this.getRegisterValue(context.registers, registerA)

    // Reverse byte order (8 bytes)
    let reversed: u64 = u64(0)
    for (let i: i32 = 0; i < 8; i++) {
      const byte = (value >> u64(i * 8)) & u64(0xff)
      reversed = reversed | (byte << u64((7 - i) * 8))
    }

    this.setRegisterValue(context.registers, registerD, reversed)

    return new InstructionResult(-1)
  }
}
