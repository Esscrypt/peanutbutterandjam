//! Instruction set (mirrors assembly/instructions/). Stub.

pub mod registry;
pub mod base;
pub mod control_flow;
pub mod memory;
pub mod memory_indirect;
pub mod arithmetic;
pub mod arithmetic_64;
pub mod bitwise;
pub mod comparison;
pub mod conditional;
pub mod branching;
pub mod system;
pub mod registry_instructions;
pub mod index;
pub mod register_ops;
pub mod shifts;
pub mod shifts_alt;
pub mod shifts_64;
pub mod shifts_alt_64;
pub mod shifts_32_register;
pub mod shifts_64_register;
pub mod rotations;
pub mod rotation_register;
pub mod advanced_bitwise;
pub mod min_max;
pub mod multiplication_upper;
