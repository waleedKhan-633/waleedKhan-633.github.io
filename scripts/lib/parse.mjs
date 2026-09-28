// Pure resume parser: text lines in, structured data out. No I/O, no dependencies.
// Throws ResumeParseError rather than returning partial data.

export class ResumeParseError extends Error {
  constructor(problems) {
    const list = [].concat(problems);
    super(list.map((p) => `  - ${p}`).join('\n'));
    this.name = 'ResumeParseError';
    this.problems = list;
  }
}

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const DATE = `(?:${MONTH}\\s+\\d{4}|\\d{4})`;
const END = `(?:Present|Current|Now|${DATE})`;
const SEP = '[–—-]';
const ROLE_START_RE = new RegExp(`^.+?\\s+[—–]\\s+${DATE}\\s+(?:to|${SEP})\\s+${END}`);
const ROLE_RE = new RegExp(`^(.+?)\\s+[—–]\\s+(${DATE})\\s+(?:to|${SEP})\\s+(${END})(?:\\s*\\((.*)\\))?$`);
const COMPANY_RE = new RegExp(`^(.+?)\\s+[—–]\\s+(.+?)\\s+(${DATE})\\s*${SEP}\\s*(${END})$`);
const EARLIER_RE = new RegExp(`^(.+?),\\s+(.+?)\\s+[—–]\\s+(.+?)\\s+\\((${DATE})\\s*${SEP}\\s*(${END})\\)\\.?\\s*(.*)$`);
const EDU_RE = new RegExp(`^(.+?)\\s+[—–]\\s+(.+?)\\s+(${DATE})\\s*${SEP}\\s*(${END})$`);
const DATE_ONLY_RE = new RegExp(`^(?:${DATE}|${MONTH})$`);

const SECTIONS = {
  summary: ['SUMMARY', 'PROFILE', 'PROFESSIONAL SUMMARY', 'ABOUT', 'ABOUT ME'],
  skills: ['CORE SKILLS', 'SKILLS', 'TECHNICAL SKILLS', 'KEY SKILLS'],
  experience: ['EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT'],
  projects: ['PROJECTS', 'SELECTED PROJECTS', 'KEY PROJECTS'],
  leadership: ['LEADERSHIP & COMMUNITY', 'LEADERSHIP', 'COMMUNITY'],
  education: ['EDUCATION'],
  certifications: ['CERTIFICATIONS', 'CERTIFICATES', 'LICENSES & CERTIFICATIONS', 'CERTIFICATIONS & AWARDS']
};

export function normalize(line) {
  return line
    .replace(/[\u02BC\u2018\u2019]/g, '’')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/ *\t[ \t]*/g, '\t')
    .trim();
}

const glue = (a, b) => (/[A-Za-z]-$/.test(a) ? a + b : `${a} ${b}`);
const depth = (s) => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
const flat = (s) => s.replace(/\t+/g, ' ').trim();

/** Re-joins lines that were wrapped by the PDF layout into logical paragraphs / bullets. */
export function joinWrapped(lines) {
  const out = [];
  for (const raw of lines) {
    const l = flat(raw);
    if (!l) continue;
    const prev = out[out.length - 1];
    if (prev === undefined || (/[.!?]["”)]?$/.test(prev) && /^[A-Z0-9"“(]/.test(l))) out.push(l);
    else out[out.length - 1] = glue(prev, l);
  }
  return out;
}

/** Splits "a, b (c, d); e" on top-level commas/semicolons. */
export function splitList(s) {
  const items = [];
  let cur = '', d = 0;
  for (const ch of s) {
    if (ch === '(') d++;
    if (ch === ')') d = Math.max(0, d - 1);
    if ((ch === ',' || ch === ';') && d === 0) { items.push(cur); cur = ''; } else cur += ch;
  }
  items.push(cur);
  return items.map((x) => x.trim().replace(/\.$/, '')).filter(Boolean);
}

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const isHeading = (l) => /^[A-Z][A-Z0-9 &/,'’-]{2,48}$/.test(l) && /[A-Z]{3}/.test(l) && !/\d{4}/.test(l);
const sectionKey = (l) => Object.keys(SECTIONS).find((k) => SECTIONS[k].includes(l.replace(/\s+/g, ' ')));
const isTitleLine = (l) => l.length <= 80 && !/[.!?,;:]$/.test(l) && !l.includes('\t') && /^[A-Z]/.test(l);

/** Detects PDFs without a usable text layer (scanned / image-only). */
export function assessTextLayer(pages) {
  const perPage = pages.map((p) => p.join('').replace(/\s/g, '').length);
  const total = perPage.reduce((a, b) => a + b, 0);
  const emptyPages = perPage.filter((n) => n < 40).length;
  const scanned = total < 400 || emptyPages > pages.length / 2;
  return { scanned, total, perPage, emptyPages };
}

function parseHeader(header, problems) {
  if (header.length < 2) { problems.push('Header: expected a name line and a title line before the first section.'); return {}; }
  const nameLine = flat(header[0]);
  const name = nameLine === nameLine.toUpperCase() ? titleCase(nameLine) : nameLine;
  const [title, specialties = ''] = flat(header[1]).split(/\s+[—–]\s+/, 2);
  let text = header.slice(2).join('\t');

  const email = (text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [])[0] || '';
  const phone = (text.match(/\+?\d[\d ()-]{7,}\d/) || [])[0] || '';
  const profiles = [];
  for (const m of text.matchAll(/(?:https?:\/\/)?(?:www\.)?((linkedin\.com\/in|github\.com|gitlab\.com)\/[\w-]+\/?)/gi)) {
    const label = m[1].replace(/\/$/, '');
    const network = /linkedin/i.test(m[2]) ? 'LinkedIn' : /github/i.test(m[2]) ? 'GitHub' : 'GitLab';
    profiles.push({ network, label, url: `https://${label}` });
  }
  for (const s of [email, phone, ...profiles.map((p) => p.label)]) if (s) text = text.split(s).join('\t');
  text = text.replace(/(?:https?:\/\/)?(?:www\.)?\t/g, '\t');
  const rest = text.split(/\t|\s{2,}|\s\|\s/).map((t) => t.trim().replace(/^[·|,\s]+|[·|,\s]+$/g, '')).filter(Boolean);
  const [location = '', ...avail] = (rest[0] || '').split(/\s+·\s+/);
  return {
    name, title: title.trim(),
    specialties: specialties ? splitList(specialties) : [],
    email, phone, location: location.trim(), availability: avail.join(' · ').trim(), profiles
  };
}

function parseSkills(lines, problems) {
  const cats = [];
  for (const raw of lines) {
    const l = flat(raw);
    const m = l.match(/^([A-Z][^:]{1,40}):\s+(.+)$/);
    if (m) cats.push({ category: m[1].trim(), text: m[2] });
    else if (cats.length) cats[cats.length - 1].text = glue(cats[cats.length - 1].text, l);
    else problems.push(`Skills: line without a "Category:" prefix: "${l.slice(0, 60)}"`);
  }
  return cats.map(({ category, text }) => ({ category, items: splitList(text) }));
}

function matchCompany(l) {
  const m = flat(l).match(COMPANY_RE);
  if (!m || DATE_ONLY_RE.test(m[2].trim())) return null;
  return { company: m[1].trim(), location: m[2].trim(), start: m[3], end: m[4] };
}

function parseExperience(lines, problems) {
  const cut = lines.findIndex((l) => /^(earlier|earlier (roles|experience)|previous experience|prior experience)$/i.test(flat(l)));
  const main = cut >= 0 ? lines.slice(0, cut) : lines;
  const early = cut >= 0 ? lines.slice(cut + 1) : [];
  const jobs = [];
  let job = null, role = null, buf = [];
  const close = () => { if (role) role.highlights = joinWrapped(buf); buf = []; };

  for (let i = 0; i < main.length; i++) {
    let l = flat(main[i]);
    if (job && ROLE_START_RE.test(l)) {
      while (depth(l) > 0 && i + 1 < main.length) l = glue(l, flat(main[++i]));
      const m = l.match(ROLE_RE);
      if (m) {
        close();
        role = { title: m[1].trim(), start: m[2], end: m[3], note: (m[4] || '').trim(), highlights: [] };
        job.roles.push(role);
        continue;
      }
    }
    const c = matchCompany(main[i]);
    if (c) { close(); role = null; job = { ...c, summary: '', roles: [] }; jobs.push(job); continue; }
    if (!job) { problems.push(`Experience: text before the first "Company — Location  Start – End" header: "${l.slice(0, 60)}"`); continue; }
    if (!role) {
      const summaryDone = !job.summary || /[.!?]$/.test(job.summary);
      if (summaryDone && isTitleLine(l)) {
        role = { title: l, start: job.start, end: job.end, note: '', highlights: [] };
        job.roles.push(role);
      } else job.summary = job.summary ? glue(job.summary, l) : l;
      continue;
    }
    buf.push(l);
  }
  close();

  const earlier = joinWrapped(early).map((p) => {
    const m = p.match(EARLIER_RE);
    if (!m) { problems.push(`Experience (Earlier): could not parse "${p.slice(0, 70)}…" — expected "Role, Company — Location (Start – End). Description"`); return null; }
    return { title: m[1].trim(), company: m[2].trim(), location: m[3].trim(), start: m[4], end: m[5], summary: m[6].trim() };
  }).filter(Boolean);

  return { jobs, earlier };
}

function parseProjects(lines, problems) {
  return joinWrapped(lines).map((p) => {
    const parts = p.split(/\s+·\s+/);
    if (parts.length < 3) { problems.push(`Projects: expected "Name · Organisation · Tech, Tech. Description" in "${p.slice(0, 60)}…"`); return null; }
    const [name, org, ...restParts] = parts;
    const rest = restParts.join(' · ');
    const dot = rest.indexOf('. ');
    if (dot < 0) { problems.push(`Projects: no description after the technology list in "${name}"`); return null; }
    return { name: name.trim(), org: org.trim(), tags: splitList(rest.slice(0, dot)), description: rest.slice(dot + 2).trim() };
  }).filter(Boolean);
}

function parseEducation(lines, problems) {
  const entries = [];
  for (const raw of lines) {
    const l = flat(raw);
    const m = l.match(EDU_RE);
    if (m) entries.push({ degree: m[1].trim(), institution: m[2].trim(), start: m[3], end: m[4] });
    else if (entries.length) entries[entries.length - 1].institution = glue(entries[entries.length - 1].institution, l);
    else problems.push(`Education: could not parse "${l.slice(0, 60)}" — expected "Degree — Institution  Start – End"`);
  }
  return entries;
}

export function validateResume(d) {
  const p = [];
  const b = d.basics || {};
  if (!b.name) p.push('Missing name (first line of the PDF).');
  if (!b.title) p.push('Missing professional title (second line of the PDF).');
  if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(b.email || '')) p.push('Missing or invalid email address in the header.');
  if (!d.summary || d.summary.length < 40) p.push('Summary section missing or too short.');
  if (!d.experience?.length) p.push('No work experience entries found.');
  for (const j of d.experience || []) {
    if (!j.roles.length) p.push(`Experience "${j.company}": no role title found.`);
    for (const r of j.roles) if (!r.highlights.length) p.push(`Experience "${j.company}" / "${r.title}": no bullet points found.`);
  }
  if (!d.skills?.length) p.push('No skill categories found.');
  for (const s of d.skills || []) if (!s.items.length) p.push(`Skill category "${s.category}" is empty.`);
  if (!d.education?.length) p.push('No education entries found.');
  return p;
}

/**
 * @param {string[][]} pages  text lines per page (tabs mark large horizontal gaps)
 * @returns {{ data: object, warnings: string[] }}
 */
export function parseResume(pages) {
  const problems = [], warnings = [];
  const lines = pages.flat().map(normalize).filter((l) => l && !/^--\s*\d+\s+of\s+\d+\s*--$/.test(l) && !/^page \d+(\s+of\s+\d+)?$/i.test(l));

  let first = -1;
  for (let i = 1; i < lines.length; i++) if (isHeading(lines[i])) { first = i; break; }
  if (first < 0) throw new ResumeParseError('No section headings (e.g. SUMMARY, EXPERIENCE, SKILLS) were found.');

  const sections = {};
  let cur = null;
  for (const l of lines.slice(first)) {
    if (isHeading(l)) {
      const key = sectionKey(l);
      if (!key) { warnings.push(`Unrecognised section "${l}" was skipped.`); cur = null; continue; }
      if (sections[key]) warnings.push(`Section "${l}" appears twice; contents were merged.`);
      sections[key] = sections[key] || [];
      cur = key;
      continue;
    }
    if (cur) sections[cur].push(l);
  }

  const basics = parseHeader(lines.slice(0, first), problems);
  const { jobs, earlier } = parseExperience(sections.experience || [], problems);
  const data = {
    basics,
    summary: joinWrapped(sections.summary || []).join(' '),
    skills: parseSkills(sections.skills || [], problems),
    experience: jobs,
    earlier,
    projects: parseProjects(sections.projects || [], problems),
    leadership: joinWrapped(sections.leadership || []),
    education: parseEducation(sections.education || [], problems),
    certifications: joinWrapped(sections.certifications || [])
  };

  problems.push(...validateResume(data));
  if (problems.length) throw new ResumeParseError(problems);
  if (!data.projects.length) warnings.push('No PROJECTS section found; only projects from content/site.json will be shown.');
  for (const j of data.experience) for (const r of j.roles) for (const h of r.highlights) {
    if (h.length < 25) warnings.push(`Very short bullet under "${j.company} / ${r.title}": "${h}" — check the PDF layout.`);
  }
  return { data, warnings };
}
