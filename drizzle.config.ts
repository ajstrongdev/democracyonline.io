```ts
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

const envFile = process.env.COMPOSE_ENV_FILE ?? ".env";

loadEnvFile(envFile);

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```
