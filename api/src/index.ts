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
    // Create parties table first (no dependencies)
    await client.query(`
      CREATE TABLE IF NOT EXISTS parties (
        id SERIAL PRIMARY KEY,
        leader_id INT,
        party_name VARCHAR(255) UNIQUE NOT NULL,
        party_color VARCHAR(7) NOT NULL,
        bio TEXT,
        manifesto_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create users table second (references parties)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'representative',
        party_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_party
          FOREIGN KEY (party_id)
          REFERENCES parties(id)
          ON DELETE SET NULL
      );
    `)

    // Add foreign key constraint from parties.leader_id to users.id
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_party_leader'
        ) THEN
          ALTER TABLE parties 
          ADD CONSTRAINT fk_party_leader 
          FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
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