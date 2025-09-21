import Fastify from 'fastify'
import postgres from '@fastify/postgres'
import type { PoolClient } from 'pg'
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

async function listTables(client: PoolClient, label: string): Promise<void> {
  const res = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `)

  fastify.log.info(`${label}:`)
  res.rows.forEach((r: { table_name: string }) => fastify.log.info(`  - ${r.table_name}`))
}

async function seed() {
  const client = await fastify.pg.connect()
  try {
    await listTables(client, "Tables before seeding");
    await client.query(`
      CREATE TABLE IF NOT EXISTS parties (
        id SERIAL PRIMARY KEY,
        leader_id INT,
        name VARCHAR(255) UNIQUE NOT NULL,
        color VARCHAR(7) NOT NULL,
        bio TEXT,
        manifesto_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'Representative',
        party_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_party
          FOREIGN KEY (party_id)
          REFERENCES parties(id)
          ON DELETE SET NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        standing_for VARCHAR(255) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS presidential_election (
        id SERIAL PRIMARY KEY,
        voter_id INTEGER REFERENCES users(id),
        candidate_id INTEGER REFERENCES users(id),
        points_won INTEGER NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS senate_election (
        id SERIAL PRIMARY KEY,
        voter_id INTEGER REFERENCES users(id),
        candidate_id INTEGER REFERENCES users(id),
        points_won INTEGER NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        stage VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        creator_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bill_approval (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id),
        voter_id INTEGER REFERENCES users(id),
        vote_yes BOOLEAN NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bill_house_votes (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id),
        voter_id INTEGER REFERENCES users(id),
        vote_yes BOOLEAN NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bill_senate_votes (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id),
        voter_id INTEGER REFERENCES users(id),
        vote_yes BOOLEAN NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bill_veto (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id),
        voter_id INTEGER REFERENCES users(id)
      );
    `);

    await listTables(client, "Tables after seeding")

    // Add foreign key constraint from parties.leader_id to users.id if not exists
    try {
      await client.query(`
        ALTER TABLE parties
        ADD CONSTRAINT fk_party_leader
        FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;
      `)
    } catch (error: any) {
      // Ignore error if constraint already exists
      if (error.code !== '42P07') {
        throw error
      }
    }
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

fastify.get('/users/:email', async (request, reply) => {
  const { email } = request.params as { email: string }
  const client = await fastify.pg.connect()
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email])
    if (result.rows.length === 0) {
      reply.status(404).send({ error: 'User not found' })
    } else {
      reply.send(result.rows[0])
    }
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to fetch user' })
  } finally {
    client.release()
  }
});

fastify.get('/parties', async (_, reply) => {
  const client = await fastify.pg.connect()
  try {
    const result = await client.query('SELECT * FROM parties')
    reply.send(result.rows)
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to fetch parties' })
  } finally {
    client.release()
  }
});

fastify.get('/parties/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const client = await fastify.pg.connect()
  try {
    const result = await client.query('SELECT * FROM parties WHERE id = $1', [id])
    if (result.rows.length === 0) {
      reply.status(404).send({ error: 'Party not found' })
    } else {
      reply.send(result.rows[0])
    }
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to fetch party' })
  } finally {
    client.release()
  }
});

fastify.get('/parties/:id/members', async (request, reply) => {
  const { id } = request.params as { id: string }
  const client = await fastify.pg.connect()
  try {
    const result = await client.query('SELECT * FROM users WHERE party_id = $1', [id])
    reply.send(result.rows)
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to fetch party members' })
  } finally {
    client.release()
  }
});

fastify.post('/parties/check-membership', async (request, reply) => {
  const { userId, partyId } = request.body as { userId: number, partyId: number }
  const client = await fastify.pg.connect()
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1 AND party_id = $2',
      [userId, partyId]
    )
    reply.send(result.rows.length > 0)
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to check membership' })
  } finally {
    client.release()
  }
});

fastify.post('/parties/leave', async (request, reply) => {
  const { userId } = request.body as { userId: number }
  const client = await fastify.pg.connect()
  try {
    const userResult = await client.query(
      'SELECT party_id FROM users WHERE id = $1',
      [userId]
    )
    
    if (userResult.rows.length === 0) {
      reply.status(404).send({ error: 'User not found' })
      return
    }

    const partyId = userResult.rows[0].party_id

      // Remove leadership if leader
      if (partyId) {
        await client.query(
          'UPDATE parties SET leader_id = NULL WHERE id = $1 AND leader_id = $2',
          [partyId, userId]
        )
      }
      const result = await client.query(
        'UPDATE users SET party_id = NULL WHERE id = $1 RETURNING *',
        [userId]
      )

    reply.send(result.rows[0])
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to leave party' })
  } finally {
    client.release()
  }
});

fastify.post('/parties/join', async (request, reply) => {
  const { userId, partyId } = request.body as { userId: number, partyId: number}
  const client = await fastify.pg.connect()
  try {
    const result = await client.query(
      'UPDATE users SET party_id = $1 WHERE id = $2 RETURNING *',
      [partyId, userId]
    )
    if (result.rows.length === 0) {
      reply.status(404).send({ error: 'User not found' })
    } else {
      reply.send(result.rows[0])
    }
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to join party' })
  } finally {
    client.release()
  }
})

fastify.post('/parties/become-leader', async (request, reply) => {
  const { userId, partyId } = request.body as { userId: number, partyId: number }
  const client = await fastify.pg.connect()
  try {
    const membershipCheck = await client.query(
      'SELECT * FROM users WHERE id = $1 AND party_id = $2',
      [userId, partyId]
    )
    if (membershipCheck.rows.length === 0) {
      reply.status(403).send({ error: 'User must be a member of the party to become leader' })
      return
    }
    const result = await client.query(
      'UPDATE parties SET leader_id = $1 WHERE id = $2 RETURNING *',
      [userId, partyId]
    )
    if (result.rows.length === 0) {
      reply.status(404).send({ error: 'Party not found' })
    } else {
      reply.send(result.rows[0])
    }
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to become party leader' })
  } finally {
    client.release()
  }
})

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