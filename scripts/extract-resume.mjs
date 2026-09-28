#!/usr/bin/env node
// PDF résumé → build/resume.json (deterministic; no timestamps).
// Exits non-zero with a clear message if the PDF can't be read or parsed —
// the workflow then stops before deploying, so the live site is left untouched.
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPages } from './lib/pdf-text.mjs';
import { parseResume, assessTextLayer, ResumeParseError } from './lib/parse.mjs';

const PDF = process.env.RESUME_PDF || 'public/resume.pdf';
const OUT_DIR = 'build';

pdfjs.GlobalWorkerOptions.workerSrc = import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

async function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

async function fail(title, detail) {
  const msg = `ERROR: ${title}\n${detail}\n\nNothing was built or deployed; the currently published site is unchanged.`;
  console.error(`\n${msg}\n`);
  await summary(`## ❌ Résumé extraction failed\n\n**${title}**\n\n\`\`\`\n${detail}\n\`\`\`\n\nThe currently published site is unchanged.`);
  process.exit(1);
}

let bytes;
try {
  bytes = await readFile(PDF);
} catch {
  await fail(`Résumé not found at ${PDF}`, 'Add your résumé as public/resume.pdf (exact filename, lowercase).');
}
if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') await fail(`${PDF} is not a PDF file`, 'Export your résumé as PDF and replace public/resume.pdf.');

let pages;
try {
  pages = await extractPages(pdfjs, new Uint8Array(bytes));
} catch (e) {
  await fail('Could not read the PDF', `${e.message}\nIf the PDF is password-protected or corrupted, re-export it without a password.`);
}

const layer = assessTextLayer(pages);
if (layer.scanned) {
  await fail(
    'The PDF has no usable text layer (it looks scanned or image-only)',
    `Characters found per page: ${layer.perPage.join(', ')}.\n` +
      'Fix one of these ways:\n' +
      '  1. Export the résumé directly from Word / Google Docs / your editor as PDF (preferred), or\n' +
      '  2. Run OCR locally:  ocrmypdf --skip-text in.pdf public/resume.pdf, or\n' +
      '  3. Enable OCR in CI: Settings → Secrets and variables → Actions → Variables → RESUME_OCR = true.\n' +
      'OCR output should be reviewed — check the "resume-data" artifact of the workflow run.'
  );
}

let result;
try {
  result = parseResume(pages);
} catch (e) {
  if (e instanceof ResumeParseError) {
    await fail('The résumé layout could not be parsed reliably', `${e.message}\n\nSee README → "Résumé format the parser expects". Extracted lines were written to build/resume.lines.txt.`);
  }
  throw e;
}

const source = await readFile(process.env.RESUME_PDF ? 'public/resume.pdf' : PDF).catch(() => bytes);
const sha256 = createHash('sha256').update(source).digest('hex');
const data = { $schema: './resume.schema.md', source: { file: 'resume.pdf', sha256, pages: pages.length }, ...result.data };

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/resume.json`, JSON.stringify(data, null, 2) + '\n');
await writeFile(`${OUT_DIR}/resume.lines.txt`, pages.map((p, i) => `--- page ${i + 1} ---\n${p.join('\n')}`).join('\n') + '\n');

const d = result.data;
const counts = [
  ['Experience', `${d.experience.length} companies, ${d.experience.reduce((n, j) => n + j.roles.length, 0)} roles, ${d.earlier.length} earlier`],
  ['Projects', d.projects.length],
  ['Skill categories', d.skills.length],
  ['Education', d.education.length],
  ['Certifications', d.certifications.length]
];
console.log(`✓ Extracted résumé for ${d.basics.name} — ${d.basics.title}`);
for (const [k, v] of counts) console.log(`  ${k}: ${v}`);
for (const w of result.warnings) console.warn(`  warning: ${w}`);

await summary(
  `## ✅ Résumé extracted${process.env.RESUME_CHANGED === 'true' ? ' (PDF changed in this push)' : ''}\n\n` +
    `**${d.basics.name}** — ${d.basics.title}  \n${d.basics.email} · ${d.basics.location}\n\n` +
    `| Section | Extracted |\n|---|---|\n${counts.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\n` +
    (result.warnings.length ? `### Warnings\n${result.warnings.map((w) => `- ${w}`).join('\n')}\n\n` : '') +
    `Full data: download the **resume-data** artifact. PDF sha256: \`${sha256.slice(0, 12)}…\``
);
