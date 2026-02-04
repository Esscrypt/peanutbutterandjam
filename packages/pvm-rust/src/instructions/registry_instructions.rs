//! Register all instruction handlers into the registry (mirrors registry.ts registerInstructions).

use super::control_flow::{
    FallthroughInstruction, JumpIndInstruction, JumpInstruction, LoadImmJumpIndInstruction,
    LoadImmJumpInstruction, TrapInstruction,
};
use super::arithmetic::{
    Add32Instruction, AddImm32Instruction, AddImm64Instruction, DivS32Instruction,
    DivU32Instruction, Mul32Instruction, MulImm32Instruction, MulImm64Instruction,
    RemS32Instruction, RemU32Instruction, Sub32Instruction,
};
use super::arithmetic_64::{
    Add64Instruction, DivS64Instruction, DivU64Instruction, Mul64Instruction,
    RemS64Instruction, RemU64Instruction, Sub64Instruction,
};
use super::bitwise::{
    AndImmInstruction, AndInstruction, OrImmInstruction, OrInstruction, XorImmInstruction,
    XorInstruction,
};
use super::branching::{
    BranchEqImmInstruction, BranchEqInstruction, BranchGeSImmInstruction, BranchGeSInstruction,
    BranchGeUImmInstruction, BranchGeUInstruction, BranchGtSImmInstruction, BranchGtUImmInstruction,
    BranchLeSImmInstruction, BranchLeUImmInstruction, BranchLtSImmInstruction, BranchLtSInstruction,
    BranchLtUImmInstruction, BranchLtUInstruction, BranchNeImmInstruction, BranchNeInstruction,
};
use super::comparison::{
    SetGtSImmInstruction, SetGtUImmInstruction, SetLtSImmInstruction, SetLtSInstruction,
    SetLtUImmInstruction, SetLtUInstruction,
};
use super::conditional::{
    CmovIzImmInstruction, CmovIzInstruction, CmovNzImmInstruction, CmovNzInstruction,
};
use super::index::{MoveRegInstruction, SbrkInstruction};
use super::register_ops::{
    CountSetBits32Instruction, CountSetBits64Instruction, LeadingZeroBits32Instruction,
    LeadingZeroBits64Instruction, ReverseBytesInstruction, SignExtend16Instruction,
    SignExtend8Instruction, TrailingZeroBits32Instruction, TrailingZeroBits64Instruction,
    ZeroExtend16Instruction,
};
use super::shifts::{
    NegAddImm32Instruction, SharRImm32Instruction, ShloLImm32Instruction, ShloRImm32Instruction,
};
use super::shifts_32_register::{SharR32Instruction, ShloL32Instruction, ShloR32Instruction};
use super::shifts_64::{
    NegAddImm64Instruction, SharRImm64Instruction, ShloLImm64Instruction, ShloRImm64Instruction,
};
use super::shifts_64_register::{SharR64Instruction, ShloL64Instruction, ShloR64Instruction};
use super::shifts_alt::{
    SharRImmAlt32Instruction, ShloLImmAlt32Instruction, ShloRImmAlt32Instruction,
};
use super::shifts_alt_64::{
    SharRImmAlt64Instruction, ShloLImmAlt64Instruction, ShloRImmAlt64Instruction,
};
use super::rotations::{
    RotR32ImmAltInstruction, RotR32ImmInstruction, RotR64ImmAltInstruction, RotR64ImmInstruction,
};
use super::rotation_register::{
    RotL32Instruction, RotL64Instruction, RotR32Instruction, RotR64Instruction,
};
use super::advanced_bitwise::{AndInvInstruction, OrInvInstruction, XnorInstruction};
use super::min_max::{MaxInstruction, MaxUInstruction, MinInstruction, MinUInstruction};
use super::multiplication_upper::{
    MulUpperSSInstruction, MulUpperSUInstruction, MulUpperUUInstruction,
};
use super::memory::{
    LoadImm64Instruction, LoadImmInstruction, LoadI16Instruction, LoadI32Instruction,
    LoadI8Instruction, LoadU16Instruction, LoadU32Instruction, LoadU64Instruction,
    LoadU8Instruction, StoreImmIndU16Instruction, StoreImmIndU32Instruction,
    StoreImmIndU64Instruction, StoreImmIndU8Instruction, StoreImmU16Instruction,
    StoreImmU32Instruction, StoreImmU64Instruction, StoreImmU8Instruction,
    StoreU16Instruction, StoreU32Instruction, StoreU64Instruction, StoreU8Instruction,
};
use super::memory_indirect::{
    LoadIndI16Instruction, LoadIndI32Instruction, LoadIndI8Instruction, LoadIndU16Instruction,
    LoadIndU32Instruction, LoadIndU64Instruction, LoadIndU8Instruction, StoreIndU16Instruction,
    StoreIndU32Instruction, StoreIndU64Instruction, StoreIndU8Instruction,
};
use super::registry::InstructionRegistry;
use super::system::EcalliInstruction;

/// Register control-flow, system, and memory instructions.
pub fn register_all_instructions(registry: &mut InstructionRegistry) {
    registry.register(Box::new(TrapInstruction::new()));
    registry.register(Box::new(FallthroughInstruction::new()));
    registry.register(Box::new(JumpInstruction::new()));
    registry.register(Box::new(JumpIndInstruction::new()));
    registry.register(Box::new(LoadImmJumpInstruction::new()));
    registry.register(Box::new(LoadImmJumpIndInstruction::new()));
    registry.register(Box::new(EcalliInstruction::new()));

    registry.register(Box::new(Add32Instruction::new()));
    registry.register(Box::new(Sub32Instruction::new()));
    registry.register(Box::new(Mul32Instruction::new()));
    registry.register(Box::new(DivU32Instruction::new()));
    registry.register(Box::new(DivS32Instruction::new()));
    registry.register(Box::new(RemU32Instruction::new()));
    registry.register(Box::new(RemS32Instruction::new()));
    registry.register(Box::new(AddImm32Instruction::new()));
    registry.register(Box::new(MulImm32Instruction::new()));
    registry.register(Box::new(Add64Instruction::new()));
    registry.register(Box::new(Sub64Instruction::new()));
    registry.register(Box::new(Mul64Instruction::new()));
    registry.register(Box::new(DivU64Instruction::new()));
    registry.register(Box::new(DivS64Instruction::new()));
    registry.register(Box::new(RemU64Instruction::new()));
    registry.register(Box::new(RemS64Instruction::new()));
    registry.register(Box::new(AddImm64Instruction::new()));
    registry.register(Box::new(MulImm64Instruction::new()));
    registry.register(Box::new(AndImmInstruction::new()));
    registry.register(Box::new(XorImmInstruction::new()));
    registry.register(Box::new(OrImmInstruction::new()));
    registry.register(Box::new(SetLtUImmInstruction::new()));
    registry.register(Box::new(SetLtSImmInstruction::new()));
    registry.register(Box::new(SetGtUImmInstruction::new()));
    registry.register(Box::new(SetGtSImmInstruction::new()));
    registry.register(Box::new(CmovIzImmInstruction::new()));
    registry.register(Box::new(CmovNzImmInstruction::new()));
    registry.register(Box::new(BranchEqImmInstruction::new()));
    registry.register(Box::new(BranchNeImmInstruction::new()));
    registry.register(Box::new(BranchLtUImmInstruction::new()));
    registry.register(Box::new(BranchLeUImmInstruction::new()));
    registry.register(Box::new(BranchGeUImmInstruction::new()));
    registry.register(Box::new(BranchGtUImmInstruction::new()));
    registry.register(Box::new(BranchLtSImmInstruction::new()));
    registry.register(Box::new(BranchLeSImmInstruction::new()));
    registry.register(Box::new(BranchGeSImmInstruction::new()));
    registry.register(Box::new(BranchGtSImmInstruction::new()));
    registry.register(Box::new(BranchEqInstruction::new()));
    registry.register(Box::new(BranchNeInstruction::new()));
    registry.register(Box::new(BranchLtUInstruction::new()));
    registry.register(Box::new(BranchLtSInstruction::new()));
    registry.register(Box::new(BranchGeUInstruction::new()));
    registry.register(Box::new(BranchGeSInstruction::new()));
    registry.register(Box::new(AndInstruction::new()));
    registry.register(Box::new(XorInstruction::new()));
    registry.register(Box::new(OrInstruction::new()));
    registry.register(Box::new(SetLtUInstruction::new()));
    registry.register(Box::new(SetLtSInstruction::new()));
    registry.register(Box::new(CmovIzInstruction::new()));
    registry.register(Box::new(CmovNzInstruction::new()));
    registry.register(Box::new(MoveRegInstruction::new()));
    registry.register(Box::new(SbrkInstruction::new()));
    registry.register(Box::new(CountSetBits64Instruction::new()));
    registry.register(Box::new(CountSetBits32Instruction::new()));
    registry.register(Box::new(LeadingZeroBits64Instruction::new()));
    registry.register(Box::new(LeadingZeroBits32Instruction::new()));
    registry.register(Box::new(TrailingZeroBits64Instruction::new()));
    registry.register(Box::new(TrailingZeroBits32Instruction::new()));
    registry.register(Box::new(SignExtend8Instruction::new()));
    registry.register(Box::new(SignExtend16Instruction::new()));
    registry.register(Box::new(ZeroExtend16Instruction::new()));
    registry.register(Box::new(ReverseBytesInstruction::new()));

    registry.register(Box::new(ShloLImm32Instruction::new()));
    registry.register(Box::new(ShloRImm32Instruction::new()));
    registry.register(Box::new(SharRImm32Instruction::new()));
    registry.register(Box::new(NegAddImm32Instruction::new()));
    registry.register(Box::new(ShloLImmAlt32Instruction::new()));
    registry.register(Box::new(ShloRImmAlt32Instruction::new()));
    registry.register(Box::new(SharRImmAlt32Instruction::new()));
    registry.register(Box::new(ShloLImm64Instruction::new()));
    registry.register(Box::new(ShloRImm64Instruction::new()));
    registry.register(Box::new(SharRImm64Instruction::new()));
    registry.register(Box::new(NegAddImm64Instruction::new()));
    registry.register(Box::new(ShloLImmAlt64Instruction::new()));
    registry.register(Box::new(ShloRImmAlt64Instruction::new()));
    registry.register(Box::new(SharRImmAlt64Instruction::new()));
    registry.register(Box::new(RotR64ImmInstruction::new()));
    registry.register(Box::new(RotR64ImmAltInstruction::new()));
    registry.register(Box::new(RotR32ImmInstruction::new()));
    registry.register(Box::new(RotR32ImmAltInstruction::new()));
    registry.register(Box::new(ShloL32Instruction::new()));
    registry.register(Box::new(ShloR32Instruction::new()));
    registry.register(Box::new(SharR32Instruction::new()));
    registry.register(Box::new(ShloL64Instruction::new()));
    registry.register(Box::new(ShloR64Instruction::new()));
    registry.register(Box::new(SharR64Instruction::new()));
    registry.register(Box::new(RotL64Instruction::new()));
    registry.register(Box::new(RotL32Instruction::new()));
    registry.register(Box::new(RotR64Instruction::new()));
    registry.register(Box::new(RotR32Instruction::new()));
    registry.register(Box::new(AndInvInstruction::new()));
    registry.register(Box::new(OrInvInstruction::new()));
    registry.register(Box::new(XnorInstruction::new()));
    registry.register(Box::new(MaxInstruction::new()));
    registry.register(Box::new(MaxUInstruction::new()));
    registry.register(Box::new(MinInstruction::new()));
    registry.register(Box::new(MinUInstruction::new()));
    registry.register(Box::new(MulUpperSSInstruction::new()));
    registry.register(Box::new(MulUpperUUInstruction::new()));
    registry.register(Box::new(MulUpperSUInstruction::new()));

    registry.register(Box::new(LoadImm64Instruction::new()));
    registry.register(Box::new(LoadImmInstruction::new()));
    registry.register(Box::new(StoreImmU8Instruction::new()));
    registry.register(Box::new(StoreImmU16Instruction::new()));
    registry.register(Box::new(StoreImmU32Instruction::new()));
    registry.register(Box::new(StoreImmU64Instruction::new()));
    registry.register(Box::new(LoadU8Instruction::new()));
    registry.register(Box::new(LoadI8Instruction::new()));
    registry.register(Box::new(LoadU16Instruction::new()));
    registry.register(Box::new(LoadI16Instruction::new()));
    registry.register(Box::new(LoadU32Instruction::new()));
    registry.register(Box::new(LoadI32Instruction::new()));
    registry.register(Box::new(LoadU64Instruction::new()));
    registry.register(Box::new(StoreU8Instruction::new()));
    registry.register(Box::new(StoreU16Instruction::new()));
    registry.register(Box::new(StoreU32Instruction::new()));
    registry.register(Box::new(StoreU64Instruction::new()));
    registry.register(Box::new(StoreImmIndU8Instruction::new()));
    registry.register(Box::new(StoreImmIndU16Instruction::new()));
    registry.register(Box::new(StoreImmIndU32Instruction::new()));
    registry.register(Box::new(StoreImmIndU64Instruction::new()));
    registry.register(Box::new(StoreIndU8Instruction::new()));
    registry.register(Box::new(StoreIndU16Instruction::new()));
    registry.register(Box::new(StoreIndU32Instruction::new()));
    registry.register(Box::new(StoreIndU64Instruction::new()));
    registry.register(Box::new(LoadIndU8Instruction::new()));
    registry.register(Box::new(LoadIndI8Instruction::new()));
    registry.register(Box::new(LoadIndU16Instruction::new()));
    registry.register(Box::new(LoadIndI16Instruction::new()));
    registry.register(Box::new(LoadIndU32Instruction::new()));
    registry.register(Box::new(LoadIndI32Instruction::new()));
    registry.register(Box::new(LoadIndU64Instruction::new()));
}
