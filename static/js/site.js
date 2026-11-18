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

  /* project: scroll-scrubbed drawing sequence */
  var seq = $('#seq');
  if (seq) {
    var cv = $('#seq-canvas'), ctx = cv.getContext('2d'), N = +seq.dataset.frames, base = seq.dataset.base;
    var stops = seq.dataset.steps.split(',').map(Number), lis = $$('.seq-steps li'), fill = $('#seq-fill');
    var imgs = new Array(N), loaded = new Array(N), started = false, cur = -1, want = 0;
    if (reduce) { seq.classList.add('static'); }
    else {
      var src = function (i) { return base + String(i).padStart(3, '0') + '.webp'; };
      var draw = function (i) {
        var k = i; while (k > 0 && !loaded[k]) k--;            // nearest loaded frame at or before i
        if (!loaded[k]) return;
        if (k === cur) return; cur = k;
        ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(imgs[k], 0, 0, cv.width, cv.height);
      };
      var load = function () {
        if (started) return; started = true;
        // load every 8th frame first so scrubbing works early, then fill in the rest
        var order = []; for (var s = 8; s >= 1; s = s / 2 | 0) { for (var i = 0; i < N; i += s) if (order.indexOf(i) < 0) order.push(i); if (s === 1) break; }
        order.forEach(function (i) { var im = new Image(); im.decoding = 'async'; im.onload = function () { loaded[i] = true; if (i <= want) { cur = -1; draw(want); } }; im.src = src(i); imgs[i] = im; });
      };
      var tick = false;
      var update = function () {
        tick = false;
        var r = seq.getBoundingClientRect(), span = r.height - innerHeight;
        var p = Math.min(1, Math.max(0, -r.top / (span || 1)));
        want = Math.round(p * (N - 1)); draw(want);
        var a = 0; stops.forEach(function (s, i) { if (p >= s - 0.001) a = i; });
        lis.forEach(function (li, i) { li.classList.toggle('on', i === a); });
        if (fill) fill.style.width = (p * 100).toFixed(1) + '%';
      };
      var near = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { load(); near.disconnect(); } }, { rootMargin: '300% 0px' });
      near.observe(seq);
      addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
      addEventListener('resize', update); update();
    }
  }

  /* project: before/after drag slider */
  $$('.cmp').forEach(function (c) {
    var r = $('.cmp-r', c);
    function set(v) { c.style.setProperty('--p', v + '%'); }
    r.addEventListener('input', function () { set(r.value); c.classList.add('touched'); });
    var drag = false;
    function at(e) { var b = c.getBoundingClientRect(), v = Math.max(0, Math.min(100, (e.clientX - b.left) / b.width * 100)); set(v.toFixed(2)); r.value = v; c.classList.add('touched'); }
    c.addEventListener('pointerdown', function (e) { drag = true; c.setPointerCapture(e.pointerId); at(e); });
    c.addEventListener('pointermove', function (e) { if (drag) at(e); });
    c.addEventListener('pointerup', function () { drag = false; });
    c.addEventListener('pointercancel', function () { drag = false; });
    if (!reduce && 'IntersectionObserver' in window) {   // one gentle sweep when it first comes into view, so it reads as interactive
      var o = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; o.disconnect();
        var t0 = performance.now();
        (function k(t) {
          if (c.classList.contains('touched')) return;
          var q = Math.min((t - t0) / 1800, 1), v = 50 + Math.sin(q * Math.PI * 2) * 22 * (1 - q);
          set(v.toFixed(2)); r.value = v; if (q < 1) requestAnimationFrame(k);
        })(t0);
      }, { threshold: .6 });
      o.observe(c);
    }
  });

  /* project: pinned walkthrough film — plays while in view, grows to full height as you scroll into it */
  var film = $('#film');
  if (film) {
    var fv = $('.film-v', film), fstage = $('.film-stage', film), loadedF = false;
    function loadF() { if (loadedF) return; loadedF = true; fv.src = fv.canPlayType('video/mp4; codecs="avc1.640028"') ? fv.dataset.src : fv.dataset.webm; }
    var fo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { loadF(); if (!reduce) { var pr = fv.play(); if (pr && pr.catch) pr.catch(function () {}); } }
        else fv.pause();
      });
    }, { rootMargin: '0px 0px -25% 0px' });
    fo.observe(film);
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) loadF(); }, { rootMargin: '100% 0px' }).observe(film);
    if (reduce) { fv.controls = true; }
    else {
      var fTick = false;
      var fUpd = function () {
        fTick = false;
        var r = film.getBoundingClientRect(), h = innerHeight;
        var p = Math.min(1, Math.max(0, (h - r.top) / h));          // 0 when the section top reaches the bottom of the screen, 1 when it reaches the top
        fstage.style.setProperty('--s', (0.72 + 0.28 * p).toFixed(4));
        film.classList.toggle('lit', p > .96);
      };
      addEventListener('scroll', function () { if (!fTick) { fTick = true; requestAnimationFrame(fUpd); } }, { passive: true });
      addEventListener('resize', fUpd); fUpd();
    }
  }

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
