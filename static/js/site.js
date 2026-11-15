/* JB Lux Designs — site behaviour. One file for every page; each block checks for its own elements. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return [].slice.call((el || document).querySelectorAll(s)); }

  /* loading counter (home) */
  var n = $('#ld-n');
  if (n && !reduce && !root.classList.contains('seen')) {
    var t0 = performance.now();
    (function tick(t) {
      var p = Math.min((t - t0) / 1500, 1);
      var e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      n.textContent = String(Math.round(e * 100)).padStart(3, '0');
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* smooth scroll */
  var lenis = null;
  if (!reduce && window.Lenis) {
    try {
      lenis = new Lenis({ duration: .8 });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    } catch (e) { lenis = null; }
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var el = id === '#top' ? document.body : $(id);
      if (!el) return;
      e.preventDefault(); closeMenu();
      if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.2 });
      else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* reveal on enter */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('.rise,.reveal').forEach(function (el) { io.observe(el); });
  } else { $$('.rise,.reveal').forEach(function (el) { el.classList.add('in'); }); }

  /* home: hero drift and darkening, services lit row */
  var hero = $('.hero'), media = $('#hero-media'), shade = $('#hero-shade');
  var rows = $$('.svc-row'), list = $('#svc-list'), ticking = false;
  function frame() {
    ticking = false;
    if (hero && !reduce) {
      var y = window.scrollY, h = hero.offsetHeight;
      if (y < h * 1.2) { media.style.transform = 'translate3d(0,' + (y * .35).toFixed(1) + 'px,0)'; shade.style.opacity = (.26 + Math.min(y / h, 1) * .45).toFixed(3); }
    }
    if (list) {
      var mid = innerHeight / 2, best = null, bd = 1e9, box = list.getBoundingClientRect();
      rows.forEach(function (r) { var b = r.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - mid); if (d < bd) { bd = d; best = r; } });
      rows.forEach(function (r) { r.classList.toggle('on', r === best && box.bottom > 0 && box.top < innerHeight); });
    }
  }
  if (hero || list) {
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); frame();
    rows.forEach(function (r) { r.addEventListener('mouseenter', function () { rows.forEach(function (o) { o.classList.toggle('on', o === r); }); }); });
  }

  /* menu */
  var menu = $('#menu'), btn = $('#menu-btn');
  function openMenu() { menu.classList.add('open'); menu.removeAttribute('inert'); menu.setAttribute('aria-hidden', 'false'); btn.textContent = 'Close'; btn.setAttribute('aria-expanded', 'true'); if (lenis) lenis.stop(); document.body.style.overflow = 'hidden'; }
  function closeMenu() { if (!menu || !menu.classList.contains('open')) return; menu.classList.remove('open'); menu.setAttribute('inert', ''); menu.setAttribute('aria-hidden', 'true'); btn.textContent = 'Menu'; btn.setAttribute('aria-expanded', 'false'); if (lenis) lenis.start(); document.body.style.overflow = ''; }
  if (menu && btn) {
    btn.addEventListener('click', function () { menu.classList.contains('open') ? closeMenu() : openMenu(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* projects: filter */
  var fb = $$('.filters button'), cards = $$('.pgrid .card'), cnt = $('#p-count');
  fb.forEach(function (b) {
    b.addEventListener('click', function () {
      fb.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      var f = b.dataset.f, shown = 0;
      cards.forEach(function (c) { var ok = f === 'all' || c.dataset.cat === f; c.hidden = !ok; if (ok) { shown++; c.classList.add('in'); } });
      if (cnt) cnt.textContent = shown + (shown === 1 ? ' project' : ' projects');
    });
  });

  /* project: lightbox */
  var lb = $('#lb'), zooms = $$('.zoom');
  if (lb && zooms.length) {
    var lbImg = $('#lb-img'), lbCap = $('#lb-cap'), lbPos = $('#lb-pos'), cur = 0, last = null;
    function show(i) {
      cur = (i + zooms.length) % zooms.length; var z = zooms[cur];
      lbImg.src = z.dataset.full; lbImg.alt = z.querySelector('img').alt; lbCap.textContent = z.dataset.cap || '';
      lbPos.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(zooms.length).padStart(2, '0');
    }
    function openLb(i) { last = document.activeElement; lb.hidden = false; show(i); if (lenis) lenis.stop(); document.body.style.overflow = 'hidden'; $('#lb-close').focus(); }
    function closeLb() { lb.hidden = true; lbImg.removeAttribute('src'); if (lenis) lenis.start(); document.body.style.overflow = ''; if (last) last.focus(); }
    zooms.forEach(function (z, i) { z.addEventListener('click', function () { openLb(i); }); });
    $('#lb-close').addEventListener('click', closeLb);
    $('#lb-prev').addEventListener('click', function () { show(cur - 1); });
    $('#lb-next').addEventListener('click', function () { show(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-stage')) closeLb(); });
    addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  /* copy email */
  $$('.copy').forEach(function (cb) {
    cb.addEventListener('click', function () {
      var el = $('#' + cb.dataset.target);
      function sel() { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); cb.textContent = 'Selected'; }
      try { navigator.clipboard.writeText(el.textContent).then(function () { cb.textContent = 'Copied'; }, sel); } catch (e) { sel(); }
    });
  });

  /* contact form: in the review preview there is nowhere to send, so say so instead of submitting */
  var form = $('#contact-form');
  if (form && form.dataset.preview) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('#form-note'); note.textContent = 'Preview only: nothing was sent. On the live site this form emails ' + form.dataset.to + '.'; note.classList.add('ok');
    });
  }
})();
