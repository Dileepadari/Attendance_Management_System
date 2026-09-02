#!/usr/bin/env node
/**
 * Syntax check every tracked JavaScript file, without adding a linter this project does
 * not otherwise need. `node --check` reports the first parse error, which is what CI
 * needs to catch that the tests would not.
 *
 *   npm run lint
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const files = execFileSync('git', ['ls-files', '*.js', '*.mjs'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', path.resolve(file)], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`${file}\n${err.stderr.toString().trim()}\n`);
  }
}

console.log(`${files.length - failed}/${files.length} files parse`);
process.exit(failed ? 1 : 0);
