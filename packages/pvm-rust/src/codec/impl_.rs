//! Codec implementation (Gray Paper serialization).
//! Ported from pvm-assemblyscript/assembly/codec.ts.

use crate::crypto::blake2b256;

// ============================================================================
// Decoding result
// ============================================================================

/// Decoding result: value and number of bytes consumed.
#[derive(Clone, Debug)]
pub struct DecodingResult<T> {
    pub value: T,
    pub consumed: i32,
}

impl<T> DecodingResult<T> {
    #[must_use]
    pub const fn new(value: T, consumed: i32) -> Self {
        Self { value, consumed }
    }
}

// ============================================================================
// Service code / program structures
// ============================================================================

/// Service code decoding result (metadata + code blob).
#[derive(Clone, Debug)]
pub struct ServiceCodeResult {
    pub metadata: Vec<u8>,
    pub code_blob: Vec<u8>,
}

/// Decoded blob (deblob format): code, bitmask, jump table.
#[derive(Clone, Debug)]
pub struct DecodedBlob {
    pub code: Vec<u8>,
    pub bitmask: Vec<u8>,
    pub jump_table: Vec<u32>,
    pub element_size: i32,
    pub header_size: i32,
}

/// Decoded program (Y function format): ro/rw data, code, sizes.
#[derive(Clone, Debug)]
pub struct DecodedProgram {
    pub metadata: Vec<u8>,
    pub ro_data_length: u32,
    pub rw_data_length: u32,
    pub heap_zero_padding_size: u32,
    pub stack_size: u32,
    pub ro_data: Vec<u8>,
    pub rw_data: Vec<u8>,
    pub code_size: u32,
    pub code: Vec<u8>,
}

/// Decoded accumulate arguments.
#[derive(Clone, Debug)]
pub struct DecodedAccumulateArgs {
    pub timeslot: u64,
    pub service_id: u64,
    pub input_length: u64,
}

// ============================================================================
// Natural number encoding (Gray Paper Eq 30–38)
// ============================================================================

/// Decode natural number from variable-length encoding.
/// Returns None on invalid or truncated data.
#[must_use]
pub fn decode_natural(data: &[u8]) -> Option<DecodingResult<u64>> {
    let first = *data.first()?;

    if first == 0 {
        return Some(DecodingResult::new(0, 1));
    }
    if first == 0xff {
        if data.len() < 9 {
            return None;
        }
        let mut value: u64 = 0;
        for (i, &b) in data[1..9].iter().enumerate() {
            value |= u64::from(b) << (i * 8);
        }
        return Some(DecodingResult::new(value, 9));
    }
    if (1..=127).contains(&first) {
        return Some(DecodingResult::new(u64::from(first), 1));
    }

    let mut l = 0i32;
    for test_l in 1..=8 {
        let shift_8_minus_l = 8 - test_l;
        let min_prefix: u64 = 256u64.saturating_sub(1 << shift_8_minus_l);
        let seven_l_plus_one = 7 * (test_l + 1);
        let max_suffix = (1u64 << seven_l_plus_one).saturating_sub(1) >> (8 * test_l);
        let max_prefix = min_prefix.saturating_add(max_suffix);
        if u64::from(first) >= min_prefix && u64::from(first) <= max_prefix {
            l = test_l;
            break;
        }
    }
    if l == 0 {
        return None;
    }
    if data.len() < 1 + l as usize {
        return None;
    }

    let shift_8_minus_l = 8 - l;
    let prefix_base: u64 = 256u64.saturating_sub(1 << shift_8_minus_l);
    let high_bits = (u64::from(first).saturating_sub(prefix_base)) << (8 * l);

    let mut low_bits: u64 = 0;
    for (i, &b) in data[1..1 + l as usize].iter().enumerate() {
        low_bits |= u64::from(b) << (i * 8);
    }
    let value = high_bits | low_bits;
    Some(DecodingResult::new(value, 1 + l))
}

/// Encode natural number (variable-length). Zero = [0x00]; large = [0xFF, 8 bytes LE]; else prefix + suffix.
#[must_use]
pub fn encode_natural(value: u64) -> Vec<u8> {
    if value == 0 {
        return vec![0];
    }
    if value >= 1 << 56 {
        let mut out = vec![0xff; 9];
        for (i, b) in out[1..9].iter_mut().enumerate() {
            *b = (value >> (i * 8)) as u8;
        }
        return out;
    }
    if (1..=127).contains(&value) {
        return vec![value as u8];
    }

    let mut l = 1i32;
    while l <= 8 && value >= (1 << (7 * (l + 1))) {
        l += 1;
    }
    let prefix_base = (1 << 8) - (1 << (8 - l));
    let high_bits = value >> (8 * l);
    let prefix = prefix_base + high_bits;
    let suffix = value & ((1 << (8 * l)) - 1);

    let mut result = vec![0u8; 1 + l as usize];
    result[0] = prefix as u8;
    for (i, b) in result[1..].iter_mut().enumerate() {
        *b = (suffix >> (i * 8)) as u8;
    }
    result
}

fn read_le(data: &[u8], offset: usize, bytes: usize) -> Option<u32> {
    if offset + bytes > data.len() {
        return None;
    }
    let mut value: u32 = 0;
    for (i, &b) in data[offset..offset + bytes].iter().enumerate() {
        value |= u32::from(b) << (i * 8);
    }
    Some(value)
}

fn concat_bytes(slices: &[&[u8]]) -> Vec<u8> {
    let total = slices.iter().map(|s| s.len()).sum();
    let mut out = Vec::with_capacity(total);
    for s in slices {
        out.extend_from_slice(s);
    }
    out
}

// ============================================================================
// Blob codec (deblob format)
// ============================================================================

/// Decode PVM program blob (Gray Paper deblob).
/// Format: encode(len(j)) ⊕ encode[1](z) ⊕ encode(len(c)) ⊕ encode[z](j) ⊕ encode(c) ⊕ encode(k).
#[must_use]
pub fn decode_blob(program_blob: &[u8]) -> Option<DecodedBlob> {
    let mut offset: i32 = 0;

    let jump_table_length_result = decode_natural(program_blob.get(offset as usize..)?)?;
    let jump_table_length = jump_table_length_result.value as i32;
    offset += jump_table_length_result.consumed;

    if offset as usize >= program_blob.len() {
        return None;
    }
    let element_size = i32::from(program_blob[offset as usize]);
    offset += 1;

    let code_length_result = decode_natural(program_blob.get(offset as usize..)?)?;
    let code_length = code_length_result.value as i32;
    offset += code_length_result.consumed;

    let header_size = offset;

    let jump_table_size = jump_table_length * element_size;
    if offset as usize + jump_table_size as usize > program_blob.len() {
        return None;
    }

    let mut jump_table = Vec::with_capacity(jump_table_length as usize);
    for i in 0..jump_table_length {
        let start = (offset + i * element_size) as usize;
        let end = start + element_size as usize;
        let element_bytes = program_blob.get(start..end)?;
        let mut value: u32 = 0;
        for (j, &b) in element_bytes.iter().enumerate() {
            value |= u32::from(b) << (j * 8);
        }
        jump_table.push(value);
    }
    offset += jump_table_size;

    if offset as usize + code_length as usize > program_blob.len() {
        return None;
    }
    let code = program_blob[offset as usize..offset as usize + code_length as usize].to_vec();
    offset += code_length;

    let remaining = program_blob.len() - offset as usize;
    let mut bitmask = vec![0u8; code_length as usize];
    let mut bit_index: i32 = 0;
    let mut byte_index: usize = 0;

    while bit_index < code_length && byte_index < remaining {
        let packed_byte = *program_blob.get(offset as usize + byte_index)?;
        for i in 0..8 {
            if bit_index >= code_length {
                break;
            }
            bitmask[bit_index as usize] = ((u32::from(packed_byte) >> i) & 1) as u8;
            bit_index += 1;
        }
        byte_index += 1;
    }

    if bit_index < code_length {
        return None;
    }

    Some(DecodedBlob {
        code,
        bitmask,
        jump_table,
        element_size,
        header_size,
    })
}

/// Encode DecodedBlob back to program blob (inverse of decode_blob).
#[must_use]
pub fn encode_blob(decoded: &DecodedBlob) -> Vec<u8> {
    let code_len = decoded.code.len() as u64;
    let jump_len = decoded.jump_table.len() as u64;

    let len_j = encode_natural(jump_len);
    let z = [decoded.element_size as u8];
    let len_c = encode_natural(code_len);

    let mut jump_bytes = Vec::with_capacity(decoded.jump_table.len() * decoded.element_size as usize);
    for &v in &decoded.jump_table {
        for i in 0..decoded.element_size {
            jump_bytes.push((v >> (i * 8)) as u8);
        }
    }

    let code_len_usize = decoded.code.len();
    let bitmask_packed_len = (code_len_usize + 7) / 8;
    let mut k = vec![0u8; bitmask_packed_len];
    for (bit_index, &bit) in decoded.bitmask.iter().take(code_len_usize).enumerate() {
        if bit != 0 {
            k[bit_index / 8] |= 1 << (bit_index % 8);
        }
    }
    let k_len = encode_natural(k.len() as u64);

    concat_bytes(&[
        &len_j,
        &z,
        &len_c,
        &jump_bytes,
        &decoded.code,
        &k_len,
        &k,
    ])
}

// ============================================================================
// Service code from preimage
// ============================================================================

/// Decode service code from preimage: encode(len(m)) || encode(m) || code_blob.
#[must_use]
pub fn decode_service_code_from_preimage(preimage_blob: &[u8]) -> Option<DecodingResult<ServiceCodeResult>> {
    let metadata_length_result = decode_natural(preimage_blob)?;
    let meta_len_bytes = metadata_length_result.value as usize;
    let meta_start = metadata_length_result.consumed as usize;
    let meta_end = meta_start + meta_len_bytes;
    if meta_end > preimage_blob.len() {
        return None;
    }
    let metadata = preimage_blob[meta_start..meta_end].to_vec();
    let code_blob = preimage_blob[meta_end..].to_vec();
    Some(DecodingResult::new(
        ServiceCodeResult {
            metadata,
            code_blob,
        },
        preimage_blob.len() as i32,
    ))
}

// ============================================================================
// Program (Y function format)
// ============================================================================

/// Decode program: E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c.
#[must_use]
pub fn decode_program(program_blob: &[u8]) -> Option<DecodedProgram> {
    let mut offset = 0usize;

    let ro_data_length = read_le(program_blob, offset, 3)?;
    offset += 3;
    let rw_data_length = read_le(program_blob, offset, 3)?;
    offset += 3;
    let heap_zero_padding_size = read_le(program_blob, offset, 2)?;
    offset += 2;
    let stack_size = read_le(program_blob, offset, 3)?;
    offset += 3;

    if offset + ro_data_length as usize > program_blob.len() {
        return None;
    }
    let ro_data = program_blob[offset..offset + ro_data_length as usize].to_vec();
    offset += ro_data_length as usize;

    if offset + rw_data_length as usize > program_blob.len() {
        return None;
    }
    let rw_data = program_blob[offset..offset + rw_data_length as usize].to_vec();
    offset += rw_data_length as usize;

    let code_size = read_le(program_blob, offset, 4)?;
    offset += 4;

    if offset + code_size as usize > program_blob.len() {
        return None;
    }
    let code = program_blob[offset..offset + code_size as usize].to_vec();

    Some(DecodedProgram {
        metadata: vec![],
        ro_data_length,
        rw_data_length,
        heap_zero_padding_size,
        stack_size,
        ro_data,
        rw_data,
        code_size,
        code,
    })
}

/// Decode program from preimage: first decode service code, then decode code blob as Y format.
#[must_use]
pub fn decode_program_from_preimage(preimage_blob: &[u8]) -> Option<DecodedProgram> {
    let preimage_result = decode_service_code_from_preimage(preimage_blob)?;
    let program = decode_program(&preimage_result.value.code_blob)?;
    Some(DecodedProgram {
        metadata: preimage_result.value.metadata,
        ro_data_length: program.ro_data_length,
        rw_data_length: program.rw_data_length,
        heap_zero_padding_size: program.heap_zero_padding_size,
        stack_size: program.stack_size,
        ro_data: program.ro_data,
        rw_data: program.rw_data,
        code_size: program.code_size,
        code: program.code,
    })
}

// ============================================================================
// Fixed-length and variable-length
// ============================================================================

/// Decode fixed-length little-endian value (1–8 bytes).
#[must_use]
pub fn decode_fixed_length(data: &[u8], length: i32) -> Option<DecodingResult<u64>> {
    let len = length as usize;
    if data.len() < len {
        return None;
    }
    let mut value: u64 = 0;
    for (i, &b) in data[..len].iter().enumerate() {
        value |= u64::from(b) << (i * 8);
    }
    Some(DecodingResult::new(value, length))
}

/// Encode value as little-endian fixed length (1–8 bytes). Values wrap modulo 2^(8*length).
#[must_use]
pub fn encode_fixed_length(value: u64, length: i32) -> Vec<u8> {
    if length <= 0 {
        return vec![];
    }
    let wrapped = match length {
        1 => value % 256,
        2 => value % 65536,
        4 => value % 4_294_967_296,
        8 => value,
        _ => {
            let bits = (length as u32) * 8;
            if bits >= 64 {
                value
            } else {
                value % (1 << bits)
            }
        }
    };
    let bytes = length.min(8) as usize;
    let mut result = vec![0u8; length as usize];
    for (i, b) in result[..bytes].iter_mut().enumerate() {
        *b = (wrapped >> (i * 8)) as u8;
    }
    result
}

/// Decode variable-length term: encode(len) || data.
#[must_use]
pub fn decode_variable_length(data: &[u8]) -> Option<DecodingResult<Vec<u8>>> {
    let length_result = decode_natural(data)?;
    let length = length_result.value as usize;
    let offset = length_result.consumed as usize;
    if data.len() < offset + length {
        return None;
    }
    let value = data[offset..offset + length].to_vec();
    Some(DecodingResult::new(value, (offset + length) as i32))
}

// ============================================================================
// Accumulate args
// ============================================================================

/// Decode accumulate args: timeslot, serviceId, inputLength (each natural).
#[must_use]
pub fn decode_accumulate_args(args: &[u8]) -> Option<DecodingResult<DecodedAccumulateArgs>> {
    let mut offset: i32 = 0;

    let timeslot_result = decode_natural(args.get(offset as usize..)?)?;
    let timeslot = timeslot_result.value;
    offset += timeslot_result.consumed;

    if offset as usize >= args.len() {
        return None;
    }
    let service_id_result = decode_natural(args.get(offset as usize..)?)?;
    let service_id = service_id_result.value;
    offset += service_id_result.consumed;

    if offset as usize >= args.len() {
        return None;
    }
    let input_length_result = decode_natural(args.get(offset as usize..)?)?;
    let input_length = input_length_result.value;
    offset += input_length_result.consumed;

    Some(DecodingResult::new(
        DecodedAccumulateArgs {
            timeslot,
            service_id,
            input_length,
        },
        offset,
    ))
}

// ============================================================================
// Variable sequence (element decoder = variable-length bytes for generic use)
// ============================================================================

/// Decode variable-length sequence: encode(len) || element_0 || element_1 || ...
/// Element decoder: decode one element and return (value, consumed).
pub fn decode_variable_sequence<F, T>(data: &[u8], mut element_decoder: F) -> Option<DecodingResult<Vec<T>>>
where
    F: FnMut(&[u8]) -> Option<DecodingResult<T>>,
{
    let length_result = decode_natural(data)?;
    let length = length_result.value as i32;
    let mut current = &data[length_result.consumed as usize..];
    let mut result = Vec::with_capacity(length as usize);
    let start_len = data.len();

    for _ in 0..length {
        let element_result = element_decoder(current)?;
        result.push(element_result.value);
        current = current.get(element_result.consumed as usize..)?;
    }

    let consumed = start_len - current.len();
    Some(DecodingResult::new(result, consumed as i32))
}

/// Encode variable-length sequence of byte slices: encode(len) || encode(elem0) || ...
/// Each element encoded as var{bytes} = encode(len) || bytes.
#[must_use]
pub fn encode_variable_sequence(elements: &[Vec<u8>]) -> Vec<u8> {
    let len_enc = encode_natural(elements.len() as u64);
    let mut out = len_enc;
    for el in elements {
        out.extend_from_slice(&encode_natural(el.len() as u64));
        out.extend_from_slice(el);
    }
    out
}

// ============================================================================
// CompleteServiceAccount decode/encode (Gray Paper; rawCshKeyvals-first order)
// ============================================================================

/// Decode CompleteServiceAccount. Order: rawCshKeyvals (var), octets[8], items[4], gratis[8], codehash[32], balance[8], minaccgas[8], minmemogas[8], created[4], lastacc[4], parent[4].
#[must_use]
pub fn decode_complete_service_account(data: &[u8]) -> Option<DecodingResult<CompleteServiceAccount>> {
    let keyval_result = decode_variable_length(data)?;
    let mut keyval_data = keyval_result.value.as_slice();
    let offset = keyval_result.consumed as usize;

    let mut raw_csh_keyvals = Vec::new();
    while keyval_data.len() >= 1 {
        let key_result = decode_variable_length(keyval_data)?;
        keyval_data = keyval_data.get(key_result.consumed as usize..)?;
        let key = key_result.value;

        let value_result = decode_variable_length(keyval_data)?;
        keyval_data = keyval_data.get(value_result.consumed as usize..)?;
        raw_csh_keyvals.push((key, value_result.value));
    }

    let rest = data.get(offset..)?;
    if rest.len() < 8 + 4 + 8 + 32 + 8 + 8 + 8 + 4 + 4 + 4 {
        return None;
    }
    let mut i = 0;
    let octets = u64::from_le_bytes(rest[i..i + 8].try_into().ok()?);
    i += 8;
    let items = u32::from_le_bytes(rest[i..i + 4].try_into().ok()?);
    i += 4;
    let gratis = u64::from_le_bytes(rest[i..i + 8].try_into().ok()?);
    i += 8;
    let mut codehash = [0u8; 32];
    codehash.copy_from_slice(rest.get(i..i + 32)?);
    i += 32;
    let balance = u64::from_le_bytes(rest[i..i + 8].try_into().ok()?);
    i += 8;
    let minaccgas = u64::from_le_bytes(rest[i..i + 8].try_into().ok()?);
    i += 8;
    let minmemogas = u64::from_le_bytes(rest[i..i + 8].try_into().ok()?);
    i += 8;
    let created = u32::from_le_bytes(rest[i..i + 4].try_into().ok()?);
    i += 4;
    let lastacc = u32::from_le_bytes(rest[i..i + 4].try_into().ok()?);
    i += 4;
    let parent = u32::from_le_bytes(rest[i..i + 4].try_into().ok()?);
    i += 4;

    let consumed = offset + i;
    Some(DecodingResult::new(
        CompleteServiceAccount {
            codehash,
            balance,
            minaccgas,
            minmemogas,
            octets,
            gratis,
            items,
            created,
            lastacc,
            parent,
            raw_csh_keyvals,
        },
        consumed as i32,
    ))
}

/// Encode CompleteServiceAccount (same order as decode).
#[must_use]
pub fn encode_complete_service_account(account: &CompleteServiceAccount) -> Vec<u8> {
    let mut pairs: Vec<u8> = Vec::new();
    for (k, v) in &account.raw_csh_keyvals {
        pairs.extend_from_slice(&encode_natural(k.len() as u64));
        pairs.extend_from_slice(k);
        pairs.extend_from_slice(&encode_natural(v.len() as u64));
        pairs.extend_from_slice(v);
    }
    let mut out = encode_natural(pairs.len() as u64);
    out.extend_from_slice(&pairs);
    out.extend_from_slice(&account.octets.to_le_bytes());
    out.extend_from_slice(&account.items.to_le_bytes());
    out.extend_from_slice(&account.gratis.to_le_bytes());
    out.extend_from_slice(&account.codehash);
    out.extend_from_slice(&account.balance.to_le_bytes());
    out.extend_from_slice(&account.minaccgas.to_le_bytes());
    out.extend_from_slice(&account.minmemogas.to_le_bytes());
    out.extend_from_slice(&account.created.to_le_bytes());
    out.extend_from_slice(&account.lastacc.to_le_bytes());
    out.extend_from_slice(&account.parent.to_le_bytes());
    out
}

// ============================================================================
// DeferredTransfer and ProvisionEntry decode/encode
// ============================================================================

const MEMO_SIZE: usize = 128;

/// Decode single deferred transfer (Gray Paper Eq 271-277).
#[must_use]
pub fn decode_deferred_transfer(data: &[u8]) -> Option<DecodingResult<DeferredTransfer>> {
    if data.len() < 4 + 4 + 8 + MEMO_SIZE + 8 {
        return None;
    }
    let source = u32::from_le_bytes(data[0..4].try_into().ok()?);
    let dest = u32::from_le_bytes(data[4..8].try_into().ok()?);
    let amount = u64::from_le_bytes(data[8..16].try_into().ok()?);
    let memo = data[16..16 + MEMO_SIZE].to_vec();
    let gas_limit = u64::from_le_bytes(data[16 + MEMO_SIZE..16 + MEMO_SIZE + 8].try_into().ok()?);
    let consumed = 4 + 4 + 8 + MEMO_SIZE + 8;
    Some(DecodingResult::new(
        DeferredTransfer {
            source,
            dest,
            amount,
            memo,
            gas_limit,
        },
        consumed as i32,
    ))
}

/// Encode deferred transfer.
#[must_use]
pub fn encode_deferred_transfer(transfer: &DeferredTransfer) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + 4 + 8 + MEMO_SIZE + 8);
    out.extend_from_slice(&transfer.source.to_le_bytes());
    out.extend_from_slice(&transfer.dest.to_le_bytes());
    out.extend_from_slice(&transfer.amount.to_le_bytes());
    let mut memo = [0u8; MEMO_SIZE];
    let copy_len = transfer.memo.len().min(MEMO_SIZE);
    memo[..copy_len].copy_from_slice(&transfer.memo[..copy_len]);
    out.extend_from_slice(&memo);
    out.extend_from_slice(&transfer.gas_limit.to_le_bytes());
    out
}

/// Decode provision entry: service_id[4] then var{blob}.
#[must_use]
pub fn decode_provision_entry(data: &[u8]) -> Option<DecodingResult<ProvisionEntry>> {
    if data.len() < 4 {
        return None;
    }
    let service_id = u32::from_le_bytes(data[0..4].try_into().ok()?);
    let blob_result = decode_variable_length(data.get(4..)?)?;
    let consumed = 4 + blob_result.consumed as usize;
    Some(DecodingResult::new(
        ProvisionEntry {
            service_id,
            blob: blob_result.value,
        },
        consumed as i32,
    ))
}

/// Encode provision entry.
#[must_use]
pub fn encode_provision_entry(entry: &ProvisionEntry) -> Vec<u8> {
    let mut out = entry.service_id.to_le_bytes().to_vec();
    out.extend_from_slice(&encode_natural(entry.blob.len() as u64));
    out.extend_from_slice(&entry.blob);
    out
}

// ============================================================================
// Implications / PartialState types and decode/encode
// ============================================================================

/// Provision entry (serviceId, blob).
#[derive(Clone, Debug, Default)]
pub struct ProvisionEntry {
    pub service_id: u32,
    pub blob: Vec<u8>,
}

/// Always-accers entry (serviceId, gas). Gray Paper BLESS; gas encoded as 4 bytes.
#[derive(Clone, Debug, Default)]
pub struct AlwaysAccerEntry {
    pub service_id: u32,
    pub gas: u64,
}

/// Gray Paper Equation 271-277: source, dest, amount, memo (128), gas_limit.
#[derive(Clone, Debug, Default)]
pub struct DeferredTransfer {
    pub source: u32,
    pub dest: u32,
    pub amount: u64,
    pub memo: Vec<u8>,
    pub gas_limit: u64,
}

/// Gray Paper partialstate: accounts, stagingset, authqueue, manager, assigners, delegator, registrar, alwaysaccers.
#[derive(Clone, Debug, Default)]
pub struct PartialState {
    pub accounts: Vec<AccountEntry>,
    pub stagingset: Vec<Vec<u8>>,
    pub authqueue: Vec<Vec<Vec<u8>>>,
    pub manager: u32,
    pub assigners: Vec<u32>,
    pub delegator: u32,
    pub registrar: u32,
    pub alwaysaccers: Vec<AlwaysAccerEntry>,
}

/// Account entry (serviceId + CompleteServiceAccount).
#[derive(Clone, Debug, Default)]
pub struct AccountEntry {
    pub service_id: u32,
    pub account: CompleteServiceAccount,
}

/// CompleteServiceAccount (Gray Paper; matches AS codec).
#[derive(Clone, Debug, Default)]
pub struct CompleteServiceAccount {
    pub codehash: [u8; 32],
    pub balance: u64,
    pub minaccgas: u64,
    pub minmemogas: u64,
    pub octets: u64,
    pub gratis: u64,
    pub items: u32,
    pub created: u32,
    pub lastacc: u32,
    pub parent: u32,
    pub raw_csh_keyvals: Vec<(Vec<u8>, Vec<u8>)>,
}

/// Implications (regular or exceptional dimension).
#[derive(Clone, Debug, Default)]
pub struct Implications {
    pub id: u32,
    pub state: PartialState,
    pub nextfreeid: u32,
    pub xfers: Vec<DeferredTransfer>,
    pub yield_hash: Option<Vec<u8>>,
    pub provisions: Vec<ProvisionEntry>,
}

/// ImplicationsPair (regular × exceptional).
#[derive(Clone, Debug, Default)]
pub struct ImplicationsPair {
    pub regular: Implications,
    pub exceptional: Implications,
}

const VALIDATOR_KEY_SIZE: usize = 336;
const AUTH_QUEUE_SIZE: usize = 80;
const HASH_SIZE: usize = 32;

/// Decode PartialState (Gray Paper partialstate).
#[must_use]
pub fn decode_partial_state(
    data: &[u8],
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Option<DecodingResult<PartialState>> {
    let num_cores = num_cores.max(0) as usize;
    let num_validators = num_validators.max(0) as usize;
    let auth_queue_size = auth_queue_size.max(0) as usize;

    let accounts_var = decode_variable_length(data)?;
    let mut accounts_data = accounts_var.value.as_slice();
    let mut offset = accounts_var.consumed as usize;

    let mut accounts = Vec::new();
    while accounts_data.len() >= 4 {
        let sid = u32::from_le_bytes(accounts_data[0..4].try_into().ok()?);
        accounts_data = accounts_data.get(4..)?;
        let acc_result = decode_complete_service_account(accounts_data)?;
        accounts_data = accounts_data.get(acc_result.consumed as usize..)?;
        accounts.push(AccountEntry {
            service_id: sid,
            account: acc_result.value,
        });
    }
    // offset already = accounts_var.consumed (natural + payload)

    let rest = data.get(offset..)?;
    let stagingset_size = num_validators * VALIDATOR_KEY_SIZE;
    if rest.len() < stagingset_size {
        return None;
    }
    let mut stagingset = Vec::with_capacity(num_validators);
    for i in 0..num_validators {
        stagingset.push(rest[i * VALIDATOR_KEY_SIZE..(i + 1) * VALIDATOR_KEY_SIZE].to_vec());
    }
    offset += stagingset_size;

    let rest = data.get(offset..)?;
    let core_queue_size = auth_queue_size * HASH_SIZE;
    let authqueue_size = num_cores * core_queue_size;
    if rest.len() < authqueue_size {
        return None;
    }
    let mut authqueue = Vec::with_capacity(num_cores);
    for c in 0..num_cores {
        let mut queue = Vec::with_capacity(auth_queue_size);
        for a in 0..auth_queue_size {
            queue.push(rest[c * core_queue_size + a * HASH_SIZE..c * core_queue_size + (a + 1) * HASH_SIZE].to_vec());
        }
        authqueue.push(queue);
    }
    offset += authqueue_size;

    let rest = data.get(offset..)?;
    if rest.len() < 4 + num_cores * 4 + 4 + 4 {
        return None;
    }
    let manager = u32::from_le_bytes(rest[0..4].try_into().ok()?);
    let mut assigners = Vec::with_capacity(num_cores);
    for i in 0..num_cores {
        assigners.push(u32::from_le_bytes(rest[4 + i * 4..8 + i * 4].try_into().ok()?));
    }
    let delegator = u32::from_le_bytes(rest[4 + num_cores * 4..8 + num_cores * 4].try_into().ok()?);
    let registrar = u32::from_le_bytes(rest[8 + num_cores * 4..12 + num_cores * 4].try_into().ok()?);
    offset += 4 + num_cores * 4 + 4 + 4;

    let rest = data.get(offset..)?;
    let always_var = decode_variable_length(rest)?;
    let mut always_data = always_var.value.as_slice();
    let mut alwaysaccers = Vec::new();
    while always_data.len() >= 8 {
        let sid = u32::from_le_bytes(always_data[0..4].try_into().ok()?);
        let gas = u32::from_le_bytes(always_data[4..8].try_into().ok()?);
        alwaysaccers.push(AlwaysAccerEntry {
            service_id: sid,
            gas: u64::from(gas),
        });
        always_data = always_data.get(8..)?;
    }
    offset += always_var.consumed as usize;

    Some(DecodingResult::new(
        PartialState {
            accounts,
            stagingset,
            authqueue,
            manager,
            assigners,
            delegator,
            registrar,
            alwaysaccers,
        },
        offset as i32,
    ))
}

/// Encode PartialState.
#[must_use]
pub fn encode_partial_state(
    state: &PartialState,
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Vec<u8> {
    let num_cores = num_cores.max(0) as usize;
    let num_validators = num_validators.max(0) as usize;
    let auth_queue_size = auth_queue_size.max(0) as usize;

    let mut account_pairs = Vec::new();
    for e in &state.accounts {
        account_pairs.extend_from_slice(&e.service_id.to_le_bytes());
        account_pairs.extend_from_slice(&encode_complete_service_account(&e.account));
    }
    let mut out = encode_natural(account_pairs.len() as u64);
    out.extend_from_slice(&account_pairs);

    for i in 0..num_validators {
        if i < state.stagingset.len() && state.stagingset[i].len() == VALIDATOR_KEY_SIZE {
            out.extend_from_slice(&state.stagingset[i]);
        } else {
            out.extend_from_slice(&[0u8; VALIDATOR_KEY_SIZE]);
        }
    }

    for c in 0..num_cores {
        if c < state.authqueue.len() {
            for a in 0..auth_queue_size {
                if a < state.authqueue[c].len() && state.authqueue[c][a].len() == HASH_SIZE {
                    out.extend_from_slice(&state.authqueue[c][a]);
                } else {
                    out.extend_from_slice(&[0u8; HASH_SIZE]);
                }
            }
        } else {
            for _ in 0..auth_queue_size {
                out.extend_from_slice(&[0u8; HASH_SIZE]);
            }
        }
    }

    out.extend_from_slice(&state.manager.to_le_bytes());
    for i in 0..num_cores {
        let v = state.assigners.get(i).copied().unwrap_or(0);
        out.extend_from_slice(&v.to_le_bytes());
    }
    out.extend_from_slice(&state.delegator.to_le_bytes());
    out.extend_from_slice(&state.registrar.to_le_bytes());

    let mut always_pairs = Vec::new();
    for e in &state.alwaysaccers {
        always_pairs.extend_from_slice(&e.service_id.to_le_bytes());
        always_pairs.extend_from_slice(&(e.gas as u32).to_le_bytes());
    }
    out.extend_from_slice(&encode_natural(always_pairs.len() as u64));
    out.extend_from_slice(&always_pairs);

    out
}

/// Decode Implications (Gray Paper).
#[must_use]
pub fn decode_implications(
    data: &[u8],
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Option<DecodingResult<Implications>> {
    if data.len() < 4 {
        return None;
    }
    let id = u32::from_le_bytes(data[0..4].try_into().ok()?);
    let state_result = decode_partial_state(data.get(4..)?, num_cores, num_validators, auth_queue_size)?;
    let mut offset = 4 + state_result.consumed as usize;
    let rest = data.get(offset..)?;
    if rest.len() < 4 {
        return None;
    }
    let nextfreeid = u32::from_le_bytes(rest[0..4].try_into().ok()?);
    offset += 4;

    let xfers_result = decode_variable_sequence(data.get(offset..)?, |d| decode_deferred_transfer(d))?;
    offset += xfers_result.consumed as usize;

    let rest = data.get(offset..)?;
    if rest.is_empty() {
        return None;
    }
    let (yield_hash, consumed_yield) = if rest[0] == 0 {
        (None, 1)
    } else if rest[0] == 1 && rest.len() >= 33 {
        (Some(rest[1..33].to_vec()), 33)
    } else {
        return None;
    };
    offset += consumed_yield;

    let provisions_result = decode_variable_sequence(data.get(offset..)?, |d| decode_provision_entry(d))?;
    offset += provisions_result.consumed as usize;

    Some(DecodingResult::new(
        Implications {
            id,
            state: state_result.value,
            nextfreeid,
            xfers: xfers_result.value,
            yield_hash,
            provisions: provisions_result.value,
        },
        offset as i32,
    ))
}

/// Encode Implications.
#[must_use]
pub fn encode_implications(
    implications: &Implications,
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Vec<u8> {
    let mut out = implications.id.to_le_bytes().to_vec();
    out.extend_from_slice(&encode_partial_state(&implications.state, num_cores, num_validators, auth_queue_size));
    out.extend_from_slice(&implications.nextfreeid.to_le_bytes());
    let xfers_enc: Vec<Vec<u8>> = implications.xfers.iter().map(encode_deferred_transfer).collect();
    out.extend_from_slice(&encode_variable_sequence(&xfers_enc));
    if let Some(ref h) = implications.yield_hash {
        out.push(1);
        out.extend_from_slice(h);
    } else {
        out.push(0);
    }
    let prov_enc: Vec<Vec<u8>> = implications.provisions.iter().map(encode_provision_entry).collect();
    out.extend_from_slice(&encode_variable_sequence(&prov_enc));
    out
}

/// Decode ImplicationsPair. Full implementation.
#[must_use]
pub fn decode_implications_pair(
    data: &[u8],
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Option<DecodingResult<ImplicationsPair>> {
    let regular_result = decode_implications(data, num_cores, num_validators, auth_queue_size)?;
    let regular_consumed = regular_result.consumed as usize;
    let exceptional_result = decode_implications(
        data.get(regular_consumed..)?,
        num_cores,
        num_validators,
        auth_queue_size,
    )?;
    let total_consumed = regular_consumed + exceptional_result.consumed as usize;
    Some(DecodingResult::new(
        ImplicationsPair {
            regular: regular_result.value,
            exceptional: exceptional_result.value,
        },
        total_consumed as i32,
    ))
}

/// Encode ImplicationsPair. Full implementation.
#[must_use]
pub fn encode_implications_pair(
    pair: &ImplicationsPair,
    num_cores: i32,
    num_validators: i32,
    auth_queue_size: i32,
) -> Vec<u8> {
    let mut out = encode_implications(&pair.regular, num_cores, num_validators, auth_queue_size);
    out.extend_from_slice(&encode_implications(
        &pair.exceptional,
        num_cores,
        num_validators,
        auth_queue_size,
    ));
    out
}

// ============================================================================
// CSH key helpers (Gray Paper C(s,h); matches AS createStorageKey/createPreimageKey)
// ============================================================================

const STORAGE_PREFIX: [u8; 4] = [0xff, 0xff, 0xff, 0xff]; // encode[4]{2^32-1}
const PREIMAGE_PREFIX: [u8; 4] = [0xfe, 0xff, 0xff, 0xff]; // encode[4]{2^32-2}

/// Build 31-byte C(s,h) key: interleave encode[4](service_id) with first 27 bytes of blake2b(combined).
fn create_csh_key(service_id: u32, combined: &[u8]) -> [u8; 31] {
    let hash = blake2b256(combined);
    let blake27 = &hash[..27];
    let sid = service_id.to_le_bytes();
    let mut key = [0u8; 31];
    key[0] = sid[0];
    key[1] = blake27[0];
    key[2] = sid[1];
    key[3] = blake27[1];
    key[4] = sid[2];
    key[5] = blake27[2];
    key[6] = sid[3];
    key[7] = blake27[3];
    key[8..31].copy_from_slice(&blake27[4..27]);
    key
}

/// Create storage state key: C(s, blake(encode[4]{0xFFFFFFFF} || k)).
#[must_use]
pub fn create_storage_key(service_id: u32, storage_key: &[u8]) -> [u8; 31] {
    let mut combined = Vec::with_capacity(4 + storage_key.len());
    combined.extend_from_slice(&STORAGE_PREFIX);
    combined.extend_from_slice(storage_key);
    create_csh_key(service_id, &combined)
}

/// Create preimage state key: C(s, blake(encode[4]{0xFFFFFFFE} || h)).
#[must_use]
pub fn create_preimage_key(service_id: u32, preimage_hash: &[u8]) -> [u8; 31] {
    let mut combined = Vec::with_capacity(4 + preimage_hash.len());
    combined.extend_from_slice(&PREIMAGE_PREFIX);
    combined.extend_from_slice(preimage_hash);
    create_csh_key(service_id, &combined)
}

fn raw_get(keyvals: &[(Vec<u8>, Vec<u8>)], key: &[u8]) -> Option<Vec<u8>> {
    keyvals
        .iter()
        .find(|(k, _)| k.len() == key.len() && k.as_slice() == key)
        .map(|(_, v)| v.clone())
}

fn raw_set(keyvals: &mut Vec<(Vec<u8>, Vec<u8>)>, key: &[u8], value: Vec<u8>) {
    for (k, v) in keyvals.iter_mut() {
        if k.len() == key.len() && k.as_slice() == key {
            *v = value;
            return;
        }
    }
    keyvals.push((key.to_vec(), value));
}

fn raw_delete(keyvals: &mut Vec<(Vec<u8>, Vec<u8>)>, key: &[u8]) -> bool {
    if let Some(pos) = keyvals.iter().position(|(k, _)| k.len() == key.len() && k.as_slice() == key) {
        keyvals.remove(pos);
        true
    } else {
        false
    }
}

/// Get storage value from account by key (Gray Paper rawCshKeyvals + createStorageKey).
#[must_use]
pub fn get_storage_value(account: &CompleteServiceAccount, service_id: u32, storage_key: &[u8]) -> Option<Vec<u8>> {
    let key = create_storage_key(service_id, storage_key);
    raw_get(&account.raw_csh_keyvals, &key)
}

/// Set storage value in account.
pub fn set_storage_value(account: &mut CompleteServiceAccount, service_id: u32, storage_key: &[u8], value: Vec<u8>) {
    let key = create_storage_key(service_id, storage_key);
    raw_set(&mut account.raw_csh_keyvals, &key, value);
}

/// Delete storage value; returns true if key existed.
pub fn delete_storage_value(account: &mut CompleteServiceAccount, service_id: u32, storage_key: &[u8]) -> bool {
    let key = create_storage_key(service_id, storage_key);
    raw_delete(&mut account.raw_csh_keyvals, &key)
}

/// Create request state key: C(s, blake(encode[4]{length} || h)).
#[must_use]
pub fn create_request_key(service_id: u32, request_hash: &[u8], length: u64) -> [u8; 31] {
    let mut combined = Vec::with_capacity(4 + request_hash.len());
    combined.extend_from_slice(&length.to_le_bytes()[..4]);
    combined.extend_from_slice(request_hash);
    create_csh_key(service_id, &combined)
}

/// Get request value (encoded timeslots) from account.
#[must_use]
pub fn get_request_value(
    account: &CompleteServiceAccount,
    service_id: u32,
    request_hash: &[u8],
    length: u64,
) -> Option<Vec<u8>> {
    let key = create_request_key(service_id, request_hash, length);
    raw_get(&account.raw_csh_keyvals, &key)
}

/// Set request value (encoded timeslots) in account.
pub fn set_request_value(
    account: &mut CompleteServiceAccount,
    service_id: u32,
    request_hash: &[u8],
    length: u64,
    value: Vec<u8>,
) {
    let key = create_request_key(service_id, request_hash, length);
    raw_set(&mut account.raw_csh_keyvals, &key, value);
}

/// Delete request value from raw_csh_keyvals (Gray Paper FORGET).
#[must_use]
pub fn delete_request_value(
    account: &mut CompleteServiceAccount,
    service_id: u32,
    request_hash: &[u8],
    length: u64,
) -> bool {
    let key = create_request_key(service_id, request_hash, length);
    raw_delete(&mut account.raw_csh_keyvals, &key)
}

/// Delete preimage value from raw_csh_keyvals (Gray Paper FORGET).
#[must_use]
pub fn delete_preimage_value(
    account: &mut CompleteServiceAccount,
    service_id: u32,
    preimage_hash: &[u8],
) -> bool {
    let key = create_preimage_key(service_id, preimage_hash);
    raw_delete(&mut account.raw_csh_keyvals, &key)
}

/// Encode request timeslots to value format. Gray Paper: encode{var{sequence{encode[4]{x} | x ∈ t}}}.
#[must_use]
pub fn encode_request_timeslots(timeslots: &[u32]) -> Vec<u8> {
    let elements: Vec<Vec<u8>> = timeslots
        .iter()
        .map(|&t| encode_fixed_length(t as u64, 4))
        .collect();
    encode_variable_sequence(&elements)
}

/// Decode request timeslots: variable sequence of encode[4](u32).
#[must_use]
pub fn decode_request_timeslots(value: &[u8]) -> Option<Vec<u32>> {
    let result = decode_variable_sequence(value, |data| {
        decode_fixed_length(data, 4).map(|r| DecodingResult::new(r.value as u32, r.consumed))
    })?;
    Some(result.value)
}

/// Get preimage value by hash (Gray Paper rawCshKeyvals + createPreimageKey).
#[must_use]
pub fn get_preimage_value(account: &CompleteServiceAccount, service_id: u32, preimage_hash: &[u8]) -> Option<Vec<u8>> {
    let key = create_preimage_key(service_id, preimage_hash);
    raw_get(&account.raw_csh_keyvals, &key)
}
