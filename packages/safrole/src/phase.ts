import type { IConfigService } from '@pbnj/types'

/**
 * Calculate epoch and slot phase from slot number
 * Gray Paper Eq. 33-34: e remainder m = τ/Cepochlen
 */
export function calculateSlotPhase(
  slot: bigint,
  configManager: IConfigService,
): { epoch: bigint; phase: bigint } {
  const epoch = slot / BigInt(configManager.epochDuration)
  const phase = slot % BigInt(configManager.epochDuration)
  return { epoch, phase }
}
