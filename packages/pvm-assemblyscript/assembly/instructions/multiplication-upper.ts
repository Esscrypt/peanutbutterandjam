import {
  OPCODE_MUL_UPPER_S_S,
  OPCODE_MUL_UPPER_S_U,
  OPCODE_MUL_UPPER_U_U,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class MUL_UPPER_S_SInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_UPPER_S_S
  name: string = 'MUL_UPPER_S_S'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_D = unsigned(floor((signed(reg_A) * signed(reg_B)) / 2^64))
    // Convert to signed 64-bit values
    const signedA = i64(valueA)
    const signedB = i64(valueB)

    // Split into 32-bit parts with proper sign extension
    // For signed numbers: value = (sign-extended high 32 bits) * 2^32 + (low 32 bits)
    const aLo = u64(signedA) & u64(0xffffffff)
    const aHiSigned = i64(signedA >> 32)  // Arithmetic right shift preserves sign
    const bLo = u64(signedB) & u64(0xffffffff)
    const bHiSigned = i64(signedB >> 32)  // Arithmetic right shift preserves sign

    // For signed multiplication, we need to handle the cross terms correctly
    // aHi * bLo and aLo * bHi need to account for sign
    // Convert to signed 32-bit for proper sign handling
    const aHi32 = i32(aHiSigned)
    const bHi32 = i32(bHiSigned)
    
    // Compute cross terms as signed multiplications, then convert to unsigned
    // aHi * bLo: if aHi is negative (0xFFFFFFFF = -1), this should be negative
    const aHi_bLo_signed = i64(aHi32) * i64(bLo)
    const aLo_bHi_signed = i64(aLo) * i64(bHi32)
    
    // Convert to unsigned for bit manipulation (two's complement)
    const aHi_bLo = u64(aHi_bLo_signed)
    const aLo_bHi = u64(aLo_bHi_signed)

    // Low 32x32 multiplication (always unsigned)
    const aLo_bLo = aLo * bLo
    const carryFromLow = aLo_bLo >> 32
    
    // Split cross terms into high and low 32-bit parts
    const aHi_bLo_hi = aHi_bLo >> 32
    const aHi_bLo_lo = aHi_bLo & u64(0xffffffff)
    const aLo_bHi_hi = aLo_bHi >> 32
    const aLo_bHi_lo = aLo_bHi & u64(0xffffffff)
    
    // Add low parts with carry (all unsigned now, but may be negative in signed interpretation)
    const lowSum = aHi_bLo_lo + aLo_bHi_lo + carryFromLow
    const lowSumCarry = lowSum >> 32
    
    // Add high parts with carry
    // For signed arithmetic, we need to interpret the high parts as signed
    // aHi_bLo_hi and aLo_bHi_hi are the high 32 bits of signed products,
    // so they should be interpreted as signed when >= 2^31
    // Convert unsigned high 32 bits to signed: if >= 0x80000000, it's negative
    const aHi_bLo_hi_signed = i64(aHi_bLo_hi >= u64(0x80000000) ? aHi_bLo_hi - u64(0x100000000) : aHi_bLo_hi)
    const aLo_bHi_hi_signed = i64(aLo_bHi_hi >= u64(0x80000000) ? aLo_bHi_hi - u64(0x100000000) : aLo_bHi_hi)
    
    // Compute middle term sum as signed
    // lowSumCarry is always positive (0 or 1), so convert to signed
    const middleSumSigned = aHi_bLo_hi_signed + aLo_bHi_hi_signed + i64(lowSumCarry)
    
    // High 32x32 multiplication (signed)
    const signedAHi = aHiSigned
    const signedBHi = bHiSigned
    
    // Upper 64 bits of signed product: aHi*bHi (signed) + middleSumSigned (signed)
    const upperBits = signedAHi * signedBHi + middleSumSigned

    // Convert back to unsigned representation
    const result = u64(upperBits)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MUL_UPPER_U_UInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_UPPER_U_U
  name: string = 'MUL_UPPER_U_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_D = floor((reg_A * reg_B) / 2^64)
    // Split into 32-bit parts: value = hi * 2^32 + lo
    const aLo = valueA & u64(0xffffffff)
    const aHi = valueA >> 32
    const bLo = valueB & u64(0xffffffff)
    const bHi = valueB >> 32

    // Compute 128-bit product: (aHi*2^32 + aLo) * (bHi*2^32 + bLo)
    // = aHi*bHi*2^64 + (aHi*bLo + aLo*bHi)*2^32 + aLo*bLo
    // Upper 64 bits = aHi*bHi + ((aHi*bLo + aLo*bHi + (aLo*bLo >> 32)) >> 32)
    
    // To avoid overflow in the intermediate sum, compute in parts:
    // 1. Compute aLo * bLo and extract the carry (high 32 bits)
    const aLo_bLo = aLo * bLo
    const carryFromLow = aLo_bLo >> 32
    
    // 2. Compute aHi * bLo and aLo * bHi, split into high and low 32-bit parts
    const aHi_bLo = aHi * bLo
    const aLo_bHi = aLo * bHi
    
    // Extract high and low 32-bit parts of each product
    const aHi_bLo_hi = aHi_bLo >> 32
    const aHi_bLo_lo = aHi_bLo & u64(0xffffffff)
    const aLo_bHi_hi = aLo_bHi >> 32
    const aLo_bHi_lo = aLo_bHi & u64(0xffffffff)

    // 3. Add the low parts together with carryFromLow (this sum fits in 34 bits, safe in u64)
    const lowSum = aHi_bLo_lo + aLo_bHi_lo + carryFromLow
    const lowSumCarry = lowSum >> 32

    // 4. Add the high parts together with the carry from low sum (fits in u64)
    const middleHigh = aHi_bLo_hi + aLo_bHi_hi + lowSumCarry
    
    // 5. Final result: aHi*bHi + middleHigh
    const result = aHi * bHi + middleHigh

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MUL_UPPER_S_UInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MUL_UPPER_S_U
  name: string = 'MUL_UPPER_S_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_D = unsigned(floor((signed(reg_A) * reg_B) / 2^64))
    // Convert first operand to signed, keep second as unsigned
    const signedA = i64(valueA)
    const unsignedB = valueB

    // Split into 32-bit parts
    const aLo = u64(signedA) & u64(0xffffffff)
    // Extract high 32 bits and sign-extend to 64 bits
    const aHiSigned = i64(signedA >> 32)  // High 32 bits as signed (sign-extended)
    const aHi = u64(aHiSigned)  // For unsigned operations, but we'll convert back to signed when needed
    const bLo = unsignedB & u64(0xffffffff)
    const bHi = unsignedB >> 32

    // Compute 128-bit product: (aHi*2^32 + aLo) * (bHi*2^32 + bLo)
    // For signed-unsigned multiplication:
    // - aHi is signed (sign-extended 32-bit value)
    // - aLo is unsigned (low 32 bits)
    // - bHi and bLo are both unsigned
    
    // Low 32x32 multiplication (unsigned)
    const aLo_bLo = aLo * bLo
    const carryFromLow = aLo_bLo >> 32
    
    // Cross terms: aHi*bLo (signed * unsigned = signed) and aLo*bHi (unsigned * unsigned = unsigned)
    // We need to compute aHi*bLo as signed multiplication
    const aHi_bLo_signed = aHiSigned * i64(bLo)
    const aLo_bHi = aLo * bHi
    
    // Split aHi_bLo into high and low 32-bit parts (treating as signed)
    const aHi_bLo_hi_signed = i64(aHi_bLo_signed >> 32)
    const aHi_bLo_lo = u64(aHi_bLo_signed) & u64(0xffffffff)

    // Split aLo_bHi into high and low 32-bit parts (unsigned)
    const aLo_bHi_hi = aLo_bHi >> 32
    const aLo_bHi_lo = aLo_bHi & u64(0xffffffff)
    
    // Add low parts with carry
    const lowSum = aHi_bLo_lo + aLo_bHi_lo + carryFromLow
    const lowSumCarry = lowSum >> 32
    
    // Add high parts with carry
    // aHi_bLo_hi is signed, aLo_bHi_hi is unsigned, lowSumCarry is unsigned (0 or 1)
    const middleHigh = aHi_bLo_hi_signed + i64(aLo_bHi_hi) + i64(lowSumCarry)

    // High 32x32 multiplication: aHi (signed) * bHi (unsigned) = signed
    const signedAHi = aHiSigned
    const unsignedBHi = bHi

    // Upper 64 bits of signed-unsigned product
    const upperBits = signedAHi * i64(unsignedBHi) + middleHigh

    // Convert back to unsigned representation
    const result = u64(upperBits)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
