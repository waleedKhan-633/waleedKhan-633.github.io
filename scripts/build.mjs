#!/usr/bin/env node
// build/resume.json + content/site.json + src/* → dist/ (static, relative paths → works under /<repo>/).
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { render } from './lib/render.mjs';

const DIST = 'dist';
const die = (m) => { console.error(`ERROR: ${m}`); process.exit(1); };

if (!existsSync('build/resume.json')) die('build/resume.json not found — run `npm run extract` first.');
const resume = JSON.parse(await readFile('build/resume.json', 'utf8'));
let site;
try { site = JSON.parse(await readFile('content/site.json', 'utf8')); } catch (e) { die(`content/site.json is not valid JSON: ${e.message}`); }

const css = await readFile('src/styles.css', 'utf8');
const js = await readFile('src/main.js', 'utf8');
const assetVersion = createHash('sha256').update(css).update(js).digest('hex').slice(0, 10);

await rm(DIST, { recursive: true, force: true });
await mkdir(`${DIST}/assets`, { recursive: true });
await cp('public', DIST, { recursive: true });
await writeFile(`${DIST}/assets/styles.css`, css);
await writeFile(`${DIST}/assets/main.js`, js);
await writeFile(`${DIST}/index.html`, render({ resume, site, assetVersion }));
await writeFile(`${DIST}/.nojekyll`, '');

const base = site.siteUrl ? site.siteUrl.replace(/\/?$/, '/') : '';
await writeFile(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}sitemap.xml\n` : ''}`);
if (base) await writeFile(`${DIST}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}</loc></url></urlset>\n`);
if (site.customDomain) await writeFile(`${DIST}/CNAME`, `${site.customDomain.trim()}\n`);

console.log(`✓ Built ${DIST}/ for ${resume.basics.name} (assets v=${assetVersion})`);
