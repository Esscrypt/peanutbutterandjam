//! Crypto utilities (mirrors assembly/crypto.ts).
//! BLAKE2b-256 for PVM host functions and codec (Gray Paper).
//! Uses blake2 crate (0.10, same as submodules) with Blake2bVar for 32-byte output.

use blake2::digest::{Update, VariableOutput};
use blake2::Blake2bVar;

/// Blake2b-256 hash (32-byte output). Matches AssemblyScript/TypeScript blake2b256.
#[must_use]
pub fn blake2b256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Blake2bVar::new(32).expect("BLAKE2b-256 output size 32 is valid");
    hasher.update(data);
    let mut out = [0u8; 32];
    hasher.finalize_variable(&mut out).expect("32-byte output");
    out
}

#[cfg(test)]
mod tests {
    use super::blake2b256;

    #[test]
    fn blake2b256_empty_matches_known() {
        // Known BLAKE2b-256 of empty input (from pvm-assemblyscript blake2b256.test.ts)
        let expected: [u8; 32] = [
            0x0e, 0x57, 0x51, 0xc0, 0x26, 0xe5, 0x43, 0xb2, 0xe8, 0xab, 0x2e, 0xb0, 0x60, 0x99,
            0xda, 0xa1, 0xd1, 0xe5, 0xdf, 0x47, 0x77, 0x8f, 0x77, 0x87, 0xfa, 0xab, 0x45, 0xcd,
            0xf1, 0x2f, 0xe3, 0xa8,
        ];
        let got = blake2b256(&[]);
        assert_eq!(got, expected, "BLAKE2b-256(empty)");
    }
}
