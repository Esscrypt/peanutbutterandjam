use napi::bindgen_prelude::*;
use napi_derive::napi;
use reed_solomon_simd::{ReedSolomonEncoder, ReedSolomonDecoder};

/// Gray Paper H.1: Split a sequence into equal-sized sub-sequences
/// split_n(d ∈ Y_{k:n}) ∈ [Y_n]_k ≡ [d_{0⋯+n}, d_{n⋯+n}, ..., d_{(k-1)n⋯+n}]
fn split_n(data: &[u8], n: usize) -> Vec<Vec<u8>> {
    let k = data.len() / n;
    let mut result = Vec::new();
    for i in 0..k {
        let start = i * n;
        let end = start + n;
        result.push(data[start..end].to_vec());
    }
    result
}

/// Gray Paper H.2: Concatenate sequences back into a single sequence
/// join_n(c ∈ [Y_n]_k) ∈ Y_{k:n} ≡ c_0 ⌢ c_1 ⌢ ...
fn join_n(sequences: &[Vec<u8>]) -> Vec<u8> {
    let mut result = Vec::new();
    for seq in sequences {
        result.extend_from_slice(seq);
    }
    result
}

/// Gray Paper H.3: Unzip a sequence into n sequences (interleaved)
/// unzip_n(d ∈ Y_{k:n}) ∈ [Y_n]_k ≡ {[d_{j·k + i} | j ∈ ℕ_k] | i ∈ ℕ_n}
fn unzip_n(data: &[u8], n: usize) -> Vec<Vec<u8>> {
    let k = data.len() / n;
    let mut result = vec![Vec::new(); n];
    for i in 0..n {
        for j in 0..k {
            result[i].push(data[j * n + i]);
        }
    }
    result
}

/// Gray Paper H.4: Lace n sequences back into a single sequence (reverse of unzip)
/// lace_n(c ∈ Y_n^k) ∈ Y_{k:n} ≡ d where ∀i ∈ ℕ_k, j ∈ ℕ_n: d_{j·k + i} = (c_i)_j
fn lace_n(sequences: &[Vec<u8>]) -> Vec<u8> {
    if sequences.is_empty() {
        return Vec::new();
    }
    let n = sequences.len();
    let k = sequences[0].len();
    let mut result = Vec::with_capacity(k * n);
    for j in 0..k {
        for i in 0..n {
            if j < sequences[i].len() {
                result.push(sequences[i][j]);
            }
        }
    }
    result
}

#[napi(object)]
pub struct ShardWithIndex {
    pub shard: Buffer,
    pub index: u32,
}

#[napi(object)]
pub struct EncodedResult {
    pub shards_with_indices: Vec<ShardWithIndex>,
    #[napi(js_name = "originalLength")]
    pub original_length: u32,
}

#[napi]
pub struct ReedSolomonCoder {
    k: u32,
    n: u32,
}

#[napi]
impl ReedSolomonCoder {
    #[napi(constructor)]
    pub fn new(k: u32, n: u32) -> Self {
        Self { k, n }
    }

    #[napi]
    pub fn encode(&self, data: Buffer) -> Result<EncodedResult> {
        let data_bytes = data.as_ref();
        let original_length = data_bytes.len() as u32;

        // Gray Paper Appendix H parameters
        let C = self.k; // C = 2 (number of original shards)
        let V = self.n; // V = 6 (total number of shards)
        let W_E = C * 2; // W_E = 4 bytes per piece (2 octet pairs)

        // Gray Paper H.1: Pad data to multiple of 4 octets (W_E)
        // "Data whose length is not divisible by 4 must be padded (we pad with zeroes)"
        let mut padded_data = data_bytes.to_vec();
        if padded_data.len() % W_E as usize != 0 {
            let pad_len = W_E as usize - (padded_data.len() % W_E as usize);
            padded_data.extend(std::iter::repeat(0).take(pad_len));
        }

        // Gray Paper H.1: Split into k pieces of 4 octets each
        // k = number of 4-octet pieces
        let k = padded_data.len() / W_E as usize;

        // JAM Test Vectors approach: Match the reference implementation exactly
        // Note: This does NOT follow Gray Paper H.6 exactly, but matches the test vectors
        
        let shard_size = padded_data.len() / C as usize;
        let k = padded_data.len() / W_E as usize;
        let mut original_shards: Vec<Vec<u8>> = vec![Vec::with_capacity(2 * k); C as usize];
        let mut recovery_shards: Vec<Vec<u8>> = vec![Vec::with_capacity(2 * k); (V - C) as usize];

        for i in 0..k {
            let mut encoder = ReedSolomonEncoder::new(C as usize, (V - C) as usize, 2)
                .map_err(|e| Error::new(Status::GenericFailure, format!("Encoder creation failed for piece {}: {}", i, e)))?;
            
            for c in 0..C as usize {
                let shard = [
                    padded_data[i * 2 + c * shard_size],
                    padded_data[i * 2 + c * shard_size + 1],
                ];
                encoder.add_original_shard(&shard)
                    .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to add original shard {} for piece {}: {}", c, i, e)))?;
                original_shards[c].extend_from_slice(&shard);
            }

            let encoded = encoder.encode()
                .map_err(|e| Error::new(Status::GenericFailure, format!("Encoding failed for piece {}: {}", i, e)))?;
            
            for (j, shard) in encoded.recovery_iter().enumerate() {
                recovery_shards[j].extend_from_slice(shard);
            }
        }

        // Combine original shards and recovery shards (original first, then recovery)
        let mut shards_with_indices = Vec::new();
        
        // Add original shards (indices 0 to C-1)
        for (i, shard) in original_shards.into_iter().enumerate() {
            shards_with_indices.push(ShardWithIndex {
                shard: Buffer::from(shard),
                index: i as u32,
            });
        }
        
        // Add recovery shards (indices C to V-1)
        for (i, shard) in recovery_shards.into_iter().enumerate() {
            shards_with_indices.push(ShardWithIndex {
                shard: Buffer::from(shard),
                index: (C + i as u32),
            });
        }

        Ok(EncodedResult {
            shards_with_indices,
            original_length,
        })
    }

    #[napi]
    pub fn decode(&self, encoded: EncodedResult) -> Result<Buffer> {
        // Gray Paper Appendix H parameters
        let C = self.k; // C = 2 (number of original shards)
        let V = self.n; // V = 6 (total number of shards)

        if encoded.shards_with_indices.len() < C as usize {
            return Err(Error::new(Status::InvalidArg, format!("Expected at least {} shards, got {}", C, encoded.shards_with_indices.len())));
        }

        // Check if we have all original shards (indices 0 to C-1)
        let mut has_all_original = true;
        let mut original_shards: Vec<Option<&Buffer>> = vec![None; C as usize];
        
        for shard_with_index in &encoded.shards_with_indices {
            if shard_with_index.index < C {
                original_shards[shard_with_index.index as usize] = Some(&shard_with_index.shard);
            }
        }
        
        // Check if we have all original shards
        for i in 0..C as usize {
            if original_shards[i].is_none() {
                has_all_original = false;
                break;
            }
        }

        if has_all_original {
            // We have all original shards - just concatenate them back
            let mut reconstructed_data = Vec::new();
            
            // Concatenate the original shards back together
            for c in 0..C as usize {
                if let Some(shard) = original_shards[c] {
                    reconstructed_data.extend_from_slice(shard);
                }
            }

            // Trim to original length
            reconstructed_data.truncate(encoded.original_length as usize);
            return Ok(Buffer::from(reconstructed_data));
        }

        // We need to use Reed-Solomon decoding for recovery
        // Determine number of 4-byte pieces from shard size
        let shard_size = encoded.shards_with_indices[0].shard.len();
        let k = shard_size / 2; // number of 4-byte pieces (each piece has 2 octet pairs)

        // Create decoder with same parameters as encoder
        let mut decoder = ReedSolomonDecoder::new(C as usize, (V - C) as usize, 2)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Decoder creation failed: C={}, V-C={}, shard_size=2, error={}", C, V - C, e)))?;

        // Add shards based on their actual indices
        let mut shard_count = 0;

        for shard_with_index in &encoded.shards_with_indices {
            let shard_index = shard_with_index.index as usize;
            
            if shard_index < C as usize {
                // This is an original shard
                decoder.add_original_shard(shard_index, &shard_with_index.shard)
                    .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to add original shard {}: {}", shard_index, e)))?;
                shard_count += 1;
            } else {
                // This is a recovery shard
                let recovery_index = shard_index - C as usize;
                decoder.add_recovery_shard(recovery_index, &shard_with_index.shard)
                    .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to add recovery shard {}: {}", recovery_index, e)))?;
                shard_count += 1;
            }
        }

        if shard_count < C {
            return Err(Error::new(Status::InvalidArg, format!("Need at least {} shards for recovery, got {}", C, shard_count)));
        }

        // Decode the entire dataset
        let result = decoder.decode()
            .map_err(|e| Error::new(Status::GenericFailure, format!("Decoding failed: {}", e)))?;

        // Gray Paper H.4: lace_k function for reconstruction
        let mut reconstructed_data = Vec::new();

        // Reconstruct by lacing the recovered shards
        for j in 0..k {
            for i in 0..C as usize {
                // Get the j-th octet pair from the i-th recovered shard
                if let Some((_, shard_data)) = result.restored_original_iter().nth(i) {
                    if j * 2 + 1 < shard_data.len() {
                        reconstructed_data.push(shard_data[j * 2]);     // low byte
                        reconstructed_data.push(shard_data[j * 2 + 1]); // high byte
                    }
                }
            }
        }

        // Trim to original length
        reconstructed_data.truncate(encoded.original_length as usize);

        Ok(Buffer::from(reconstructed_data))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gray_paper_utility_functions() {
        // Test data: 8 bytes = 2 pieces of 4 bytes each
        let data = vec![1, 2, 3, 4, 5, 6, 7, 8];
        
        // Test H.1: split_n
        let split_result = split_n(&data, 4);
        assert_eq!(split_result.len(), 2);
        assert_eq!(split_result[0], vec![1, 2, 3, 4]);
        assert_eq!(split_result[1], vec![5, 6, 7, 8]);
        
        // Test H.2: join_n
        let joined = join_n(&split_result);
        assert_eq!(joined, data);
        
        // Test H.3: unzip_n
        let unzipped = unzip_n(&data, 4);
        assert_eq!(unzipped.len(), 4);
        assert_eq!(unzipped[0], vec![1, 5]); // Every 4th byte starting from 0
        assert_eq!(unzipped[1], vec![2, 6]); // Every 4th byte starting from 1
        assert_eq!(unzipped[2], vec![3, 7]); // Every 4th byte starting from 2
        assert_eq!(unzipped[3], vec![4, 8]); // Every 4th byte starting from 3
        
        // Test H.4: lace_n (reverse of unzip_n)
        let laced = lace_n(&unzipped);
        assert_eq!(laced, data);
        
        // Verify that lace_n is the inverse of unzip_n
        let original_data = vec![10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
        let unzipped_data = unzip_n(&original_data, 4);
        let laced_back = lace_n(&unzipped_data);
        assert_eq!(laced_back, original_data);
    }

    #[test]
    fn test_encode_decode() {
        let coder = ReedSolomonCoder::new(2, 6);
        let test_data = vec![1, 2, 3, 4, 5, 6, 7, 8];
        let data_buffer = Buffer::from(test_data.clone());
        
        let encoded = coder.encode(data_buffer).unwrap();
        assert_eq!(encoded.shards.len(), 6);
        assert_eq!(encoded.k, 2);
        assert_eq!(encoded.n, 6);
        
        let decoded = coder.decode(encoded).unwrap();
        assert_eq!(decoded.as_ref(), &test_data);
    }
}