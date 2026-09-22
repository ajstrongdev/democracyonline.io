#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const target = args[0] || 'prod';
const normalized = target === 'prod' || target === 'production' ? 'prod' : 'dev';
const envFile = normalized === 'prod' ? '.env.prod' : '.env.dev';

if (!existsSync(envFile)) {
    console.error(`Missing ${envFile}. Create it before seeding.`);
    process.exit(1);
}

const result = spawnSync(
    'node',
    ['--env-file', envFile, '--import', 'tsx', 'scripts/seed-fresh.ts'],
    { stdio: 'inherit', shell: false },
);

if (result.error) {
    console.error(result.error);
    process.exit(1);
}
process.exit(result.status ?? 0);
