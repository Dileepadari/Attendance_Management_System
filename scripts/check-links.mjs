#!/usr/bin/env node
/**
 * Verify every local href and src in the HTML pages resolves to a file on disk.
 *
 *   npm run check:links
 *
 * A static site has no build step, so a renamed stylesheet or a moved script fails
 * silently in the browser. This is the closest thing to a compile error available.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

const ATTR = /(?:href|src)\s*=\s*"([^"]+)"/g;
let broken = 0;
let checked = 0;

for (const page of pages) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const [, target] of html.matchAll(ATTR)) {
    // External, protocol-relative, anchors and data URIs are not ours to verify.
    if (/^(https?:)?\/\//.test(target) || target.startsWith('#') || target.startsWith('data:')) continue;
    const clean = target.split(/[?#]/)[0];
    if (!clean) continue;
    checked += 1;
    if (!fs.existsSync(path.join(ROOT, clean))) {
      broken += 1;
      console.error(`${page}: ${target}`);
    }
  }
}

console.log(`${checked - broken}/${checked} local references resolve across ${pages.length} pages`);
process.exit(broken ? 1 : 0);
