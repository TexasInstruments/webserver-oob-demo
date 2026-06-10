#!/usr/bin/env node
/*
 * generate-inc.js — Generate webserver-oob-npm.inc for Yocto (Wrynose format)
 *
 * Reads common/webserver/package-lock.json and outputs a BitBake .inc file
 * with individual npm tarball SRC_URI entries (https:// URLs), sha256sum
 * checksums, and NPM_PACKAGE_MAP.
 *
 * Output format matches benchmark-server.inc:
 *   https://registry.npmjs.org/<pkg>/-/<pkg>-<ver>.tgz;unpack=0;name=npm-<name>-<ver>
 *   SRC_URI[npm-<name>-<ver>.sha256sum] = "<sha256>"
 *   NPM_PACKAGE_MAP = "node_modules/<path>=<tarball> ..."
 *
 * IMPORTANT: Run 'cd common/webserver && npm install' FIRST to populate npm cache.
 *
 * Usage (from repo root):
 *   cd common/webserver && npm install && cd ../..
 *   node tools/generate-inc.js > yocto/webserver-oob-npm.inc
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const os     = require('os');

// Resolve paths relative to repo root (one level up from tools/)
const repoRoot = path.resolve(__dirname, '..');
const lockPath = path.join(repoRoot, 'common/webserver/package-lock.json');

if (!fs.existsSync(lockPath)) {
    process.stderr.write('ERROR: package-lock.json not found at ' + lockPath + '\n');
    process.stderr.write('Run:  cd common/webserver && npm install\n');
    process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const deps = lock.packages || {};

// npm content-addressable cache base (npm v7+)
const npmCacheBase = path.join(os.homedir(), '.npm', '_cacache', 'content-v2', 'sha512');

/**
 * Given an npm integrity string "sha512-<base64>", find the cached tarball
 * and return its SHA-256 hex checksum. Returns null if not in cache.
 *
 * npm stores tarballs at:
 *   ~/.npm/_cacache/content-v2/sha512/<hex[0:2]>/<hex[2:4]>/<hex[4:]>
 * where hex = Buffer.from(base64, 'base64').toString('hex')
 */
function sha256FromCache(integrity) {
    const m = integrity && integrity.match(/^sha512-(.+)$/);
    if (!m) return null;

    let sha512hex;
    try {
        sha512hex = Buffer.from(m[1], 'base64').toString('hex');
    } catch (e) {
        return null;
    }

    const cachePath = path.join(npmCacheBase,
        sha512hex.slice(0, 2),
        sha512hex.slice(2, 4),
        sha512hex.slice(4));

    if (!fs.existsSync(cachePath)) return null;

    const data = fs.readFileSync(cachePath);
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Convert a tarball basename like "ipaddr.js-1.9.1" to a Yocto name key like
 * "npm-ipaddr-js-1-9-1". Replace runs of non-alphanumeric chars with single
 * dash, strip leading/trailing dashes, prepend "npm-".
 */
function toNameKey(tarballBasename) {
    return 'npm-' + tarballBasename
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Collect data for output
const tarballsSeen  = new Set();   // dedup: tarball filename → true
const srcUriEntries = [];          // { nameKey, url }  — one per unique tarball
const sha256Entries = [];          // { nameKey, sha256 } — one per unique tarball
const mapEntries    = [];          // { installPath, tarball } — all install paths

let cacheErrors = 0;

for (const [pkgPath, info] of Object.entries(deps)) {
    if (!pkgPath) continue;        // skip root ""
    if (info.dev) continue;        // skip devDependencies

    const resolved  = info.resolved  || '';
    const integrity = info.integrity || '';

    if (!resolved.startsWith('https://registry.npmjs.org/')) continue;

    const tarball  = resolved.split('/').pop();      // e.g. accepts-1.3.8.tgz
    const basename = tarball.replace(/\.tgz$/, ''); // e.g. accepts-1.3.8
    const nameKey  = toNameKey(basename);            // e.g. npm-accepts-1-3-8

    // NPM_PACKAGE_MAP: one entry per install path (including nested)
    mapEntries.push({ installPath: pkgPath, tarball });

    // SRC_URI + sha256sum: deduplicate by tarball filename
    if (!tarballsSeen.has(tarball)) {
        tarballsSeen.add(tarball);

        const sha256 = sha256FromCache(integrity);
        if (!sha256) {
            process.stderr.write(`WARNING: ${tarball} not in npm cache\n`);
            process.stderr.write(`         integrity: ${integrity.slice(0, 50)}...\n`);
            cacheErrors++;
        }

        srcUriEntries.push({ nameKey, url: resolved });
        sha256Entries.push({ nameKey, sha256: sha256 || 'FIXME_RUN_npm_install_FIRST' });
    }
}

// Sort by nameKey for deterministic, human-readable output
srcUriEntries.sort((a, b) => a.nameKey.localeCompare(b.nameKey));
sha256Entries.sort((a, b) => a.nameKey.localeCompare(b.nameKey));
mapEntries.sort((a, b) => a.installPath.localeCompare(b.installPath));

if (cacheErrors > 0) {
    process.stderr.write(`\n${cacheErrors} package(s) missing from npm cache.\n`);
    process.stderr.write('Fix: cd common/webserver && npm install && cd ../.. && node tools/generate-inc.js > yocto/webserver-oob-npm.inc\n\n');
}

// --- Emit output ---

const out = [];
out.push('# Auto-generated by tools/generate-inc.js — DO NOT EDIT BY HAND');
out.push('# Regenerate: cd common/webserver && npm install && cd ../.. && node tools/generate-inc.js > yocto/webserver-oob-npm.inc');
out.push('');

// NPM_SRC_URI block
out.push('NPM_SRC_URI = " \\');
for (const { nameKey, url } of srcUriEntries) {
    out.push(`    ${url};unpack=0;name=${nameKey} \\`);
}
out.push('"');
out.push('');

// sha256sum lines (one per unique tarball)
for (const { nameKey, sha256 } of sha256Entries) {
    out.push(`SRC_URI[${nameKey}.sha256sum] = "${sha256}"`);
}
out.push('');

// NPM_PACKAGE_MAP block
out.push('# Maps each node_modules install path to its tarball filename.');
out.push(`# ${mapEntries.length} install paths, ${tarballsSeen.size} unique tarballs.`);
out.push('NPM_PACKAGE_MAP = " \\');
for (let i = 0; i < mapEntries.length; i++) {
    const { installPath, tarball } = mapEntries[i];
    const cont = i < mapEntries.length - 1 ? ' \\' : '"';
    out.push(`    ${installPath}=${tarball}${cont}`);
}
out.push('');

process.stdout.write(out.join('\n'));
