// Parser tests against a frozen snapshot of text lines (fixtures/resume-pages.json),
// so they don't break when the real résumé changes. Refresh the fixture with:
//   node scripts/test/update-fixture.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseResume, assessTextLayer, joinWrapped, splitList, ResumeParseError } from '../lib/parse.mjs';

const pages = JSON.parse(await readFile(new URL('./fixtures/resume-pages.json', import.meta.url), 'utf8'));

test('parses header and contact details', () => {
  const { data } = parseResume(pages);
  assert.equal(data.basics.name, 'Muhammad Waleed Khan');
  assert.equal(data.basics.title, 'Senior Frontend Engineer / Tech Lead');
  assert.equal(data.basics.email, 'waleedkhan633@gmail.com');
  assert.equal(data.basics.phone, '+92 332 222 7167');
  assert.equal(data.basics.location, 'Karachi, Pakistan');
  assert.equal(data.basics.profiles[0].url, 'https://linkedin.com/in/waleedkhan633');
});

test('parses experience, roles and wrapped bullets', () => {
  const { data } = parseResume(pages);
  assert.deepEqual(data.experience.map((j) => j.company), ['Nisum', 'Pcybil', 'Diya Interactive']);
  const nisum = data.experience[0];
  assert.deepEqual(nisum.roles.map((r) => r.title), ['Tech Lead', 'Principal Software Engineer', 'Senior Software Engineer, Frontend']);
  assert.equal(nisum.roles[0].start, 'May 2026');
  assert.match(nisum.roles[2].highlights[0], /fixed-bid e-commerce program/);
  assert.equal(data.experience[1].roles[0].title, 'Software Engineer (MERN)');
  assert.equal(data.earlier.length, 2);
  assert.equal(data.earlier[1].company, 'Mictronix');
});

test('parses skills, projects, education', () => {
  const { data, warnings } = parseResume(pages);
  assert.ok(data.skills.length >= 8);
  assert.ok(data.skills.find((s) => s.category === 'Performance & quality').items.includes('cross-browser support'));
  assert.deepEqual(data.projects.map((p) => p.name), ['PIP Micro-Frontend Platform', 'One Design Journey', 'Flexible Template System']);
  assert.equal(data.education[0].end, '2016');
  assert.deepEqual(warnings, []);
});

test('is deterministic', () => {
  assert.equal(JSON.stringify(parseResume(pages).data), JSON.stringify(parseResume(pages).data));
});

test('flags scanned / image-only PDFs', () => {
  assert.equal(assessTextLayer([[''], [' ']]).scanned, true);
  assert.equal(assessTextLayer(pages).scanned, false);
});

test('fails loudly on incomplete résumés instead of returning partial data', () => {
  assert.throws(() => parseResume([['JANE DOE', 'Engineer', 'SUMMARY', 'Too short.']]), ResumeParseError);
});

test('helpers', () => {
  assert.deepEqual(joinWrapped(['A fixed-bid e-', 'commerce thing.', 'Next bullet.']), ['A fixed-bid e-commerce thing.', 'Next bullet.']);
  assert.deepEqual(splitList('Core Web Vitals (LCP, CLS), Lighthouse; ARIA'), ['Core Web Vitals (LCP, CLS)', 'Lighthouse', 'ARIA']);
});
