#!/usr/bin/env node
// Verifies required tooling is installed. Exits non-zero if a hard requirement is missing.
const { spawnSync } = require('node:child_process');

const MIN_NODE_MAJOR = 20;
let failed = false;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  return r.status === 0 ? (r.stdout || '').trim().split('\n')[0] : null;
}

function check(label, ok, detail, required = true) {
  const mark = ok ? 'ok  ' : required ? 'FAIL' : 'warn';
  console.log(`[${mark}] ${label}${detail ? ` - ${detail}` : ''}`);
  if (!ok && required) failed = true;
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
check('node', nodeMajor >= MIN_NODE_MAJOR, `v${process.versions.node} (need >= ${MIN_NODE_MAJOR})`);

const npm = run('npm', ['--version']);
check('npm', !!npm, npm ? `v${npm}` : 'not found');

const docker = run('docker', ['--version']);
check('docker', !!docker, docker || 'not found (needed for MongoDB, Minecraft and `make docker-up`)', false);

if (docker) {
  const compose = run('docker', ['compose', 'version']);
  check('docker compose', !!compose, compose || 'plugin not found', false);
}

process.exit(failed ? 1 : 0);
