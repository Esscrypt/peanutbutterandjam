import { hexToBytesp@p@p@p@p@pbnj/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/corej/core'
import { readFileSyncsfsfsfsfsfs
import { ConfigService } from '../infra/node/services/config-service'
import { decodeActivityvityvityv../packages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state.activitykages/serialization/src/state/activity'

const block1 = JSON.parse(
  readFileSync(
    'submodules/jam-test-vectors/traces/preimages/00000001.json',
    'utf-8',
  ),
)

// Find activity in post_state
const activityKeyval = block1.post_state?.keyvals?.find((kv: any) =>
  kv.key.startsWith('0x0d00'),
)

if (activityKeyval) {
  console.log('Found activity in block 1 post_state')
  console.log('Key:', activityKeyval.key)
  console.log('Value length:', activityKeyval.value.length / 2, 'bytes')

  // Decode the activity
  const configService = new ConfigService('tiny')
  const activityBytes = hexToBytes(activityKeyval.value)
  const [error, result] = decodeActivity(activityBytes, configService)

  if (error) {
    console.error('Error decoding activity:', error.message)
  } else {
    console.log('\nDecoded Activity:')
    console.log(
      '  ValidatorStatsAccumulator count:',
      result.value.validatorStatsAccumulator.length,
    )
    console.log(
      '  ValidatorStatsPrevious count:',
      result.value.validatorStatsPrevious.length,
    )
    console.log('  CoreStats count:', result.value.coreStats.length)
    console.log('  ServiceStats count:', result.value.serviceStats.size)
    console.log(
      '  ServiceStats IDs:',
      Array.from(result.value.serviceStats.keys()).map((id) => id.toString()),
    )

    if (result.value.serviceStats.size > 0) {
      console.log('\nServiceStats entries:')
      for (const [serviceId, stats] of result.value.serviceStats) {
        console.log(`  Service ID ${serviceId}:`, JSON.stringify(stats, null, 2))
      }
    } else {
      console.log('\n  No serviceStats in post_state activity')
    }
  }
} else {
  console.log('No activity found in block 1 post_state')
}

