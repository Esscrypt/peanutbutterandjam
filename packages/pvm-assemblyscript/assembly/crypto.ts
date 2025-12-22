/**
 * Blake2b-256 hash implementation for AssemblyScript
 * 
 * This is a minimal implementation of Blake2b with 256-bit output (32 bytes)
 * for use in the PVM host functions.
 * 
 * Based on RFC 7693: https://tools.ietf.org/html/rfc7693
 */

// Blake2b-256 initialization vector
const IV: u64[] = [
  0x6a09e667f3bcc908,
  0xbb67ae8584caa73b,
  0x3c6ef372fe94f82b,
  0xa54ff53a5f1d36f1,
  0x510e527fade682d1,
  0x9b05688c2b3e6c1f,
  0x1f83d9abfb41bd6b,
  0x5be0cd19137e2179
]

// Blake2b sigma permutations
const SIGMA: u8[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
]

// Rotation constants for G function
const R1: u32 = 32
const R2: u32 = 24
const R3: u32 = 16
const R4: u32 = 63

// G mixing function
function G(v: u64[], a: i32, b: i32, c: i32, d: i32, x: u64, y: u64): void {
  v[a] = v[a] + v[b] + x
  v[d] = rotr64(v[d] ^ v[a], R1)
  v[c] = v[c] + v[d]
  v[b] = rotr64(v[b] ^ v[c], R2)
  v[a] = v[a] + v[b] + y
  v[d] = rotr64(v[d] ^ v[a], R3)
  v[c] = v[c] + v[d]
  v[b] = rotr64(v[b] ^ v[c], R4)
}

// 64-bit rotate right
function rotr64(x: u64, n: u32): u64 {
  return (x >> n) | (x << (64 - n))
}

// Compress function
function compress(h: u64[], chunk: Uint8Array, t: u64, last: bool): void {
  // Initialize working vector
  const v: u64[] = new Array<u64>(16)
  for (let i = 0; i < 8; i++) {
    v[i] = h[i]
    v[i + 8] = IV[i]
  }
  
  // XOR counter and flags
  v[12] ^= t  // Low 64 bits of offset
  v[13] ^= 0  // High 64 bits of offset (always 0 for small inputs)
  if (last) {
    v[14] ^= 0xffffffffffffffff
  }
  
  // Parse message block into 16 u64 words (little-endian)
  const m: u64[] = new Array<u64>(16)
  for (let i = 0; i < 16; i++) {
    const offset = i * 8
    if (offset + 8 <= chunk.length) {
      m[i] = 
        u64(chunk[offset]) |
        (u64(chunk[offset + 1]) << 8) |
        (u64(chunk[offset + 2]) << 16) |
        (u64(chunk[offset + 3]) << 24) |
        (u64(chunk[offset + 4]) << 32) |
        (u64(chunk[offset + 5]) << 40) |
        (u64(chunk[offset + 6]) << 48) |
        (u64(chunk[offset + 7]) << 56)
    } else {
      m[i] = 0
    }
  }
  
  // 12 rounds
  for (let round = 0; round < 12; round++) {
    const s = SIGMA[round % 10]
    G(v, 0, 4, 8, 12, m[s[0]], m[s[1]])
    G(v, 1, 5, 9, 13, m[s[2]], m[s[3]])
    G(v, 2, 6, 10, 14, m[s[4]], m[s[5]])
    G(v, 3, 7, 11, 15, m[s[6]], m[s[7]])
    G(v, 0, 5, 10, 15, m[s[8]], m[s[9]])
    G(v, 1, 6, 11, 12, m[s[10]], m[s[11]])
    G(v, 2, 7, 8, 13, m[s[12]], m[s[13]])
    G(v, 3, 4, 9, 14, m[s[14]], m[s[15]])
  }
  
  // Finalize: h = h XOR upper XOR lower
  for (let i = 0; i < 8; i++) {
    h[i] ^= v[i] ^ v[i + 8]
  }
}

/**
 * Compute Blake2b-256 hash of input data
 * @param data Input bytes to hash
 * @returns 32-byte hash result
 */
export function blake2b256(data: Uint8Array): Uint8Array {
  const outlen: u8 = 32  // 256 bits = 32 bytes
  const blockSize = 128  // Blake2b block size
  
  // Initialize state
  const h: u64[] = new Array<u64>(8)
  for (let i = 0; i < 8; i++) {
    h[i] = IV[i]
  }
  
  // Parameter block: outlen=32, keylen=0, fanout=1, depth=1
  h[0] ^= u64(outlen) | (u64(0) << 8) | (u64(1) << 16) | (u64(1) << 24)
  
  // Process full blocks
  let offset: i32 = 0
  while (offset + blockSize < data.length) {
    const chunk = data.slice(offset, offset + blockSize)
    compress(h, chunk, u64(offset + blockSize), false)
    offset += blockSize
  }
  
  // Process final block (padded with zeros)
  const remaining = data.length - offset
  const lastChunk = new Uint8Array(blockSize)
  for (let i = 0; i < remaining; i++) {
    lastChunk[i] = data[offset + i]
  }
  compress(h, lastChunk, u64(data.length), true)
  
  // Output hash (little-endian)
  const result = new Uint8Array(32)
  for (let i = 0; i < 4; i++) {
    const val = h[i]
    result[i * 8 + 0] = u8(val & 0xff)
    result[i * 8 + 1] = u8((val >> 8) & 0xff)
    result[i * 8 + 2] = u8((val >> 16) & 0xff)
    result[i * 8 + 3] = u8((val >> 24) & 0xff)
    result[i * 8 + 4] = u8((val >> 32) & 0xff)
    result[i * 8 + 5] = u8((val >> 40) & 0xff)
    result[i * 8 + 6] = u8((val >> 48) & 0xff)
    result[i * 8 + 7] = u8((val >> 56) & 0xff)
  }
  
  return result
}

