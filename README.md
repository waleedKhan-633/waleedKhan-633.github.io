# Muhammad Waleed Khan — Portfolio

Static portfolio generated from **`public/resume.pdf`** and deployed to GitHub Pages by GitHub Actions.
The PDF is the source of truth: replace it, push, and the site updates itself.

```
public/resume.pdf          ← your résumé (source of truth, also the download on the site)
content/site.json          ← hand-written copy the PDF doesn't contain (hero intro, About, contact pitch, extra project cards)
src/styles.css, main.js    ← design + interactions (nav indicator, reveal animations, mobile menu, copy email)
scripts/extract-resume.mjs ← PDF → build/resume.json   (pdf.js text extraction + layout-aware parser)
scripts/build.mjs          ← resume.json + site.json → dist/  (static HTML, relative paths)
scripts/verify.mjs         ← checks links, anchors, asset paths, PDF freshness, résumé facts present
scripts/test/              ← parser tests on a frozen fixture
.github/workflows/deploy.yml
```

## One-time setup

1. **Create the repo.** Either:
   - `waleedKhan-633.github.io` → site at `https://waleedkhan-633.github.io/` (recommended), or
   - any name, e.g. `portfolio` → site at `https://waleedkhan-633.github.io/portfolio/`.
   All paths are relative, so both work with no config change. If you use a project repo, set
   `siteUrl` in `content/site.json` to the full URL (used for canonical/sitemap only).
2. **Push this folder** to the `main` branch:
   ```bash
   cd github-pages
   npm install            # creates package-lock.json — commit it
   npm run ci             # tests → extract → build → verify, locally
   git init -b main && git add . && git commit -m "Portfolio + Pages pipeline"
   git remote add origin https://github.com/waleedKhan-633/<repo>.git
   git push -u origin main
   ```
3. **Enable Pages:** repo → **Settings → Pages → Build and deployment → Source: “GitHub Actions”.**
4. **Allow Actions** (default on): Settings → Actions → General → “Allow all actions”. Workflow permissions can stay
   “Read repository contents” — the workflow requests `pages: write` and `id-token: write` itself.
5. The first push triggers **Actions → Deploy portfolio to GitHub Pages**. The URL appears on the `deploy` job.
   If the first run fails with “Pages not enabled”, do step 3 and click **Re-run all jobs**.

No secrets are required. Optional repository **variable** (Settings → Secrets and variables → Actions → Variables):
`RESUME_OCR = true` to OCR scanned PDFs in CI.

**Custom domain:** only if you own one — set `"customDomain": "example.com"` in `content/site.json`
(the build writes `CNAME`), then add the domain under Settings → Pages and create the DNS records GitHub shows.

## Updating your résumé

1. Export the new résumé to PDF from your editor (not a scan / photo).
2. Replace **`public/resume.pdf`** (same filename). On GitHub: open `public/` → **Add file → Upload files** → commit to `main`.
3. The workflow runs: tests → extract → build → verify → deploy (~1 min). The run’s **Summary** shows what was
   extracted; the **resume-data** artifact contains the full `resume.json` to review.
4. If anything in the PDF can’t be parsed reliably, the run **fails before deploying** and says which line/section
   is the problem. The live site stays on the previous version.

To check locally before pushing: `npm run preview` → http://localhost:3000.

### What updates automatically vs. manually

| From the PDF (automatic) | From `content/site.json` (manual, never overwritten) |
|---|---|
| Name, title, stack line, location, availability | Hero intro sentence, “Leading” fact |
| Email, phone, LinkedIn/GitHub | About paragraphs, “Focus” |
| Experience: companies, roles, dates, bullets, “Earlier” | Extra project cards (ShopByStyle, Company MVP, Nextu) |
| Projects section, skills, education, certifications | Contact pitch + note, bullets shown per role (`maxHighlightsPerRole`) |
| Downloadable `resume.pdf` | `siteUrl`, `customDomain`, meta description |

When the manual copy mentions facts (e.g. “9+ years”, “12 engineers”), update `content/site.json` too.

### Résumé format the parser expects

The parser follows your current layout. Keep these conventions and updates just work:

- Line 1: name. Line 2: `Title — Stack, Stack`. Then contact lines (email, phone, `linkedin.com/in/…`, `City, Country · availability`).
- ALL-CAPS section headings: `SUMMARY`, `CORE SKILLS`, `EXPERIENCE`, `PROJECTS`, `LEADERSHIP & COMMUNITY`, `EDUCATION`
  (`CERTIFICATIONS` is supported too). Unknown headings are skipped with a warning.
- Company header: `Company — Location      Mon YYYY – Mon YYYY|Present`
- Multiple roles at one company: `Role — Mon YYYY to Mon YYYY|Present (optional note)`; one role: a title line under the header.
- Bullets end with a full stop. `Earlier` block: `Role, Company — Location (Mon YYYY – Mon YYYY). Description.`
- Skills: `Category: item, item, item`. Projects: `Name · Organisation · Tech, Tech. Description.`
- Education: `Degree — Institution      YYYY – YYYY`

If you change the layout substantially: run `node scripts/test/update-fixture.mjs`, run `npm test`, and adjust
`scripts/lib/parse.mjs` if needed. Fallback if you ever prefer not to parse: commit a reviewed
`build/resume.json` and remove the `Extract` step — the build only needs that file.

## Why generate at build time

Extraction is deterministic (same PDF → byte-identical JSON, with the PDF’s SHA-256 recorded), takes ~1 s,
and needs no bot commits back to `main`. `verify` fails the build if the deployed PDF and the data came from
different files.
