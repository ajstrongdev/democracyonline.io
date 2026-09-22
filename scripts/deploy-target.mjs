#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const commandMode = args[0] === 'down' || args[0] === 'restart' ? args[0] : 'up';
const envName =
    args[0] === 'down' || args[0] === 'restart'
        ? args[1] ?? 'prod'
        : args[0] ?? 'prod';
const normalized = envName === 'prod' || envName === 'production' ? 'prod' : 'dev';
const envFile = normalized === 'prod' ? '.env.prod' : '.env.dev';
const composeFiles = ['-f', 'docker-compose.yml'];

if (normalized === 'prod') {
    composeFiles.push('-f', 'docker-compose.prod.yml');
} else {
    composeFiles.push('-f', 'docker-compose.dev.yml');
}

if (!existsSync(envFile)) {
    console.error(`Missing ${envFile}. Create it before deploying.`);
    process.exit(1);
}

const command = 'docker';
const commandArgs = ['compose', '--env-file', envFile, ...composeFiles];

if (commandMode === 'down') {
    commandArgs.push('down');
} else if (commandMode === 'restart') {
    commandArgs.push('up', '-d', '--build', '--force-recreate');
} else {
    commandArgs.push('up', '-d', '--build');
}

console.log(`Deploying ${normalized} environment: ${command} ${commandArgs.join(' ')}`);
const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: false });
if (result.error) {
    console.error(result.error);
    process.exit(1);
}
process.exit(result.status ?? 0);
