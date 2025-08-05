import { beforeEach, describe, expect, it } from 'vitest'
import { InstructionRegistry } from '../../instructions/registry'

describe('Debug Instruction Tests', () => {
  let registry: InstructionRegistry

  beforeEach(() => {
    registry = InstructionRegistry.getInstance()
  })

  describe('Operand Parsing Debug', () => {
    it('should debug ADD_32 operand parsing', () => {
      const handler = registry.getHandler(0x190)!

      // Test the disassembly to see how operands are parsed
      const disassembly = handler.disassemble([0, 1, 2])
      console.log('ADD_32 disassembly:', disassembly)

      // Test validation
      const isValid = handler.validate([0, 1, 2])
      console.log('ADD_32 validation:', isValid)

      expect(disassembly).toBeDefined()
      expect(isValid).toBe(true)
    })

    it('should debug MOVE_REG operand parsing', () => {
      const handler = registry.getHandler(0x100)!

      const disassembly = handler.disassemble([0, 1])
      console.log('MOVE_REG disassembly:', disassembly)

      const isValid = handler.validate([0, 1])
      console.log('MOVE_REG validation:', isValid)

      expect(disassembly).toBeDefined()
      expect(isValid).toBe(true)
    })

    it('should debug JUMP operand parsing', () => {
      const handler = registry.getHandler(0x40)!

      const disassembly = handler.disassemble([100])
      console.log('JUMP disassembly:', disassembly)

      const isValid = handler.validate([100])
      console.log('JUMP validation:', isValid)

      expect(disassembly).toBeDefined()
      expect(isValid).toBe(true)
    })
  })
})
