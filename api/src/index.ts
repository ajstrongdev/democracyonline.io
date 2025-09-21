import Fastify from 'fastify'
import postgres from '@fastify/postgres'
import cors from '@fastify/cors'

const fastify = Fastify({
  logger: true
})

fastify.register(cors, {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://localhost:3000', 'https://127.0.0.1:3000'],
  credentials: true
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

fastify.post('/create-user', async (request, reply) => {
  const { email, username } = request.body as { email: string; username: string }
  const client = await fastify.pg.connect()
  try {
    const result = await client.query(
      'INSERT INTO users (email, username) VALUES ($1, $2) RETURNING *',
      [email, username]
    )
    reply.send(result.rows[0])
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to create user' })
  } finally {
    client.release()
  }
});

const start = async () => {
  try {
    await fastify.listen({ 
      port: process.env.PORT ? parseInt(process.env.PORT) : 4000,
      host: '0.0.0.0'
    })
    // await seed();
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()