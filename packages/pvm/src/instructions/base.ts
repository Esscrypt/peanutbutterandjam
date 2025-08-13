/**
 * Base PVM Instruction System
 *
 * Defines the base interfaces and abstract class for all PVM instructions.
 */

import { bytesToHex } from '@pbnj/core'
import type {
  InstructionContext,
  InstructionResult,
  RegisterState,
  RegisterValue,
  RegisterValue32,
} from '@pbnj/types'

/**
 * Base interface for all PVM instruction handlers
 */
export interface PVMInstructionHandler {
  readonly opcode: number
  readonly name: string
  readonly description: string

  /**
   * Execute the instruction
   */
  execute(context: InstructionContext): InstructionResult

  /**
   * Validate instruction operands
   */
  validate(operands: Uint8Array): boolean

  /**
   * Disassemble instruction to string representation
   */
  disassemble(operands: Uint8Array): string
}

/**
 * Abstract base class for PVM instructions
 * Implements Gray Paper instruction patterns
 */
export abstract class BaseInstruction implements PVMInstructionHandler {
  abstract readonly opcode: number
  abstract readonly name: string
  abstract readonly description: string

  /**
   * Get register index from operand byte (Gray Paper pattern)
   * r_A = min(12, operand_byte mod 16)
   */
  protected getRegisterIndex(operandByte: number): number {
    return Math.min(12, operandByte % 16)
  }

  /**
   * Get register A from first operand byte
   */
  protected getRegisterA(operands: Uint8Array): number {
    if (operands.length < 1) return 0
    return this.getRegisterIndex(operands[0])
  }

  /**
   * Get register B from second operand byte (for 2-register instructions)
   */
  protected getRegisterB(operands: Uint8Array): number {
    if (operands.length < 2) return 0
    return this.getRegisterIndex(operands[1])
  }

  /**
   * Get register D from third operand byte (for 3-register instructions)
   */
  protected getRegisterD(operands: Uint8Array): number {
    if (operands.length < 3) return 0
    return this.getRegisterIndex(operands[2])
  }

  /**
   * Get immediate value with variable length (Gray Paper pattern)
   * l_X = min(4, skip_length) for basic immediates
   */
  protected getImmediateValue(
    operands: Uint8Array,
    startIndex = 1,
    length?: number,
  ): bigint {
    if (operands.length < startIndex + 1) return 0n

    const actualLength = length || Math.min(4, operands.length - startIndex)
    let value = 0n

    for (let i = 0; i < actualLength && startIndex + i < operands.length; i++) {
      value |= BigInt(operands[startIndex + i]) << BigInt(i * 8)
    }

    // Sign extend if needed (for signed immediates)
    if (
      actualLength < 8 &&
      (value & (1n << BigInt(actualLength * 8 - 1))) !== 0n
    ) {
      const mask = (1n << BigInt(actualLength * 8)) - 1n
      value = -((~value + 1n) & mask)
    }

    return value
  }

  /**
   * Get 64-bit immediate value (8 Uint8Array)
   */
  protected getImmediate64(operands: Uint8Array, startIndex = 1): bigint {
    return this.getImmediateValue(operands, startIndex, 8)
  }

  /**
   * Get 32-bit immediate value (4 Uint8Array)
   */
  protected getImmediate32(operands: Uint8Array, startIndex = 1): number {
    return Number(this.getImmediateValue(operands, startIndex, 4))
  }

  /**
   * Get 16-bit immediate value (2 Uint8Array)
   */
  protected getImmediate16(operands: Uint8Array, startIndex = 1): number {
    return Number(this.getImmediateValue(operands, startIndex, 2))
  }

  /**
   * Get 8-bit immediate value (1 byte)
   */
  protected getImmediate8(operands: Uint8Array, startIndex = 1): number {
    return Number(this.getImmediateValue(operands, startIndex, 1))
  }

  /**
   * Set register value (64-bit)
   */
  protected setRegisterValue(
    registers: RegisterState,
    index: number,
    value: RegisterValue,
  ): void {
    if (index >= 0 && index <= 7) {
      const key = `r${index}` as keyof Pick<
        RegisterState,
        'r0' | 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7'
      >
      registers[key] = value
    } else if (index >= 8 && index <= 12) {
      const key = `r${index}` as keyof Pick<
        RegisterState,
        'r8' | 'r9' | 'r10' | 'r11' | 'r12'
      >
      registers[key] = BigInt(value) & 0xffffffffn
    }
  }

  /**
   * Set register value (32-bit)
   */
  protected setRegisterValue32(
    registers: Record<string, bigint>,
    index: number,
    value: RegisterValue32,
  ): void {
    if (index >= 8 && index <= 12) {
      registers[`r${index}`] = BigInt(value) & 0xffffffffn
    }
  }

  /**
   * Get register value (64-bit)
   */
  protected getRegisterValue(
    registers: RegisterState,
    index: number,
  ): RegisterValue {
    return registers[`r${index}` as keyof RegisterState]
  }

  /**
   * Get register value (32-bit)
   */
  protected getRegisterValue32(
    registers: RegisterState,
    index: number,
  ): RegisterValue32 {
    return registers[`r${index}` as keyof RegisterState]
  }

  /**
   * Default validation - check minimum operand count
   */
  validate(operands: Uint8Array): boolean {
    // For most instructions, we need at least 1 operand
    return operands.length >= 1
  }

  /**
   * Default disassembly - show opcode and operands
   */
  disassemble(operands: Uint8Array): string {
    return `${this.name} ${bytesToHex(operands)}`
  }

  /**
   * Abstract execute method
   */
  abstract execute(context: InstructionContext): InstructionResult
}
