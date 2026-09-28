// Progressive enhancement only — all content is in the HTML and readable without JS.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const header = $('.site-header');
  const navLinks = $('.nav-links');
  const pill = $('.nav-pill');
  const allNav = $$('[data-nav]');
  const ids = $$('[data-nav]', navLinks).map((a) => a.dataset.nav);
  const menuBtn = $('.menu-btn');
  const menu = $('#mobile-menu');

  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* Active section + animated nav indicator */
  let active = null;
  const isMenuOpen = () => menuBtn.getAttribute('aria-expanded') === 'true';

  function placePill() {
    const link = active && navLinks.querySelector(`[data-nav="${active}"]`);
    if (!link || !link.offsetWidth) { pill.style.opacity = '0'; return; }
    const firstShow = pill.style.opacity !== '1';
    if (firstShow) pill.classList.add('no-move');
    pill.style.width = `${link.offsetWidth}px`;
    pill.style.transform = `translateX(${link.offsetLeft}px)`;
    if (firstShow) { void pill.offsetWidth; pill.classList.remove('no-move'); }
    pill.style.opacity = '1';
  }

  function setActive(id) {
    if (id === active) return;
    active = id;
    allNav.forEach((a) => {
      const on = a.dataset.nav === id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    placePill();
  }

  function track() {
    const line = innerHeight * 0.35;
    let id = '';
    for (const s of ids) { const el = document.getElementById(s); if (el && el.getBoundingClientRect().top <= line) id = s; }
    const sh = document.documentElement.scrollHeight;
    if (scrollY > 0 && sh > innerHeight + 4 && innerHeight + scrollY >= sh - 4) id = ids[ids.length - 1];
    setActive(id);
    header.classList.toggle('is-scrolled', scrollY > 8 || isMenuOpen());
  }

  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; track(); }); }, { passive: true });
  addEventListener('resize', () => { if (innerWidth >= 820 && isMenuOpen()) setMenu(false); track(); placePill(); });
  addEventListener('load', () => { track(); placePill(); });
  if (document.fonts) document.fonts.ready.then(placePill);
  track();

  /* Mobile menu */
  function setMenu(open, returnFocus) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    header.classList.toggle('is-scrolled', scrollY > 8 || open);
    if (!open && returnFocus) menuBtn.focus();
  }
  menuBtn.addEventListener('click', () => setMenu(!isMenuOpen()));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isMenuOpen()) setMenu(false, true); });

  /* Copy email */
  const copyBtn = $('.copy-btn');
  if (copyBtn) {
    const label = $('.copy-label', copyBtn), status = $('#copy-status');
    let t;
    copyBtn.addEventListener('click', async () => {
      const value = copyBtn.dataset.copy;
      let ok = false;
      try { if (navigator.clipboard && isSecureContext) { await navigator.clipboard.writeText(value); ok = true; } } catch { /* fall through */ }
      if (!ok) {
        const ta = Object.assign(document.createElement('textarea'), { value, readOnly: true });
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
      }
      if (!ok) return;
      copyBtn.classList.add('is-copied'); label.textContent = 'Copied'; status.textContent = 'Email address copied to clipboard';
      clearTimeout(t);
      t = setTimeout(() => { copyBtn.classList.remove('is-copied'); label.textContent = 'Copy address'; status.textContent = ''; }, 2000);
    });
  }

  /* Entrance + scroll reveal (transform/opacity only; skipped for reduced motion) */
  if (reduce || !Element.prototype.animate) return;
  const opts = (delay) => ({ duration: 640, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
  const fade = (el, delay, y) => el.animate([{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'none' }], opts(delay));
  $$('[data-hero]').forEach((el, i) => fade(el, 60 + i * 80, 14));
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (e.target.hasAttribute('data-stagger')) Array.from(e.target.children).forEach((c, i) => fade(c, Math.min(i, 6) * 70, 12));
    else fade(e.target, 0, 12);
  }), { threshold: 0.06 });
  const vh = innerHeight;
  $$('[data-reveal],[data-stagger]').forEach((el) => { if (el.getBoundingClientRect().top > vh * 0.92) io.observe(el); });
})();
