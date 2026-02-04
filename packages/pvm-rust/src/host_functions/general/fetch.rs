//! FETCH host function (Ω_Y). Gray Paper: function ID 1, gas cost 10.
//! Selector in registers[10]; output at registers[7]; from/length in 8,9.
//! Returns NONE (u64::MAX) when data not available; else writes to memory and sets r7 = len(v).
//! System constants (selector 0) use config (mirrors pvm-assemblyscript fetch.ts + config).

use crate::codec::encode_natural;
use crate::config::{
    C_ASSURANCE_TIMEOUT_PERIOD, C_AUTH_POOL_SIZE, C_AUTH_QUEUE_SIZE, C_BASE_DEPOSIT, C_BYTE_DEPOSIT,
    C_ITEM_DEPOSIT, C_MAX_BUNDLE_SIZE, C_MAX_PACKAGE_EXPORTS, C_MAX_PACKAGE_IMPORTS, C_MAX_PACKAGE_ITEMS,
    C_MAX_PACKAGE_XTS, C_MAX_REPORT_DEPS, C_MAX_REPORT_VAR_SIZE, C_MEMO_SIZE, C_RECENT_HISTORY_LEN,
    C_REPORT_ACC_GAS, FetchSystemConstantsConfig, FUNC_FETCH, MAX_AUTH_CODE_SIZE,
    MAX_SERVICE_CODE_SIZE, PACKAGE_AUTH_GAS, REG_NONE,
};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use std::cmp::min;

/// FETCH (1): selector-based fetch; selector 0 uses config (1:1 with AS getSystemConstants).
/// Base 10 gas deducted in state_wrapper before host dispatch.
pub struct FetchHostFunction {
    /// Optional runtime config for system constants (selector 0). Default used if None.
    pub config: Option<FetchSystemConstantsConfig>,
}

impl Default for FetchHostFunction {
    fn default() -> Self {
        Self { config: None }
    }
}

impl FetchHostFunction {
    fn effective_config(&self) -> FetchSystemConstantsConfig {
        self.config
            .clone()
            .unwrap_or_default()
    }
}

impl HostFunction for FetchHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_FETCH
    }
    fn name(&self) -> &'static str {
        "fetch"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        // Base 10 gas already deducted in state_wrapper before host dispatch.
        let selector = (context.registers[10] & 0xffff_ffff) as u32;
        let output_offset = context.registers[7];
        let from_offset = context.registers[8];
        let length = context.registers[9];

        let config = context
            .fetch_system_constants_config
            .cloned()
            .unwrap_or_else(|| self.effective_config());
        let fetched_data = Self::fetch_data(selector, &*context, config);
        if let Some(data) = fetched_data {
            let len_u32 = data.len() as u32;
            let clamped_from = min(from_offset, len_u32 as u64) as u32;
            let available = len_u32.saturating_sub(clamped_from);
            let actual_len = min(length, available as u64) as u32;
            if actual_len > 0 {
                let start = clamped_from as usize;
                let end = (clamped_from + actual_len) as usize;
                let slice: Vec<u8> = data[start..end].to_vec();
                let write_result = context.ram.write_octets(output_offset as u32, &slice);
                if write_result.has_fault {
                    // Output address (r7) not writable: no page or read-only. Gray Paper: host returns panic.
                    return HostFunctionResult::panic();
                }
            }
            context.registers[7] = u64::from(len_u32);
        } else {
            context.registers[7] = REG_NONE;
        }
        HostFunctionResult::continue_execution()
    }
}

impl FetchHostFunction {
    /// Gray Paper: fetch data by selector. Selectors 7-13 use pre-encoded work package data from context; 14,15 use fetch_accumulate_inputs.
    fn fetch_data(
        selector: u32,
        context: &HostFunctionContext<'_>,
        config: FetchSystemConstantsConfig,
    ) -> Option<Vec<u8>> {
        match selector {
            0 => Some(Self::get_system_constants(config)),
            1 => context
                .fetch_entropy_accumulator
                .map(|s| s.to_vec()),
            2 => context
                .fetch_authorizer_trace
                .map(|s| s.to_vec()),
            3 => {
                let export = context.fetch_export_segments?;
                let work_item_idx = context.registers[11] as usize;
                let extrinsic_idx = context.registers[12] as usize;
                if work_item_idx >= export.len() {
                    return None;
                }
                let segments = &export[work_item_idx];
                if extrinsic_idx >= segments.len() {
                    return None;
                }
                Some(segments[extrinsic_idx].clone())
            }
            4 => {
                let work_item_index = context.fetch_work_item_index?;
                if work_item_index == u64::MAX {
                    return None;
                }
                let export = context.fetch_export_segments?;
                let work_item_idx = work_item_index as usize;
                let segment_idx = context.registers[11] as usize;
                if work_item_idx >= export.len() {
                    return None;
                }
                let segments = &export[work_item_idx];
                if segment_idx >= segments.len() {
                    return None;
                }
                Some(segments[segment_idx].clone())
            }
            5 => {
                let import = context.fetch_import_segments?;
                let work_item_idx = context.registers[11] as usize;
                let import_idx = context.registers[12] as usize;
                if work_item_idx >= import.len() {
                    return None;
                }
                let segments = &import[work_item_idx];
                if import_idx >= segments.len() {
                    return None;
                }
                Some(segments[import_idx].clone())
            }
            6 => {
                let work_item_index = context.fetch_work_item_index?;
                if work_item_index == u64::MAX {
                    return None;
                }
                let import = context.fetch_import_segments?;
                let work_item_idx = work_item_index as usize;
                let segment_idx = context.registers[11] as usize;
                if work_item_idx >= import.len() {
                    return None;
                }
                let segments = &import[work_item_idx];
                if segment_idx >= segments.len() {
                    return None;
                }
                Some(segments[segment_idx].clone())
            }
            7 => context
                .fetch_work_package_encoded
                .map(|s| s.to_vec()),
            8 => context.fetch_auth_config.map(|s| s.to_vec()),
            9 => context.fetch_auth_token.map(|s| s.to_vec()),
            10 => context
                .fetch_refine_context_encoded
                .map(|s| s.to_vec()),
            11 => {
                let summaries = context.fetch_work_item_summaries?;
                let mut out = encode_natural(summaries.len() as u64);
                for item in summaries {
                    out.extend_from_slice(item);
                }
                Some(out)
            }
            12 => {
                let summaries = context.fetch_work_item_summaries?;
                let idx = context.registers[11] as usize;
                if idx >= summaries.len() {
                    return None;
                }
                Some(summaries[idx].clone())
            }
            13 => {
                let payloads = context.fetch_work_item_payloads?;
                let idx = context.registers[11] as usize;
                if idx >= payloads.len() {
                    return None;
                }
                Some(payloads[idx].clone())
            }
            14 => {
                let inputs = context.fetch_accumulate_inputs?;
                let mut out = encode_natural(inputs.len() as u64);
                for item in inputs {
                    out.extend_from_slice(item);
                }
                Some(out)
            }
            15 => {
                let inputs = context.fetch_accumulate_inputs?;
                let idx = context.registers[11] as usize;
                if idx >= inputs.len() {
                    return None;
                }
                Some(inputs[idx].clone())
            }
            _ => None,
        }
    }

    /// Gray Paper: system constants encoding (selector 0). Uses config (1:1 with AS getSystemConstants).
    fn get_system_constants(cfg: FetchSystemConstantsConfig) -> Vec<u8> {
        let mut buf = vec![0u8; 134];
        let mut offset = 0;
        fn put_u64(buf: &mut [u8], offset: &mut usize, v: u64) {
            for i in 0..8 {
                buf[*offset + i] = (v >> (i * 8)) as u8;
            }
            *offset += 8;
        }
        fn put_u32_le(buf: &mut [u8], offset: &mut usize, v: u32) {
            for i in 0..4 {
                buf[*offset + i] = (v >> (i * 8)) as u8;
            }
            *offset += 4;
        }
        fn put_u16_le(buf: &mut [u8], offset: &mut usize, v: u16) {
            buf[*offset] = v as u8;
            buf[*offset + 1] = (v >> 8) as u8;
            *offset += 2;
        }
        put_u64(&mut buf, &mut offset, C_ITEM_DEPOSIT);
        put_u64(&mut buf, &mut offset, C_BYTE_DEPOSIT);
        put_u64(&mut buf, &mut offset, C_BASE_DEPOSIT);
        put_u16_le(&mut buf, &mut offset, cfg.num_cores as u16);
        put_u32_le(&mut buf, &mut offset, cfg.preimage_expunge_period);
        put_u32_le(&mut buf, &mut offset, cfg.epoch_duration);
        put_u64(&mut buf, &mut offset, C_REPORT_ACC_GAS);
        put_u64(&mut buf, &mut offset, PACKAGE_AUTH_GAS as u64);
        put_u64(&mut buf, &mut offset, cfg.max_refine_gas);
        put_u64(&mut buf, &mut offset, cfg.max_block_gas);
        put_u16_le(&mut buf, &mut offset, C_RECENT_HISTORY_LEN as u16);
        put_u16_le(&mut buf, &mut offset, C_MAX_PACKAGE_ITEMS as u16);
        put_u16_le(&mut buf, &mut offset, C_MAX_REPORT_DEPS as u16);
        put_u16_le(&mut buf, &mut offset, cfg.max_tickets_per_extrinsic as u16);
        put_u32_le(&mut buf, &mut offset, cfg.max_lookup_anchorage);
        put_u16_le(&mut buf, &mut offset, cfg.tickets_per_validator as u16);
        put_u16_le(&mut buf, &mut offset, C_AUTH_POOL_SIZE as u16);
        put_u16_le(&mut buf, &mut offset, cfg.slot_duration as u16);
        put_u16_le(&mut buf, &mut offset, C_AUTH_QUEUE_SIZE as u16);
        put_u16_le(&mut buf, &mut offset, cfg.rotation_period as u16);
        put_u16_le(&mut buf, &mut offset, C_MAX_PACKAGE_XTS as u16);
        put_u16_le(&mut buf, &mut offset, C_ASSURANCE_TIMEOUT_PERIOD as u16);
        put_u16_le(&mut buf, &mut offset, cfg.num_validators as u16);
        put_u32_le(&mut buf, &mut offset, MAX_AUTH_CODE_SIZE);
        put_u32_le(&mut buf, &mut offset, C_MAX_BUNDLE_SIZE);
        put_u32_le(&mut buf, &mut offset, MAX_SERVICE_CODE_SIZE);
        put_u32_le(&mut buf, &mut offset, cfg.ec_piece_size);
        put_u32_le(&mut buf, &mut offset, C_MAX_PACKAGE_IMPORTS);
        put_u32_le(&mut buf, &mut offset, cfg.num_ec_pieces_per_segment);
        put_u32_le(&mut buf, &mut offset, C_MAX_REPORT_VAR_SIZE);
        put_u32_le(&mut buf, &mut offset, C_MEMO_SIZE);
        put_u32_le(&mut buf, &mut offset, C_MAX_PACKAGE_EXPORTS);
        put_u32_le(&mut buf, &mut offset, cfg.contest_duration);
        debug_assert!(offset <= 134, "system constants overflow");
        buf
    }
}
