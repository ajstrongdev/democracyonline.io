#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const target = args[0] ?? process.env.DEPLOYED_ENV ?? 'development';
const normalized =
    target === 'prod' || target === 'production' ? 'production' : 'development';
const envFile = '.env';

if (!existsSync(envFile)) {
    console.error(`Missing ${envFile}. Create it before seeding.`);
    process.exit(1);
}

const result = spawnSync(
    'node',
    ['--env-file', envFile, '--import', 'tsx', 'scripts/seed-fresh.ts'],
    {
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, DEPLOYED_ENV: normalized },
    },
);

if (result.error) {
    console.error(result.error);
    process.exit(1);
}
process.exit(result.status ?? 0);
