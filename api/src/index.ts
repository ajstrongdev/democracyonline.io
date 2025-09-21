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

    `)

    const { rows } = await client.query('')
    if (parseInt(rows[0].count, 10) === 0) {
      await client.query(`

      `)
      fastify.log.info('Seed data inserted into users table')
    }
  } finally {
    client.release()
  }
}

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