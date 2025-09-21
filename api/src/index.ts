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

async function resetDatabase() {
  const client = await fastify.pg.connect()
  try {
    await client.query(`
      DO $$
      DECLARE
        drop_stmt text;
      BEGIN
        SELECT
          string_agg('DROP TABLE IF EXISTS "' || tablename || '" CASCADE;', ' ')
        INTO drop_stmt
        FROM pg_tables
        WHERE schemaname = 'public';

        IF drop_stmt IS NOT NULL THEN
          EXECUTE drop_stmt;
        END IF;
      END $$;
    `);
    await seed();
  } finally {
    client.release()
  }
}

async function seed() {
  const client = await fastify.pg.connect()
  try {
    await listTables(client, "Tables before seeding");

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

fastify.get('/reset-database', async (_, reply) => {
  try {
    await resetDatabase()
    reply.send({ message: 'Database reset and seeded successfully' })
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to reset and seed database' })
  }
})

fastify.post('/get-username', async (request, reply) => {
  try {
    const client = await fastify.pg.connect()

    let id = "";

    const idQuery = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [(request.body as { email: string }).email]
    )

    if (idQuery.rows.length > 0) {
      id = idQuery.rows[0].username;
    }

    reply.send({ id })
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to seed database' })
  }
})

fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  const client = await fastify.pg.connect()

  console.log("id", id)
  
  try {
    const result = await client.query(`
      SELECT 
        u.id,
        u.username,
        u.role,
        u.created_at,
        json_build_object(
          'id', p.id,
          'leader', leader.username,
          'party_name', p.party_name,
          'party_color', p.party_color,
          'bio', p.bio,
          'manifesto_url', p.manifesto_url,
          'created_at', p.created_at
        ) AS party
      FROM users u
      LEFT JOIN parties p ON u.party_id = p.id
      LEFT JOIN users leader ON p.leader_id = leader.id
      WHERE u.id = $1
    `, [id])

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