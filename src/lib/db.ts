import { Pool, PoolConfig } from "pg";

// Log connection string presence (not the actual value for security)
if (!process.env.CONNECTION_STRING) {
  console.error(
    "DATABASE ERROR: CONNECTION_STRING environment variable is not set"
  );
}

/**
 * Parse a PostgreSQL connection string that may contain a Cloud SQL Unix socket path.
 * The `pg` library has issues parsing URLs with `?host=/cloudsql/...` format,
 * so we manually extract the components.
 */
function parseConnectionString(connectionString: string): PoolConfig {
  // Format: postgresql://user:pass@localhost:5432/dbname?host=/cloudsql/project:region:instance
  const url = new URL(connectionString);

  const config: PoolConfig = {
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1), // Remove leading slash
    port: parseInt(url.port || "5432", 10),
  };

  // Check for Cloud SQL Unix socket in query params
  const hostParam = url.searchParams.get("host");
  if (hostParam && hostParam.startsWith("/cloudsql/")) {
    // Use Unix socket for Cloud SQL Proxy
    config.host = hostParam;
  } else {
    // Use TCP connection
    config.host = url.hostname;
  }

  return config;
}

// Create pool only if connection string is available to avoid cryptic parsing errors
let pool: Pool | null = null;

if (process.env.CONNECTION_STRING) {
  try {
    const config = parseConnectionString(process.env.CONNECTION_STRING);
    pool = new Pool(config);
  } catch (error) {
    console.error(
      "DATABASE ERROR: Failed to parse CONNECTION_STRING:",
      error instanceof Error ? error.message : error
    );
  }
}

// Handle pool errors to prevent unhandled promise rejections
pool?.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export async function query(
  text: string,
  params?: (string | number | boolean | null | Date | Buffer)[]
) {
  if (!pool) {
    throw new Error(
      "Database connection not available: CONNECTION_STRING environment variable is not set"
    );
  }

  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error("Database query error:", {
      query: text,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

export default pool;
