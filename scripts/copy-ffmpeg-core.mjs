#!/usr/bin/env node
/**
 * Copy @ffmpeg/core dist files (esm + umd) to public/ffmpeg-core/
 * Runs as postinstall and postbuild via package.json scripts.
 * Handles pnpm symlink layout: walks node_modules/.pnpm/@ffmpeg+core*/
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEST = join(ROOT, 'public', 'ffmpeg-core');

// Try standard path first
let SRC = join(ROOT, 'node_modules', '@ffmpeg', 'core', 'dist');
// If empty (pnpm symlink quirk), drill into .pnpm
function isAccessibleDir(p) {
  try {
    const s = lstatSync(p);
    if (!s.isDirectory()) return false;
    readdirSync(p);
    return true;
  } catch {
    return false;
  }
}
if (!isAccessibleDir(SRC)) {
  // Find via .pnpm
  const PNPM = join(ROOT, 'node_modules', '.pnpm');
  if (existsSync(PNPM)) {
    const candidates = readdirSync(PNPM).filter(d => d.startsWith('@ffmpeg+core'));
    for (const c of candidates) {
      const tryPath = join(PNPM, c, 'node_modules', '@ffmpeg', 'core', 'dist');
      if (isAccessibleDir(tryPath)) {
        SRC = tryPath;
        console.log(`[copy-ffmpeg-core] Using pnpm path: ${SRC}`);
        break;
      }
    }
  }
}

if (!isAccessibleDir(SRC)) {
  console.warn(`[copy-ffmpeg-core] Source not accessible: ${SRC} (skipping; install @ffmpeg/core first)`);
  process.exit(0);
}

if (!existsSync(DEST)) {
  mkdirSync(DEST, { recursive: true });
}

const files = readdirSync(SRC);
let copied = 0;
for (const f of files) {
  if (f.startsWith('.')) continue;
  const srcPath = join(SRC, f);
  const destPath = join(DEST, f);
  try {
    if (statSync(srcPath).isDirectory()) {
      // Recursive one-level copy: esm/ and umd/ subdirs
      const SUB = join(DEST, f);
      if (!existsSync(SUB)) mkdirSync(SUB, { recursive: true });
      for (const sub of readdirSync(srcPath)) {
        copyFileSync(join(srcPath, sub), join(SUB, sub));
        copied++;
      }
    } else {
      copyFileSync(srcPath, destPath);
      copied++;
    }
  } catch (err) {
    console.error(`[copy-ffmpeg-core] Failed to copy ${f}:`, err.message);
  }
}

console.log(`[copy-ffmpeg-core] Copied ${copied} file(s) to public/ffmpeg-core/`);

