import Fastify from 'fastify'
import postgres from '@fastify/postgres'

const fastify = Fastify({
  logger: true
})

fastify.register(postgres, {
  connectionString: process.env.CONNECTION_STRING
})

async function seed() {
  const client = await fastify.pg.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
  } finally {
    client.release()
  }
}

fastify.get('/seed', async (_, reply) => {
  try {
    await seed()
    reply.send({ message: 'Database seeded successfully' })
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to seed database' })
  }
})

const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT ? parseInt(process.env.PORT) : 4000 })
    // await seed();
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()