#!/usr/bin/env node
'use strict';
/*
 * Cross-platform test runner shim.
 * Spawns `node --test` with cwd at the repo root so process.cwd() resolves
 * correctly regardless of which directory npm test is invoked from.
 */
const { spawnSync } = require('child_process');
const { readdirSync } = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const tests = readdirSync(path.join(repoRoot, 'test'))
    .filter(f => f.endsWith('.test.js'))
    .map(f => path.join(repoRoot, 'test', f));

const result = spawnSync(process.execPath, ['--test', ...tests], {
    cwd: repoRoot,
    stdio: 'inherit',
});
process.exit(result.status ?? 1);
