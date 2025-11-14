import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class ADD_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_64
  readonly name = 'ADD_64'
  readonly description = 'Add 64-bit registers'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA + valueB

    context.log('ADD_64: Addition of registerA and registerB to registerD', {
      operands: Array.from(context.instruction.operands),
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }

}

export class SUB_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SUB_64
  readonly name = 'SUB_64'
  readonly description = 'Subtract 64-bit registers'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA - valueB

    context.log('SUB_64: Subtraction of registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }

}

export class MUL_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_64
  readonly name = 'MUL_64'
  readonly description = 'Multiply 64-bit registers'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA * valueB

    context.log('MUL_64: Multiplication of registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }

}

export class DIV_U_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_U_64
  readonly name = 'DIV_U_64'
  readonly description = 'Divide 64-bit registers (unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Gray Paper: division by zero results in 2^64 - 1
    const result = valueB === 0n ? 2n ** 64n - 1n : valueA / valueB

    context.log('DIV_U_64: Division of unsigned registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })

    // Mutate context directly
    this.setRegisterValue(context.registers, registerD, result)

    return { resultCode: null }
  }

}

export class DIV_S_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.DIV_S_64
  readonly name = 'DIV_S_64'
  readonly description = 'Divide 64-bit registers (signed)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Convert to signed values
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)

    // Gray Paper: handle special cases
    let result: bigint
    if (signedB === 0n) {
      // Division by zero: result = 2^64 - 1
      result = 2n ** 64n - 1n
    } else if (signedA === -(2n ** 63n) && signedB === -1n) {
      // Overflow case: result = unsigned(a) = valueA
      result = valueA
    } else {
      // Normal division: round towards zero
      const signedResult = signedA / signedB
      result = signedResult < 0n ? signedResult + 2n ** 64n : signedResult
    }

    context.log('DIV_S_64: Division of signed registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      signedA,
      signedB,
      result,
    })

    // Mutate context directly
    this.setRegisterValue(context.registers, registerD, result)

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class REM_U_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_U_64
  readonly name = 'REM_U_64'
  readonly description = 'Remainder 64-bit registers (unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Gray Paper: when B = 0, result = A
    const result = valueB === 0n ? valueA : valueA % valueB

    context.log('REM_U_64: Remainder of unsigned registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })

    // Mutate context directly
    this.setRegisterValue(context.registers, registerD, result)

    return { resultCode: null }
  }

}

export class REM_S_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.REM_S_64
  readonly name = 'REM_S_64'
  readonly description = 'Remainder 64-bit registers (signed)'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Convert to signed values
    const signedA = valueA > 2n ** 63n - 1n ? valueA - 2n ** 64n : valueA
    const signedB = valueB > 2n ** 63n - 1n ? valueB - 2n ** 64n : valueB

    // Gray Paper: smod(a, b) = a when b = 0, or 0 when a = -2^63 and b = -1
    let result: bigint
    if (signedA === -(2n ** 63n) && signedB === -1n) {
      // Special overflow case: result = 0
      result = 0n
    } else if (signedB === 0n) {
      // Division by zero: result = a (signed modulo definition)
      result = valueA
    } else {
      // Normal case: sgn(a) * (|a| mod |b|)
      const absA = signedA < 0n ? -signedA : signedA
      const absB = signedB < 0n ? -signedB : signedB
      const sign = signedA < 0n ? -1n : 1n
      const signedResult = sign * (absA % absB)
      result = signedResult < 0n ? signedResult + 2n ** 64n : signedResult
    }

    context.log('REM_S_64: Remainder of signed registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      signedA,
      signedB,
      result,
    })

    // Mutate context directly
    this.setRegisterValue(context.registers, registerD, result)

    return { resultCode: null }
  }

}
