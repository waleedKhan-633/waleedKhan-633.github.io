#!/usr/bin/env node
// Re-snapshots the text lines of public/resume.pdf into the test fixture.
// Run after changing your résumé layout, then update assertions in parse.test.mjs.
import { readFile, writeFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPages } from '../lib/pdf-text.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
const pages = await extractPages(pdfjs, new Uint8Array(await readFile('public/resume.pdf')));
await writeFile(new URL('./fixtures/resume-pages.json', import.meta.url), JSON.stringify(pages, null, 1) + '\n');
console.log(`✓ Fixture updated (${pages.length} pages)`);
