#!/usr/bin/env node
// Post-build checks: broken local links/anchors, root-absolute paths (break project Pages),
// résumé PDF is the latest one, and résumé content actually made it into the page.
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const errors = [];
const html = await readFile('dist/index.html', 'utf8');
const resume = JSON.parse(await readFile('build/resume.json', 'utf8'));
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = decode(html);

for (const [, attr, raw] of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
  const url = decode(raw);
  if (/^(https?:|mailto:|tel:|data:)/.test(url)) continue;
  if (url.startsWith('#')) { if (url.length > 1 && !ids.has(url.slice(1))) errors.push(`Broken anchor ${attr}="${url}"`); continue; }
  if (url.startsWith('/')) { errors.push(`Root-absolute path ${attr}="${url}" breaks on https://<user>.github.io/<repo>/ — use a relative path`); continue; }
  const file = `dist/${url.split(/[?#]/)[0]}`;
  if (!existsSync(file)) errors.push(`Missing file for ${attr}="${url}" (${file})`);
}

const hash = async (f) => createHash('sha256').update(await readFile(f)).digest('hex');
if (!existsSync('dist/resume.pdf')) errors.push('dist/resume.pdf is missing');
else if ((await hash('dist/resume.pdf')) !== (await hash('public/resume.pdf'))) errors.push('dist/resume.pdf differs from public/resume.pdf');
if (resume.source.sha256 !== (await hash('public/resume.pdf'))) errors.push('build/resume.json was extracted from a different PDF — re-run `npm run extract`');

const mustContain = [
  resume.basics.name, resume.basics.email,
  ...resume.experience.map((j) => j.company),
  ...resume.experience.flatMap((j) => j.roles.map((r) => r.title)),
  ...resume.skills.map((s) => s.category),
  ...resume.projects.map((p) => p.name)
];
for (const s of mustContain) if (!text.includes(s)) errors.push(`Page is missing résumé content: "${s}"`);
if (!/<title>[^<]{5,}<\/title>/.test(html)) errors.push('Missing <title>');
if (!existsSync('dist/.nojekyll')) errors.push('Missing dist/.nojekyll');

if (errors.length) {
  console.error(`ERROR: build verification failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`✓ Verified dist/ — ${mustContain.length} résumé facts present, links and assets OK, résumé PDF current`);
