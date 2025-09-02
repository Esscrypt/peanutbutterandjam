import { createCoreDb } from '.'
import * as schema from './schema/core-schema'

const main = async () => {
  const DATABASE_URL = process.env['DATABASE_URL']
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const db = createCoreDb(DATABASE_URL)

  try {
    console.log('Seeding database')
    // Delete all data
    await db.delete(schema.apiKeys)

    // Insert Minimum Data
    await db.insert(schema.apiKeys).values([
      {
        // API Key: Ih4bf6HlGlyfcGKvplQzVJjXgm6qnlv7HgA8lGQhmKo
        hashedApiKey: 'nFXnuLikYwTULxG17hpc/yCKu6B/vw6Unkz44Xe+5HU=',
        note: 'Key 1',
      },
      {
        // API Key: vx8VhXU1ftfHLiDpxpQ5hDEet9UFgxDyTgS_uX8NqkY
        hashedApiKey: 'KzT82ivB44dp5bY3uIN6FHDvun+LVVZc9yG86P6tg74=',
        note: 'Key 2',
      },
      {
        // API Key: umzG8eL4IJjTTb3PorJ8nwIHoaT8jYbtNjwE9
        hashedApiKey: 'whLNp7RlG0RWUIF+n9aMWdAp96si2CrqdqgPcOqNJjk=',
        note: 'Key 3',
      },
    ])
  } catch (error) {
    console.error('Failed to seed database', error)
    throw new Error('Failed to seed database')
  }
}

main().then(() => {
  console.log('Seeding successful')
  return process.exit(0)
})
