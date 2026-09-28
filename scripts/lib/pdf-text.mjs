// Rebuilds visual text lines from a PDF using pdf.js text positions.
// Large horizontal gaps (e.g. right-aligned dates) become "\t".
// `pdfjs` is injected so the same code runs in Node (pdfjs-dist legacy build) and in tests.

export async function extractPages(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const { items } = await page.getTextContent();
      const rows = [];
      for (const it of items) {
        if (typeof it.str !== 'string' || it.str === '') continue;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
        let row = rows.find((r) => Math.abs(r.y - y) < h * 0.4);
        if (!row) rows.push((row = { y, items: [] }));
        row.items.push({ x, w: it.width, h, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      const lines = rows.map((r) => {
        r.items.sort((a, b) => a.x - b.x);
        let out = '', end = null;
        for (const it of r.items) {
          if (end !== null) {
            const gap = it.x - end;
            if (gap > Math.max(14, it.h * 1.6)) out += '\t';
            else if (gap > it.h * 0.12 && !/\s$/.test(out) && !/^\s/.test(it.s)) out += ' ';
          }
          out += it.s;
          end = it.x + it.w;
        }
        return out.replace(/[ ]{2,}/g, ' ').trim();
      }).filter(Boolean);
      pages.push(lines);
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
