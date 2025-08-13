use napi::bindgen_prelude::*;
use napi_derive::napi;
use reed_solomon_simd::{ReedSolomonEncoder, ReedSolomonDecoder};

#[napi(object)]
pub struct EncodedResult {
    pub shards: Vec<Buffer>,
    pub k: u32,
    pub n: u32,
    pub original_length: u32,
    pub indices: Vec<u32>,
}

#[napi(object)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[napi]
pub struct RustReedSolomon {
    k: usize,
    n: usize,
}

#[napi]
impl RustReedSolomon {
    #[napi(constructor)]
    pub fn new(k: u32, n: u32) -> Result<Self> {
        let k = k as usize;
        let n = n as usize;
        
        if k == 0 || n <= k {
            return Err(Error::new(
                Status::InvalidArg,
                format!("Invalid parameters: k={}, n={}", k, n),
            ));
        }
        
        Ok(RustReedSolomon { k, n })
    }

    #[napi]
    pub fn encode(&self, data: Buffer, shard_size: u32) -> Result<EncodedResult> {
        let data = data.as_ref();
        let original_length = data.len() as u32;
        
        // Use the provided shard size directly - no automatic modifications
        let actual_shard_size = shard_size as usize;
        
        // Prepare data shards
        let mut data_shards = vec![vec![0u8; actual_shard_size]; self.k];
        
        // Fill data shards
        for (i, &byte) in data.iter().enumerate() {
            let shard_index = i / actual_shard_size;
            let byte_index = i % actual_shard_size;
            if shard_index < self.k {
                data_shards[shard_index][byte_index] = byte;
            }
        }
        
        // Create encoder with recovery count (n - k)
        let mut encoder = ReedSolomonEncoder::new(self.k, self.n - self.k, actual_shard_size)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Encoder creation failed: {}", e)))?;
        
        // Add original shards to encoder
        for shard in &data_shards {
            encoder.add_original_shard(shard)
                .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to add original shard: {}", e)))?;
        }
        
        // Encode to get result
        let result = encoder.encode()
            .map_err(|e| Error::new(Status::GenericFailure, format!("Encoding failed: {}", e)))?;
        
        // Extract all shards from result
        let mut all_shards = Vec::new();
        
        // Add original data shards first
        for shard in &data_shards {
            all_shards.push(Buffer::from(shard.clone()));
        }
        
        // Add recovery shards from the result
        for recovery_shard in result.recovery_iter() {
            all_shards.push(Buffer::from(recovery_shard.to_vec()));
        }
        
        Ok(EncodedResult {
            shards: all_shards,
            k: self.k as u32,
            n: self.n as u32,
            original_length,
            indices: (0..self.n as u32).collect(),
        })
    }

    #[napi]
    pub fn decode(&self, shards: Vec<Buffer>, original_length: u32) -> Result<Buffer> {
        if shards.len() != self.n {
            return Err(Error::new(
                Status::InvalidArg,
                format!("Expected {} shards, got {}", self.n, shards.len()),
            ));
        }
        
        // Convert buffers to byte vectors
        let shard_data: Vec<Vec<u8>> = shards.iter().map(|s| s.as_ref().to_vec()).collect();
        
        if shard_data.is_empty() {
            return Ok(Buffer::from(vec![]));
        }
        
        // For basic decode, just reconstruct from data shards (first k shards)
        let data_shards = &shard_data[..self.k];
        
        // Concatenate data shards and trim to original length
        let mut result = Vec::new();
        for shard in data_shards {
            result.extend_from_slice(shard);
        }
        
        // Trim to original length
        result.truncate(original_length as usize);
        
        Ok(Buffer::from(result))
    }

    #[napi]
    pub fn recover(&self, shards: Vec<Buffer>, corrupted_indices: Vec<u32>, original_length: u32) -> Result<Buffer> {
        if shards.len() != self.n {
            return Err(Error::new(
                Status::InvalidArg,
                format!("Expected {} shards, got {}", self.n, shards.len()),
            ));
        }
        
        let shard_data: Vec<Vec<u8>> = shards.iter().map(|s| s.as_ref().to_vec()).collect();
        
        if shard_data.is_empty() {
            return Ok(Buffer::from(vec![]));
        }
        
        let shard_size = shard_data[0].len();
        
        // Create decoder
        let mut decoder = ReedSolomonDecoder::new(self.k, self.n - self.k, shard_size)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Decoder creation failed: {}", e)))?;
        
        // Add available shards to decoder
        for (i, shard) in shard_data.iter().enumerate() {
            if !corrupted_indices.contains(&(i as u32)) {
                if i < self.k {
                    // Original shard
                    decoder.add_original_shard(i, shard)
                        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to add original shard: {}", e)))?;
                } else {
                    // Recovery shard
                    decoder.add_recovery_shard(i - self.k, shard)
                        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to add recovery shard: {}", e)))?;
                }
            }
        }
        
        // Decode
        let result = decoder.decode()
            .map_err(|e| Error::new(Status::GenericFailure, format!("Decoding failed: {}", e)))?;
        
        // Reconstruct original data from all original shards (restored and already known)
        let mut reconstructed_data = Vec::new();
        for i in 0..self.k {
            if let Some(restored_shard) = result.restored_original(i) {
                // Use restored shard
                reconstructed_data.extend_from_slice(restored_shard);
            } else if !corrupted_indices.contains(&(i as u32)) && i < shard_data.len() {
                // Use original shard that wasn't corrupted
                reconstructed_data.extend_from_slice(&shard_data[i]);
            } else {
                return Err(Error::new(
                    Status::GenericFailure,
                    format!("Failed to reconstruct shard {}", i),
                ));
            }
        }
        
        // Trim to original length
        reconstructed_data.truncate(original_length as usize);
        
        Ok(Buffer::from(reconstructed_data))
    }

    #[napi]
    pub fn validate(&self, k: u32, n: u32) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        
        if k == 0 {
            errors.push("k must be positive".to_string());
        }
        
        if n <= k {
            errors.push("n must be greater than k".to_string());
        }
        
        if k > 255 || n > 255 {
            warnings.push("Very large k,n values may impact performance".to_string());
        }
        
        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }

    #[napi]
    pub fn get_k(&self) -> u32 {
        self.k as u32
    }
    
    #[napi]
    pub fn get_n(&self) -> u32 {
        self.n as u32
    }
    
    #[napi]
    pub fn get_parity_shards(&self) -> u32 {
        (self.n - self.k) as u32
    }
}
