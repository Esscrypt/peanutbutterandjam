import { createCoreDb } from '@pbnj/state'
import { DATABASE_URL } from './config'

export const db = createCoreDb(DATABASE_URL)
