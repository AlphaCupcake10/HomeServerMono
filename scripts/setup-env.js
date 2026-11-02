#!/usr/bin/env node
// Creates backend/.env from backend/.env.example (if missing) and fills in random secrets.
// If .env already exists it is never modified, except that variables introduced later in
// .env.example are appended (with generated secrets where applicable). Idempotent.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const backendDir = path.resolve(__dirname, '..', 'backend');
const envPath = path.join(backendDir, '.env');
const examplePath = path.join(backendDir, '.env.example');

const SECRET_KEYS = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'SUPER_ADMIN_PASSWORD', 'MINECRAFT_RCON_PASSWORD'];
const secret = () => crypto.randomBytes(32).toString('hex');
const keyOf = (line) => line.split('=')[0].trim();
const isAssignment = (line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line);
const fill = (line) => (SECRET_KEYS.includes(keyOf(line)) ? `${keyOf(line)}=${secret()}` : line);

const exampleLines = fs.readFileSync(examplePath, 'utf8').split(/\r?\n/);

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, exampleLines.map(fill).join('\n'), { mode: 0o600 });
  console.log('Created backend/.env with freshly generated secrets.');
  console.log('The super admin login is SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in backend/.env.');
  process.exit(0);
}

const existing = fs.readFileSync(envPath, 'utf8');
const present = new Set(existing.split(/\r?\n/).filter(isAssignment).map(keyOf));
const missing = exampleLines.filter((line) => isAssignment(line) && !present.has(keyOf(line)));

if (missing.length === 0) {
  console.log('backend/.env already exists and is complete - leaving it untouched.');
  process.exit(0);
}

const prefix = existing.endsWith('\n') ? '' : '\n';
fs.appendFileSync(envPath, `${prefix}\n# Added by setup-env\n${missing.map(fill).join('\n')}\n`);
console.log(`backend/.env: appended missing variables: ${missing.map(keyOf).join(', ')}`);
