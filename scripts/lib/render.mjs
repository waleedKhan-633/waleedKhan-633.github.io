// Renders the static portfolio page from résumé data (build/resume.json)
// and manually maintained copy (content/site.json). Pure function → HTML string.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICONS = {
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  menu: '<line x1="4" x2="20" y1="7" y2="7"/><line x1="4" x2="20" y1="17" y2="17"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
};
const icon = (name, size = 16, cls = '') =>
  `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

const range = (a, b) => `${esc(a)} — ${esc(b)}`;
const telHref = (p) => `tel:${p.replace(/[^\d+]/g, '')}`;

export function render({ resume: r, site = {}, assetVersion = '', year = new Date().getUTCFullYear() }) {
  const b = r.basics;
  const v = assetVersion ? `?v=${assetVersion}` : '';
  const titleParts = b.title.split(/\s*\/\s*/);
  const titleAmp = titleParts.join(' & ');
  const titleSentence = titleParts.join(' and ');
  const description = site.description || r.summary;
  const linkedin = b.profiles.find((p) => p.network === 'LinkedIn');
  const current = r.experience[0];
  const projects = [...(r.projects || []), ...(site.extraProjects || [])];
  const maxH = site.experience?.maxHighlightsPerRole ?? Infinity;
  const pdfName = `${b.name.replace(/\s+/g, '_')}-Resume.pdf`;
  const resumeLink = (cls, label) => `<a href="resume.pdf" download="${esc(pdfName)}" class="${cls}">${label}</a>`;
  const [firstName, ...restName] = b.name.split(' ');
  const siteUrl = (site.siteUrl || '').replace(/\/?$/, '/');
  const hasUrl = !!site.siteUrl;

  const nav = [['about', 'About'], ['experience', 'Experience'], projects.length && ['projects', 'Projects'], ['skills', 'Skills'], ['contact', 'Contact']].filter(Boolean);
  const navLinks = nav.map(([id, label]) => `<a href="#${id}" data-nav="${id}">${label}</a>`).join('');

  const place = [b.location, b.availability].filter(Boolean).join(' — ');
  const intro = site.hero?.intro || r.summary;
  const facts = [
    current && ['Now', `${current.roles[0].title}, ${current.company}`],
    site.hero?.leading && ['Leading', site.hero.leading],
    b.specialties.length && ['Stack', b.specialties.join(', ')]
  ].filter(Boolean);

  const bullets = (list) => `<ul class="bullets">${list.slice(0, maxH).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`;
  const jobHead = (title, meta) => `<div class="job-head"><h3>${esc(title)}</h3><p class="meta">${meta}</p></div>`;
  const jobs = r.experience.map((j) => {
    const meta = `${range(j.start, j.end)}${j.location ? ` · ${esc(j.location)}` : ''}`;
    if (j.roles.length > 1) {
      return `<article data-reveal>${jobHead(j.company, meta)}${j.summary ? `<p class="job-sub">${esc(j.summary)}</p>` : ''}
        <ol class="timeline">${j.roles.map((ro) => `<li><div class="role-head"><h4>${esc(ro.title)}</h4><span class="meta">${range(ro.start, ro.end)}</span></div>${bullets(ro.highlights)}</li>`).join('')}</ol></article>`;
    }
    const ro = j.roles[0];
    return `<article data-reveal>${jobHead(j.company, meta)}<p class="job-sub">${esc(ro.title)}</p>${j.summary ? `<p class="job-sub">${esc(j.summary)}</p>` : ''}${bullets(ro.highlights)}</article>`;
  });
  if (r.earlier?.length) {
    const e = r.earlier;
    jobs.push(`<article data-reveal>${jobHead('Earlier', range(e[e.length - 1].start, e[0].end))}<dl class="earlier">${e
      .map((x) => `<div><dt>${esc(x.title)}, ${esc(x.company)} <span>· ${range(x.start, x.end)}</span></dt><dd>${esc(x.summary)}</dd></div>`)
      .join('')}</dl></article>`);
  }

  const edu = r.education.map((e) => `${esc(e.degree)} — ${esc(e.institution)} · ${esc(e.start)}–${esc(e.end)}`).join('<br>');

  const cards = projects.map((p) => `<li><article class="card"><p class="meta">${esc(p.org)}</p><h3>${esc(p.name)}</h3><p class="desc">${esc(p.description)}</p>
    <ul class="tags" aria-label="Technologies">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></article></li>`).join('');

  const skills = r.skills.map((s) => `<div><dt>${esc(s.category)}</dt><dd>${esc(s.items.join(', '))}</dd></div>`).join('');

  const channels = [
    ['Email', `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>`],
    ...b.profiles.map((p) => [p.network, `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.label)} ${icon('arrowUpRight', 14)}<span class="sr-only">(opens in a new tab)</span></a>`]),
    b.phone && ['Phone', `<a href="${telHref(b.phone)}">${esc(b.phone)}</a>`]
  ].filter(Boolean);

  const ld = {
    '@context': 'https://schema.org', '@type': 'Person',
    name: b.name, jobTitle: titleAmp, email: `mailto:${b.email}`, description: r.summary,
    ...(hasUrl && { url: siteUrl }),
    ...(b.location && { address: { '@type': 'PostalAddress', addressLocality: b.location } }),
    ...(current && { worksFor: { '@type': 'Organization', name: current.company } }),
    ...(r.education[0] && { alumniOf: { '@type': 'CollegeOrUniversity', name: r.education[0].institution } }),
    sameAs: b.profiles.map((p) => p.url),
    knowsAbout: b.specialties
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.name)} — ${esc(titleAmp)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(b.name)}">
<meta name="theme-color" content="#f6f5f2">
${hasUrl ? `<link rel="canonical" href="${esc(siteUrl)}">\n<meta property="og:url" content="${esc(siteUrl)}">` : ''}
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(b.name)} — ${esc(titleAmp)}">
<meta property="og:description" content="${esc(description)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2317171a'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/styles.css${v}">
<script src="assets/main.js${v}" defer></script>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="site-header">
  <nav class="nav" aria-label="Primary">
    <a class="brand" href="#top">${esc(b.name)}</a>
    <div class="nav-desktop">
      <div class="nav-links"><span class="nav-pill" aria-hidden="true"></span>${navLinks}</div>
      ${resumeLink('btn-outline-sm', `${icon('download', 15)}Résumé`)}
    </div>
    <button type="button" class="menu-btn" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">${icon('menu', 22, 'i-menu')}${icon('close', 22, 'i-close')}</button>
  </nav>
  <div id="mobile-menu" class="mobile-menu" hidden>
    ${navLinks}
    ${resumeLink('btn-block', `${icon('download', 15)}Download résumé`)}
  </div>
</header>

<main id="main">
<section id="top" class="wrap hero" aria-labelledby="hero-title">
  <p class="eyebrow" data-hero><span class="dot" aria-hidden="true"></span><span>${esc(place)}</span></p>
  <h1 id="hero-title" data-hero>${esc(firstName)}<br>${esc(restName.join(' '))}</h1>
  <div class="hero-row">
    <div class="hero-intro" data-hero>
      <p><strong>${esc(titleSentence)}.</strong> ${esc(intro)}</p>
      <div class="actions">
        ${projects.length ? `<a href="#projects" class="btn btn-primary">View My Work ${icon('arrowRight')}</a>` : ''}
        <a href="#contact" class="btn btn-secondary">Get in Touch</a>
      </div>
    </div>
    <dl class="facts" data-hero>${facts.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>
  </div>
</section>

<section id="about" class="wrap section" aria-labelledby="about-title">
  <h2 id="about-title" class="section-title">About</h2>
  <div class="section-body">
    <div class="prose" data-reveal>${(site.about?.paragraphs?.length ? site.about.paragraphs : [r.summary]).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="about-meta" data-reveal>
      ${site.about?.focus ? `<div><h3 class="label">Focus</h3><p>${esc(site.about.focus)}</p></div>` : ''}
      <div><h3 class="label">Education</h3><p>${edu}</p></div>
      ${r.certifications?.length ? `<div><h3 class="label">Certifications</h3><p>${r.certifications.map(esc).join('<br>')}</p></div>` : ''}
    </div>
  </div>
</section>

<section id="experience" class="wrap section" aria-labelledby="exp-title">
  <h2 id="exp-title" class="section-title">Experience</h2>
  <div class="section-body jobs">
    ${jobs.join('\n    ')}
    ${resumeLink('text-link', `Download full résumé ${icon('download', 15)}`).replace('class="text-link"', 'class="text-link" data-reveal')}
  </div>
</section>

${projects.length ? `<section id="projects" class="wrap section" aria-labelledby="proj-title">
  <h2 id="proj-title" class="section-title">Selected projects</h2>
  <ul class="cards" data-stagger>${cards}</ul>
</section>` : ''}

<section id="skills" class="wrap section" aria-labelledby="skills-title">
  <h2 id="skills-title" class="section-title">Skills</h2>
  <dl class="section-body skills" data-reveal>${skills}</dl>
</section>

<section id="contact" class="wrap section section--contact" aria-labelledby="contact-title">
  <h2 id="contact-title" class="section-title">Contact</h2>
  <div class="section-body" data-reveal>
    ${site.contact?.pitch ? `<p class="pitch">${esc(site.contact.pitch)}</p>` : ''}
    ${site.contact?.note ? `<p class="contact-note">${esc(site.contact.note)}</p>` : ''}
    <div class="actions">
      <a href="mailto:${esc(b.email)}" class="btn btn-primary btn-lg">${icon('mail')}Email me</a>
      <button type="button" class="btn btn-secondary btn-lg copy-btn" data-copy="${esc(b.email)}">${icon('copy', 16, 'i-copy')}${icon('check', 16, 'i-check')}<span class="copy-label">Copy address</span></button>
      <span class="sr-only" role="status" aria-live="polite" id="copy-status"></span>
    </div>
    <ul class="channels">${channels.map(([k, val]) => `<li><span class="k">${esc(k)}</span>${val}</li>`).join('')}</ul>
  </div>
</section>
</main>

<footer class="site-footer">
  <div class="wrap footer-inner">
    <p>© <span data-year>${year}</span> ${esc(b.name)}</p>
    <div class="footer-links">
      ${linkedin ? `<a href="${esc(linkedin.url)}" target="_blank" rel="noopener noreferrer">LinkedIn<span class="sr-only"> (opens in a new tab)</span></a>` : ''}
      ${resumeLink('', 'Résumé')}
      <a href="#top">Back to top ${icon('arrowUp', 14)}</a>
    </div>
  </div>
</footer>
</body>
</html>
`;
}
