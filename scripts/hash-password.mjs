#!/usr/bin/env node
/**
 * Print the SHA-256 hash of a password, for pasting into USERS in assets/js/config.js.
 *
 *   node scripts/hash-password.mjs 'the new password'
 *
 * Quote the argument. An unquoted password containing a shell metacharacter will not
 * arrive intact, and you will end up hashing something other than what you typed.
 */
import { createHash } from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hash-password.mjs 'your password'");
  process.exit(1);
}

if (password.length < 8) {
  console.error('Refusing: use at least 8 characters. This hash ships in a public file.');
  process.exit(1);
}

console.log(createHash('sha256').update(password).digest('hex'));
