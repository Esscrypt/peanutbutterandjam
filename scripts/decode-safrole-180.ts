import { readFileSync } from 'node:fs'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeSafrole } from '@pbnjam/codec'
import { ConfigService } from '../infra/node/services/config-service'

const configService = new ConfigService('tiny')
const block180 = JSON.parse(readFileSync('submodules/jam-test-vectors/traces/fuzzy/00000180.json', 'utf-8'))

// Find chapter 4 (safrole) in post_state
const safroleKeyval = block180.post_state.keyvals.find((kv: any) => kv.key.startsWith('0x04'))

if (safroleKeyval) {
  console.log('=== Block 180 Post-State Safrole ===')
  console.log(`Key: ${safroleKeyval.key}`)
  console.log(`Value length: ${(safroleKeyval.value.length - 2) / 2} bytes`)
  
  const data = hexToBytes(safroleKeyval.value)
  const [error, result] = decodeSafrole(data, configService)
  
  if (!error && result) {
    const safrole = result.value
    console.log('\nDecoded safrole:')
    console.log(`  pendingSet length: ${safrole.pendingSet?.length ?? 0}`)
    console.log(`  epochRoot: ${safrole.epochRoot}`)
    console.log(`  sealTickets length: ${safrole.sealTickets?.length ?? 0}`)
    console.log(`  ticketAccumulator length: ${safrole.ticketAccumulator?.length ?? 0}`)
    
    console.log('\n  First 3 seal tickets:')
    for (let i = 0; i < Math.min(3, safrole.sealTickets.length); i++) {
      const ticket = safrole.sealTickets[i]
      if (ticket instanceof Uint8Array) {
        console.log(`    [${i}]: Fallback key: ${bytesToHex(ticket)}`)
      } else if (ticket && 'id' in ticket) {
        console.log(`    [${i}]: Ticket(id=${ticket.id?.slice(0, 20)}..., entryIndex=${ticket.entryIndex})`)
      }
    }
  } else {
    console.log('Failed to decode:', error?.message)
  }
}
