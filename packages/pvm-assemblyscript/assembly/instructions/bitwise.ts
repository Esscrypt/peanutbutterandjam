import { OPCODE_AND_IMM, OPCODE_OR_IMM, OPCODE_XOR_IMM } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class AND_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_AND_IMM
  name: string = 'AND_IMM'
  
  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    
    const registerValue = this.getRegisterValueAs64(context.registers, registerB)
    const result = registerValue & immediateX

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class XOR_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_XOR_IMM
  name: string = 'XOR_IMM'
  
  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    
    const registerValue = this.getRegisterValueAs64(context.registers, registerB)
    const result = registerValue ^ immediateX

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class OR_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_OR_IMM
  name: string = 'OR_IMM'
  
  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    
    const registerValue = this.getRegisterValueAs64(context.registers, registerB)
    const result = registerValue | immediateX

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}
