/**
 * Script to determine the type of a C(s, h) key using StateService.determineKeyType
 */

import * as path from 'node:path'
import { bytesToHex, EventBusService, hexToBytes } from '@pbnjam/core'
import { AccumulationService } from '../infra/node/services/accumulation-service'
import { AuthPoolService } from '../infra/node/services/auth-pool-service'
import { AuthQueueService } from '../infra/node/services/auth-queue-service'
import { ClockService } from '../infra/node/services/clock-service'
import { ConfigService } from '../infra/node/services/config-service'
import { DisputesService } from '../infra/node/services/disputes-service'
import { EntropyService } from '../infra/node/services/entropy'
import { NodeGenesisManager } from '../infra/node/services/genesis-manager'
import { PrivilegesService } from '../infra/node/services/privileges-service'
import { ReadyService } from '../infra/node/services/ready-service'
import { RecentHistoryService } from '../infra/node/services/recent-history-service'
import { SealKeyService } from '../infra/node/services/seal-key'
import { ServiceAccountService } from '../infra/node/services/service-account-service'
import { StateService } from '../infra/node/services/state-service'
import { StatisticsService } from '../infra/node/services/statistics-service'
import { TicketService } from '../infra/node/services/ticket-service'
import { ValidatorSetManager } from '../infra/node/services/validator-set'
import { WorkReportService } from '../infra/node/services/work-report-service'

const key = '0x0001007100a000ab5cbd7e82c9744baf137918fe8d08741476a397e9dc2884'
const value =
  '0xef5752d8d31a91a8b233c11eea45a42cd581a6fb1ccb48d67a422b2c5cff6db6'

async function main() {
  const configService = new ConfigService('tiny')
  const eventBusService = new EventBusService()
  const clockService = new ClockService({
    configService,
    eventBusService,
  })
  const entropyService = new EntropyService(eventBusService)

  // Minimal setup for StateService
  const genesisManager = new NodeGenesisManager(configService, {
    genesisJsonPath: path.join(
      __dirname,
      '../submodules/jam-test-vectors/traces/preimages_light/genesis.json',
    ),
  })

  const validatorSetManager = new ValidatorSetManager({
    eventBusService,
    sealKeyService: null as any,
    ringProver: null as any,
    ticketService: null as any,
    configService,
    initialValidators: [],
  })

  const ticketService = new TicketService({
    configService,
    eventBusService,
    keyPairService: null,
    entropyService,
    networkingService: null,
    ce131TicketDistributionProtocol: null,
    ce132TicketDistributionProtocol: null,
    clockService,
    prover: null as any,
    ringVerifier: null as any,
    validatorSetManager: null,
  })

  const sealKeyService = new SealKeyService({
    configService,
    eventBusService,
    entropyService,
    ticketService,
  })

  const authQueueService = new AuthQueueService({ configService })
  const disputesService = new DisputesService({
    eventBusService,
    configService,
    validatorSetManagerService: validatorSetManager,
  })
  const readyService = new ReadyService({ configService })
  const workReportService = new WorkReportService({
    eventBus: eventBusService,
    networkingService: null,
    ce136WorkReportRequestProtocol: null,
    validatorSetManager,
    configService,
    entropyService,
    clockService,
  })
  const authPoolService = new AuthPoolService({
    configService,
    eventBusService,
    workReportService,
    authQueueService,
  })
  const privilegesService = new PrivilegesService({ configService })
  const serviceAccountsService = new ServiceAccountService({
    configService,
    eventBusService,
    clockService,
    networkingService: null,
    preimageRequestProtocol: null,
  })
  const statisticsService = new StatisticsService({
    eventBusService,
    configService,
    clockService,
  })
  const accumulationService = new AccumulationService({
    configService,
    clockService,
    serviceAccountsService,
    privilegesService,
    validatorSetManager,
    authQueueService,
    accumulatePVM: null as any,
    readyService,
    statisticsService,
  })
  const recentHistoryService = new RecentHistoryService({
    eventBusService,
    configService,
    accumulationService,
  })

  const stateService = new StateService({
    configService,
    genesisManagerService: genesisManager,
    validatorSetManager,
    entropyService,
    ticketService,
    authQueueService,
    authPoolService,
    statisticsService,
    disputesService,
    readyService,
    accumulationService,
    workReportService,
    privilegesService,
    serviceAccountsService,
    recentHistoryService,
    sealKeyService,
    clockService,
  })

  // Parse the key to extract service ID and Blake hash
  const [parseError, parsedKey] = stateService.parseStateKey(key)
  if (parseError || !('serviceId' in parsedKey)) {
    console.error('Failed to parse key:', parseError?.message)
    process.exit(1)
  }

  console.log('Key:', key)
  console.log('Value:', value)
  console.log('Service ID:', parsedKey.serviceId.toString())
  console.log('Blake hash from key:', parsedKey.hash)
  console.log('')

  // Determine key type
  const valueBytes = hexToBytes(value)
  try {
    const result = stateService.determineKeyType(valueBytes, parsedKey.hash)
    console.log('✅ Key type determined:', result.keyType)
    if (result.keyType === 'storage') {
      console.log('  Storage key hash:', result.key)
      console.log('  Value length:', result.value.length, 'bytes')
    } else if (result.keyType === 'preimage') {
      console.log('  Preimage hash:', result.preimageHash)
      console.log('  Blob length:', result.blob.length, 'bytes')
    } else if (result.keyType === 'request') {
      console.log(
        '  Timeslots:',
        result.timeslots.map((t) => t.toString()),
      )
    }
  } catch (error) {
    console.error(
      '❌ Failed to determine key type:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

main().catch(console.error)
