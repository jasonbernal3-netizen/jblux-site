#!/usr/bin/env node
/* JB Lux Designs — static site build. No dependencies: `node build.js` writes ./dist.
   Content lives in data/site.json and data/projects.json; templates are the functions below.
   `node build.js --preview` writes ./preview with relative links and inlined CSS/JS for review. */
const fs = require('fs');
const path = require('path');

const PREVIEW = process.argv.includes('--preview');
const ROOT = __dirname;
const OUT = path.join(ROOT, PREVIEW ? 'preview' : 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
const projects = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/projects.json'), 'utf8'));
const images = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/images.json'), 'utf8'));
const css = fs.readFileSync(path.join(ROOT, 'static/css/site.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'static/js/site.js'), 'utf8');
const lenis = fs.readFileSync(path.join(ROOT, 'static/js/lenis.min.js'), 'utf8');

projects.forEach((p, i) => { p.no = String(i + 1).padStart(2, '0'); });
const bySlug = Object.fromEntries(projects.map(p => [p.slug, p]));
const live = projects.filter(p => !p.soon);
const count = { all: projects.length, res: projects.filter(p => p.cat === 'res').length, com: projects.filter(p => p.cat === 'com').length };

/* ── helpers ── */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function svg(file, attrs) {
  let s = fs.readFileSync(path.join(ROOT, 'static/brand', file), 'utf8');
  s = s.replace(/#111111/g, 'currentColor').replace(/<title>.*?<\/title>/, '').replace(/role="img" aria-label="[^"]*"/, 'aria-hidden="true" focusable="false"');
  s = s.replace(/\s(width|height)="[^"]*"/, '').replace(/\s(width|height)="[^"]*"/, '');
  return attrs ? s.replace('<svg ', '<svg ' + attrs + ' ') : s;
}
const LOGO = a => svg('JB-Lux-Designs-logo-black.svg', a);
const MONO = a => svg('JB-Lux-Designs-monogram-black.svg', a);
const MARK = a => svg('JB-Lux-Designs-favicon-JB-black.svg', a);
/* urls: absolute on the live site; relative (with index.html) in the review preview */
/* images are served with a one-year immutable cache, so every /img/ URL carries a short content hash:
   replacing a photo under the same file name then changes its URL and browsers fetch the new one */
const _vh = {};
function ver(p) {
  if (!/^\/img\/.+\.(webp|jpg|png|svg|mp4|webm)$/.test(p)) return p;
  if (!(p in _vh)) { try { _vh[p] = require('crypto').createHash('md5').update(require('fs').readFileSync(require('path').join(__dirname, 'static', p))).digest('hex').slice(0, 8); } catch (e) { _vh[p] = ''; } }
  return _vh[p] ? p + '?v=' + _vh[p] : p;
}
function urlFor(depth) {
  return function (p) {
    if (!PREVIEW) return ver(p);
    const [pathname, hash] = p.split('#');
    let rel = pathname.replace(/^\//, '');
    if (pathname.endsWith('/')) rel += 'index.html';
    return '../'.repeat(depth) + rel + (ver(pathname) !== pathname ? ver(pathname).slice(pathname.length) : '') + (hash ? '#' + hash : '');
  };
}
function pic(u, name, sizes, alt, opts = {}) {
  const m = images[name]; if (!m) throw new Error('missing image ' + name);
  const top = Math.max(...m.sizes); // size keys are the long edge; srcset needs real widths
  const srcset = m.sizes.slice().sort((a, b) => a - b).map(w => `${u(`/img/${name}-${w}.webp`)} ${Math.round(m.w * w / top)}w`).join(', ');
  const big = Math.max(...m.sizes);
  return `<img src="${u(`/img/${name}-${big}.webp`)}"${m.sizes.length > 1 ? ` srcset="${srcset}" sizes="${sizes}"` : ''} alt="${esc(alt)}" width="${m.w}" height="${m.h}"${opts.eager ? ' fetchpriority="high"' : ' loading="lazy"'}>`;
}
const arrow = '<span class="arr" aria-hidden="true">→</span>';
const place = p => p.location || '';
const year = p => p.year || '';

/* ── shared chrome ── */
function chrome(u, here) {
  const nav = [['Home', '/'], ['Projects', '/projects/'], ['Studio', '/about/'], ['Contact', '/contact/']];
  return `
<div class="controls">
  <a class="pill pill-ink label" href="${u('/contact/')}">Get in touch ${arrow}</a>
  <button class="pill pill-light label" id="menu-btn" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
</div>
<div class="menu" id="menu" aria-hidden="true" inert>
  <div class="menu-in pad">
    <div class="menu-mark">${MONO()}</div>
    <nav aria-label="Menu">
      ${nav.map(([t, h], i) => `<span class="mask"><span><a href="${u(h)}"${h === here ? ' aria-current="page"' : ''}><span class="t">${t}</span> <span class="label num">0${i + 1}</span></a></span></span>`).join('\n      ')}
    </nav>
    <div class="menu-side">
      <span class="label">Info</span>
      <span>${site.email}<br>${site.city}</span>
      ${site.instagram ? `<span class="label">Follow</span>
      <span>${site.instagram}</span>` : ''}
    </div>
    <div class="menu-foot label"><span>© ${new Date().getFullYear()} ${site.legal}</span><span>${site.city}</span></div>
  </div>
</div>`;
}
function topbar(u, here) {
  const nav = [['Projects', '/projects/'], ['Studio', '/about/'], ['Contact', '/contact/']];
  return `
<header class="top pad">
  <a class="top-logo" href="${u('/')}" aria-label="${site.name}, home">${LOGO('class="logo"')}${MONO('class="mono"')}</a>
  <nav class="top-nav label" aria-label="Primary">${nav.map(([t, h]) => `<a href="${u(h)}"${here.startsWith(h) ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
</header>`;
}
function cta(u, line1 = 'Let’s give your', line2 = 'vision life.') {
  return `
  <section class="close pad" id="contact">
    <h2 class="mega ruled rise"><span class="mask"><span>${line1}</span></span><span class="mask"><span>${line2}</span></span></h2>
    <div class="close-row">
      <a class="pill pill-ink label" href="${u('/contact/')}">Tell us about your project ${arrow}</a>
      <span class="mail"><span id="email-cta">${site.email}</span><button class="copy label" data-target="email-cta" type="button">Copy</button></span>
    </div>
  </section>`;
}
function footer(u) {
  return `
<footer class="foot pad">
  <div class="foot-grid">
    <div class="foot-art">
      ${MARK()}
    </div>
    <div class="foot-nav">
      <span class="label mute">Navigation</span>
      <nav aria-label="Footer"><a href="${u('/')}">Home</a><a href="${u('/projects/')}">Projects</a><a href="${u('/about/')}">Studio</a><a href="${u('/contact/')}">Contact</a></nav>
    </div>
    <div class="foot-info">
      <span class="label mute">Info</span>
      <dl><dt>E:</dt><dd>${site.email}</dd><dt>L:</dt><dd>${site.city}</dd>${site.phone ? `<dt>P:</dt><dd>${site.phone}</dd>` : ''}</dl>
      ${site.instagram ? `<span class="label mute" style="margin-top:20px">Follow</span>
      <span>${site.instagram}</span>` : ''}
    </div>
    <div class="foot-base label">
      <span>© ${new Date().getFullYear()} ${site.legal}</span>
      <a href="#top">Back to top ↑</a>
    </div>
  </div>
</footer>`;
}
function card(u, p, sizes, extra = '') {
  const cap = `<div class="cap label"><span class="num">${p.no}</span><span>${esc(p.name)}</span><span class="num">${year(p)}</span><span class="t2">${esc(p.type)}${p.location ? ', ' + esc(p.location) : ''}</span></div>`;
  if (p.soon) return `<div class="card soon reveal" data-cat="${p.cat}"><div class="frame"><div class="label">${MONO()}Photos to come</div></div>${cap}</div>`;
  return `<a class="card reveal${extra}" data-cat="${p.cat}" href="${u(`/projects/${p.slug}/`)}"><div class="frame">${pic(u, 'c-' + p.slug, sizes, `${p.name}, ${p.type.toLowerCase()}`)}</div>${cap}</a>`;
}

/* ── pages ── */
function home(u) {
  const f = site.featured.map(s => bySlug[s]);
  const homeImg = { 'courtshire': ['h-courtshire', ''], 'bonita-casita': ['hero-built-tall', ' s'], 'mill-creek': ['h-mill-creek', ' s'], 'purdue-avenue': ['h-purdue-mud', ''], 'knockouts-hair-salon': ['h-knockouts', ''], 'winton-street': ['h-winton', ' s'] };
  const hc = (p, i) => {
    const [img, cls] = homeImg[p.slug] || ['c-' + p.slug, ''];
    return `<a class="card${cls} reveal" href="${u(`/projects/${p.slug}/`)}">
          <div class="frame">${pic(u, img, '(max-width:720px) 80vw, 50vw', `${p.name}, ${p.type.toLowerCase()}`)}</div>
          <div class="cap label"><span class="num">0${i + 1}</span><span>${esc(p.name)}</span><span class="num">${year(p)}</span><span class="t2">${esc(p.type)}${p.location ? ', ' + esc(p.location) : ''}</span></div>
        </a>`;
  };
  const left = f.filter((_, i) => i % 2 === 0), right = f.filter((_, i) => i % 2 === 1);
  const svc = site.services.map((s, i) => {
    const ex = s.examples.map(x => bySlug[x]);
    const thumbs = (ex.length ? ex.slice(0, 2).map(p => 'c-' + p.slug) : ['c-mill-creek']).map(n => `<img src="${u(`/img/${n}-320.webp`)}" alt="" loading="lazy" width="320" height="213">`).join('');
    const go = ex.length ? `<a class="svc-go" href="${u(`/projects/${ex[0].slug}/`)}">${ex.slice(0, 2).map(p => esc(p.short)).join(', ')} →</a>` : `<a class="svc-go" href="${u('/projects/')}">View projects →</a>`;
    return `<li class="svc-row"><span class="svc-thumbs">${thumbs}</span><span class="svc-name">${esc(s.name)}<sup class="num">0${i + 1}</sup></span>${go}</li>`;
  }).join('\n      ');
  const fp = bySlug['bonita-casita'];
  return `
<div class="loader" id="loader" aria-hidden="true">
  ${LOGO('class="ld-logo"')}
  <div class="ld-foot pad"><span class="label">Architectural design<br>${site.city}</span><span class="num" id="ld-n">100</span></div>
  <div class="ld-rule"></div>
</div>
${chrome(u, '/')}
<main id="top">
  <section class="hero" aria-label="Featured project">
    <div class="hero-media" id="hero-media">
      <picture>
        <source media="(max-width: 720px)" srcset="${u('/img/hero-built-tall-1000.webp')}">
        ${pic(u, 'hero-built', '100vw', 'Completed pool house in dark standing-seam metal and board-and-batten, with full-height glass, beside a blue tiled pool and spa with striped loungers', { eager: true })}
      </picture>
    </div>
    <div class="hero-shade" id="hero-shade"></div>
    <div class="hero-top pad">
      <a class="hero-logo" href="${u('/')}" aria-label="${site.name}, home">${LOGO('class="logo"')}${MONO('class="mono"')}</a>
      <nav class="hero-nav label" aria-label="Primary"><a href="${u('/projects/')}">Projects</a><a href="${u('/about/')}">Studio</a><a href="#services">Services</a></nav>
    </div>
    <div class="hero-meta pad label">
      <span>Featured project</span>
      <span>${esc(fp.name)}</span>
      <span class="num">${year(fp)}</span>
      <a href="${u(`/projects/${fp.slug}/`)}">View project ${arrow}</a>
    </div>
    <div class="hero-bottom pad">
      <p class="state"><span class="mask"><span>Architectural design for homes</span></span><span class="mask"><span>and small businesses across</span></span><span class="mask"><span>Dallas–Fort Worth.</span></span></p>
      <span class="label">Scroll</span>
    </div>
  </section>

  <section class="studio pad" id="studio">
    <div class="studio-grid">
      <h2 class="mega ruled rise"><span class="mask"><span>Residential +</span></span><span class="mask"><span>light commercial</span></span></h2>
      <div class="axons">
        ${[['Existing house', 'the existing single-story house with the roof area to be removed outlined'], ['Roof removed', 'the roof lifted away to open the plan below'], ['Second story added', 'the new second story lowered onto the existing walls'], ['Complete', 'the finished two-story house']].map(([t, alt], i) => `<figure class="axon reveal"><div class="frame">${pic(u, 'ax-' + (i + 1), '(max-width:720px) 50vw, 25vw', 'Mill Creek axonometric, step ' + (i + 1) + ': ' + alt)}</div><figcaption class="label"><span class="num">0${i + 1}</span><span>${t}</span></figcaption></figure>`).join('\n        ')}
      </div>
      <span class="studio-tag label">Our studio</span>
      <div class="studio-copy">
        <p>Jason Bernal founded JB Lux Designs in ${site.founded} after years of healthcare, commercial and residential work. The studio prepares permit sets, renovations, additions, millwork and patio covers for homeowners and contractors, and sees each project through permit approval.</p>
        <a class="pill pill-ink label" href="${u('/about/')}">About the studio ${arrow}</a>
      </div>
    </div>
  </section>

  <section class="works pad" id="work">
    <div class="works-head ruled">
      <h2 class="mega rise"><span class="mask"><span>Featured</span></span><span class="mask"><span>works</span></span></h2>
      <span class="count label num">0${f.length} of ${count.all} projects</span>
    </div>
    <div class="wgrid">
      <div class="wcol l">
        ${left.map((p, i) => hc(p, i * 2)).join('\n        ')}
      </div>
      <div class="wcol r">
        ${right.map((p, i) => hc(p, i * 2 + 1)).join('\n        ')}
      </div>
    </div>
    <div class="works-foot"><a class="pill pill-ink label" href="${u('/projects/')}">View all ${count.all} projects ${arrow}</a></div>
  </section>

  <section class="svc pad" id="services" aria-labelledby="svc-h">
    <div class="svc-top"><span class="label" id="svc-h">Services</span></div>
    <ul class="svc-list" id="svc-list">
      ${svc}
    </ul>
  </section>
${cta(u)}
</main>
${footer(u)}`;
}

function projectsPage(u) {
  return `
${chrome(u, '/projects/')}
${topbar(u, '/projects/')}
<main id="top">
  <section class="page-head pad">
    <div class="head-row ruled">
      <h1 class="mega rise"><span class="mask"><span>Projects</span></span></h1>
      <span class="count label num" id="p-count">${count.all} projects</span>
    </div>
    <div class="filters label" role="group" aria-label="Filter projects">
      <button type="button" data-f="all" aria-pressed="true">All<span class="num">${count.all}</span></button>
      <button type="button" data-f="res" aria-pressed="false">Residential<span class="num">${count.res}</span></button>
      <button type="button" data-f="com" aria-pressed="false">Commercial<span class="num">${count.com}</span></button>
    </div>
  </section>
  <section class="pgrid pad" aria-label="All projects">
    ${projects.map(p => card(u, p, '(max-width:720px) 100vw, (max-width:900px) 50vw, 33vw')).join('\n    ')}
  </section>
${cta(u)}
</main>
${footer(u)}`;
}

function gallery(u, p) {
  const items = p.gallery.map((g, i) => ({ ...g, name: `p-${p.slug}-${String(i + 1).padStart(2, '0')}` })).slice(1).filter(it => !it.skip); // first image is the lead; skip hides an image without renumbering files
  const shape = it => { const m = images[it.name]; return m.w / m.h >= 1.15 ? 'L' : 'P'; };
  const out = []; let flip = false;
  for (let i = 0; i < items.length; i++) {
    const a = items[i], b = items[i + 1];
    if (a.full) { out.push([a, 'full']); continue; }
    if (shape(a) === 'P' && b && shape(b) === 'P' && !b.full) { out.push([a, 'half-l'], [b, 'half-r']); i++; }
    else if (shape(a) === 'P') { out.push([a, flip ? 'solo-r' : 'solo-l']); flip = !flip; }
    else { out.push([a, flip ? 'wide-r' : 'wide-l']); flip = !flip; }
  }
  return out.map(([it, cls], i) => {
    const m = images[it.name], big = Math.max(...m.sizes);
    return `<figure class="g ${cls}${it.kind === 'drawing' ? ' drawing' : ''}">
      <button class="zoom" type="button" data-full="${u(`/img/${it.name}-${big}.webp`)}" data-cap="${esc(it.cap)}" aria-label="Enlarge: ${esc(it.cap)}">${pic(u, it.name, cls === 'full' ? '100vw' : cls.startsWith('wide') ? '(max-width:900px) 100vw, 75vw' : '(max-width:900px) 100vw, 50vw', `${p.name}: ${it.cap.toLowerCase()}`)}</button>
      <figcaption class="label"><span>${esc(it.cap)}</span><span class="num">${String(i + 2).padStart(2, '0')}</span></figcaption>
    </figure>`;
  }).join('\n    ');
}
function seqHtml(u, s) {
  return `<section class="seq" id="seq" style="--steps:${s.steps.length}" data-base="${u('/img/' + s.dir + '/000.webp').replace(/000\.webp(\?.*)?$/, '')}" data-frames="${s.frames}" data-steps="${s.steps.map(x => x.at).join(',')}" aria-label="${esc(s.title)}">
    <div class="seq-pin pad">
      <div class="seq-text">
        <span class="label mute">${esc(s.title)}</span>
        <ol class="seq-steps">${s.steps.map((x, i) => `<li${i ? '' : ' class="on"'}><span class="label num">0${i + 1}</span><span class="seq-t">${esc(x.t)}</span><span class="seq-d">${esc(x.d)}</span></li>`).join('')}</ol>
        <div class="seq-bar" aria-hidden="true"><span id="seq-fill"></span></div>
      </div>
      <div class="seq-stage"><canvas id="seq-canvas" width="${s.w}" height="${s.h}" role="img" aria-label="${esc(s.label || 'Animated axonometric')}: ${esc(s.steps.map(x => x.t).join(', '))}"></canvas><img id="seq-still" src="${u('/img/' + s.dir + '/' + String(s.frames - 1).padStart(3, '0') + '.webp')}" alt="${esc(s.alt || 'Axonometric of the completed plan')}" width="${s.w}" height="${s.h}" loading="lazy"></div>
    </div>
  </section>`;
}
function beforeAfter(u, p) {
  if (!p.ba) return '';
  const rows = p.ba.filter(r => !r.skip).map((r, i) => {
    const base = `ba-${p.slug}-${String(i + 1).padStart(2, '0')}`;
    const a = r.a || base + '-a', b = r.b || base + '-b';
    if (r.slider) return `<div class="ba-pair ba-slide">
      <span class="label">${esc(r.t)}<br><span class="ba-hint">Drag to compare</span></span>
      <div class="cmp${r.drawing ? ' ink' : ''}" style="--p:50%;--ar:${(images[a].w / images[a].h).toFixed(4)}">
        ${pic(u, a, '(max-width:900px) 100vw, 66vw', `${p.name}, ${r.t.toLowerCase()}: after`)}
        <div class="cmp-b" aria-hidden="true">${pic(u, b, '(max-width:900px) 100vw, 66vw', `${p.name}, ${r.t.toLowerCase()}: before`)}</div>
        <span class="cmp-line" aria-hidden="true"><span class="cmp-knob"></span></span>
        <span class="cmp-tag cmp-tb label">${esc(r.tb || 'Before')}</span><span class="cmp-tag cmp-ta label">${esc(r.ta || 'After')}</span>
        <input class="cmp-r" type="range" min="0" max="100" step="0.1" value="50" aria-label="${esc(r.t)}: slide between before and after">
      </div>
    </div>`;
    return `<div class="ba-pair">
      <span class="label">${esc(r.t)}</span>
      <figure>${pic(u, b, '(max-width:900px) 50vw, 33vw', `${p.name}, ${r.t.toLowerCase()}: before`)}<figcaption class="label">${r.lb || 'Before'}</figcaption></figure>
      <figure>${pic(u, a, '(max-width:900px) 50vw, 42vw', `${p.name}, ${r.t.toLowerCase()}: ${(r.la || 'After').toLowerCase()}`)}<figcaption class="label">${r.la || 'After'}</figcaption></figure>
    </div>`;
  }).join('\n    ');
  return `
  <section class="ba pad" aria-labelledby="ba-h">
    <div class="ba-head ruled"><h2 id="ba-h">${p.ba.some(r => r.la) ? 'Existing and proposed' : 'Before and after'}</h2></div>
    ${rows}
  </section>`;
}
function projectPage(u, p) {
  const next = live[(live.indexOf(p) + 1) % live.length];
  const lead = p.gallery[0];
  return `
${chrome(u, '/projects/')}
${topbar(u, '/projects/')}
<main id="top">
  <section class="page-head pad">
    <a class="back label" href="${u('/projects/')}"><span aria-hidden="true">←</span> All projects</a>
    <h1 class="proj-title ruled rise"><span class="mask"><span>${esc(p.name)}</span></span></h1>
    <dl class="facts label">
      <div><dt>Type</dt><dd>${esc(p.type)}</dd></div>
      ${p.location ? `<div><dt>Location</dt><dd>${esc(p.location)}</dd></div>` : ''}
      ${p.year ? `<div><dt>Year</dt><dd class="num">${p.year}</dd></div>` : ''}
      ${p.scope ? `<div><dt>Scope</dt><dd>${esc(p.scope)}</dd></div>` : ''}
    </dl>
  </section>
  <figure class="proj-lead pad g${lead.kind === 'drawing' ? ' drawing' : ''}">
    <button class="zoom" type="button" data-full="${u(`/img/p-${p.slug}-01-${Math.max(...images[`p-${p.slug}-01`].sizes)}.webp`)}" data-cap="${esc(lead.cap)}" aria-label="Enlarge: ${esc(lead.cap)}">${pic(u, `p-${p.slug}-01`, '100vw', `${p.name}: ${lead.cap.toLowerCase()}`, { eager: true })}</button>
    <figcaption class="label"><span>${esc(lead.cap)}</span><span class="num">01</span></figcaption>
  </figure>
  ${p.summary || p.credits ? `<section class="proj-body pad grid">
    <span class="label">${p.summary ? 'About the project' : 'Credits'}</span>
    ${p.summary ? `<div class="proj-text">${[].concat(p.summary).map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}${p.credits ? `<dl class="credits label">${p.credits.map(c => `<div><dt>${esc(c.role)}</dt><dd>${esc(c.name)}</dd></div>`).join('')}</dl>` : ''}
  </section>` : '<div class="proj-gap"></div>'}
  ${p.sequence && !p.sequence.end ? seqHtml(u, p.sequence) : ''}
  ${p.gallery.length > 1 ? `<section class="gallery pad" aria-label="Gallery">
    ${gallery(u, p)}
  </section>` : ''}
${p.build ? `
  <section class="details build pad" aria-labelledby="build-h">
    <div class="ba-head ruled"><h2 id="build-h">During construction</h2></div>
    <div class="build-grid">${p.build.map((x, i) => { const n = x.img, m = images[n]; return `<figure class="g det reveal"><button class="zoom" type="button" data-full="${u('/img/' + n + '-' + Math.max(...m.sizes) + '.webp')}" data-cap="${esc(x.t)}" aria-label="Enlarge: ${esc(x.t)}">${pic(u, n, '(max-width:720px) 50vw, 25vw', p.name + ' under construction: ' + x.t.toLowerCase())}</button><figcaption class="label"><span>${esc(x.t)}</span><span class="num">C${i + 1}</span></figcaption></figure>`; }).join('')}</div>
  </section>` : ''}
${p.details ? `
  <section class="details pad" aria-labelledby="det-h">
    <div class="ba-head ruled"><h2 id="det-h">Details</h2></div>
    <div class="det-grid">${p.details.map((x, i) => { const n = x.img || ('d-' + p.slug + '-' + String(i + 1).padStart(2, '0')), m = images[n]; return `<figure class="g det${x.kind === 'drawing' ? ' drawing' : ''} reveal"><button class="zoom" type="button" data-full="${u('/img/' + n + '-' + Math.max(...m.sizes) + '.webp')}" data-cap="${esc(x.t)}" aria-label="Enlarge: ${esc(x.t)}">${pic(u, n, '(max-width:720px) 100vw, 50vw', p.name + ': ' + x.t.toLowerCase())}</button><figcaption class="label"><span>${esc(x.t)}</span><span class="num">D${i + 1}</span></figcaption><p class="det-d">${esc(x.d)}</p></figure>`; }).join('')}</div>
  </section>` : ''}
${beforeAfter(u, p)}
${p.film ? `
  <section class="film" id="film" aria-label="${esc(p.film.t)}">
    <div class="film-pin">
      <div class="film-text pad"><p class="label">${esc(p.film.t)}</p><p class="film-sub">${esc(p.film.d || '')}</p></div>
      <div class="film-stage"><video class="film-v" muted playsinline loop preload="none" poster="${u('/img/' + p.film.poster)}" data-src="${u('/img/' + p.film.src)}" data-webm="${u('/img/' + p.film.src.replace(/\.mp4$/, '.webm'))}" aria-label="${esc(p.name)}: ${esc(p.film.t.toLowerCase())}"></video></div>
    </div>
  </section>` : ''}
${p.sequence && p.sequence.end ? seqHtml(u, p.sequence) : ''}
  <a class="next pad" href="${u(`/projects/${next.slug}/`)}">
    <div class="ruled"><span><span class="label">Next project</span><span class="nm">${esc(next.name)}</span></span><span class="arr" aria-hidden="true">→</span></div>
  </a>
</main>
<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Image viewer" hidden>
  <div class="lb-bar label"><span id="lb-pos" class="num"></span><button type="button" id="lb-close" class="label">Close</button></div>
  <div class="lb-stage"><img id="lb-img" alt=""></div>
  <div class="lb-foot label"><span id="lb-cap"></span><span class="lb-nav"><button type="button" id="lb-prev" class="label" aria-label="Previous image">←</button><button type="button" id="lb-next" class="label" aria-label="Next image">→</button></span></div>
</div>
${footer(u)}`;
}

function aboutPage(u) {
  const rows = site.services.map((s, i) => {
    const ex = s.examples.map(x => bySlug[x]);
    return `<li><span class="n num">0${i + 1}</span><span class="nm">${esc(s.name)}</span><span class="eg">${ex.length ? ex.map(p => `<a class="ulink" href="${u(`/projects/${p.slug}/`)}">${esc(p.short)}</a>`).join(', ') : ''}</span></li>`;
  }).join('\n      ');
  return `
${chrome(u, '/about/')}
${topbar(u, '/about/')}
<main id="top">
  <section class="page-head pad">
    <div class="head-row ruled"><h1 class="mega rise"><span class="mask"><span>Studio</span></span></h1><span class="count label">${site.city}</span></div>
  </section>
  <section class="about pad grid">
    <span class="label k">About</span>
    <p class="state">Jason Bernal founded JB Lux Designs in ${site.founded}, bringing a background in healthcare, commercial and residential architecture to homes and small businesses across Dallas–Fort Worth.</p>
    <div class="about-text">
      <p>That background ranges from managing design coordination on multi-phase healthcare projects to preparing the documents clients need for permit approval.</p>
      <p>The studio works directly with homeowners and with contractors. Each project starts from field measurements of the existing building and a check of the local code, then is modeled in 3D so you can see the design in drawings and renderings before it goes to permit. The result is a clear, complete drawing set that a contractor can price and build from.</p>
    </div>
    <dl class="about-facts label">
      <div><dt>Founded</dt><dd class="num">${site.founded}</dd></div>
      <div><dt>Founder</dt><dd>${site.principal}</dd></div>
      <div><dt>Based in</dt><dd>${site.city}</dd></div>
      <div><dt>Working across</dt><dd>Dallas–Fort Worth</dd></div>
    </dl>
    <figure class="portrait">${pic(u, 'portrait', '(max-width:900px) 420px, 33vw', 'Jason Bernal, founder of JB Lux Designs')}<figcaption class="label"><span>${site.principal}</span><span>Founder</span></figcaption></figure>
  </section>
  <section class="slist pad" id="services" aria-labelledby="sl-h">
    <div class="head-row ruled"><h2 class="mega rise" id="sl-h"><span class="mask"><span>Services</span></span></h2><span class="count label">Residential · Light commercial</span></div>
    <ul>
      ${rows}
    </ul>
  </section>
${cta(u)}
</main>
${footer(u)}`;
}

function contactPage(u) {
  return `
${chrome(u, '/contact/')}
${topbar(u, '/contact/')}
<main id="top">
  <section class="page-head pad">
    <div class="head-row ruled"><h1 class="mega rise"><span class="mask"><span>Contact</span></span></h1><span class="count label">${site.city}</span></div>
  </section>
  <section class="contact pad grid">
    <div class="c-info">
      <div><span class="label">Email</span><span class="big"><span id="email-c">${site.email}</span> <button class="copy label" data-target="email-c" type="button">Copy</button></span></div>
      <div><span class="label">Studio</span><span>${site.legal}<br>${site.city}</span></div>
      ${site.phone ? `<div><span class="label">Phone</span><span>${site.phone}</span></div>` : ''}
      ${site.instagram ? `<div><span class="label">Follow</span><span>${site.instagram}</span></div>` : ''}
    </div>
    <form class="form" id="contact-form" name="contact" method="POST" action="${u('/contact/thanks/')}" data-netlify="true" netlify-honeypot="bot-field"${PREVIEW ? ` data-preview="1" data-to="${site.email}"` : ''}>
      <input type="hidden" name="form-name" value="contact">
      <p class="hp"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <div class="two">
        <div class="field"><label class="label" for="f-name">Name</label><input id="f-name" name="name" type="text" autocomplete="name" required></div>
        <div class="field"><label class="label" for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
      </div>
      <div class="field"><label class="label" for="f-type">Project type</label>
        <select id="f-type" name="project-type" required>
          <option value="" selected disabled>Choose one</option>
          ${site.projectTypes.map(t => `<option>${esc(t)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label class="label" for="f-msg">Message</label><textarea id="f-msg" name="message" rows="6" placeholder="Where is the project, and what are you hoping to build?" required></textarea></div>
      <button class="pill pill-ink label" type="submit">Send message ${arrow}</button>
      <p class="form-note" id="form-note" role="status">Your message goes straight to ${site.email}.</p>
    </form>
  </section>
</main>
${footer(u)}`;
}

function simplePage(u, here, title, body, links) {
  return `
${chrome(u, here)}
${topbar(u, here)}
<main id="top">
  <section class="simple pad">
    <h1 class="mega ruled rise"><span class="mask"><span>${title}</span></span></h1>
    <p>${body}</p>
    <div class="close-row">${links.map(([t, h], i) => `<a class="pill ${i ? 'pill-light' : 'pill-ink'} label" href="${u(h)}">${t} ${arrow}</a>`).join('')}</div>
  </section>
</main>
${footer(u)}`;
}

/* ── document shell ── */
function page({ route, depth, title, description, body, ogImage, home: isHome, noindex }) {
  const u = urlFor(depth);
  const content = body(u);
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&display=swap">`;
  const canonical = site.url + route;
  let html;
  if (PREVIEW) {
    const inner = `${fonts}\n<style>${css}</style>\n${content}\n<script>${lenis}</script>\n<script>${js}</script>`;
    html = isHome
      ? `<title>${site.name}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="description" content="${esc(description)}">\n${inner}\n`
      : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>${esc(title)}</title>\n</head>\n<body>\n${inner}\n</body>\n</html>\n`;
  } else {
    const ld = isHome ? `\n<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'ProfessionalService', name: site.name, legalName: site.legal, url: site.url, email: site.email, image: site.url + '/img/og.jpg', founder: { '@type': 'Person', name: site.principal }, foundingDate: site.founded, address: { '@type': 'PostalAddress', addressLocality: 'Dallas', addressRegion: 'TX', addressCountry: 'US' }, areaServed: 'Dallas–Fort Worth' })}</script>` : '';
    html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${site.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.url}${ogImage || '/img/og.jpg'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#111111">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/favicon-180.png">
${fonts}
<link rel="stylesheet" href="/css/site.css">
${isHome ? `<script>try{if(sessionStorage.getItem('jbl-seen'))document.documentElement.classList.add('seen');else sessionStorage.setItem('jbl-seen','1')}catch(e){}</script>` : ''}${ld}
</head>
<body>
${content}
<script src="/js/lenis.min.js" defer></script>
<script src="/js/site.js" defer></script>
</body>
</html>
`;
  }
  const file = route.endsWith('/') ? path.join(OUT, route, 'index.html') : path.join(OUT, route);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return route;
}

/* ── build ── */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
(function copy(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'brand') continue;
    if (PREVIEW && (e.name === 'css' || e.name === 'js' || e.name.startsWith('favicon'))) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); } else fs.copyFileSync(s, d);
  }
})(path.join(ROOT, 'static'), OUT);

const routes = [];
routes.push(page({ route: '/', depth: 0, home: true, title: `${site.name} | Architectural Design in ${site.city}`, description: site.description, body: home }));
routes.push(page({ route: '/projects/', depth: 1, title: `Projects | ${site.name}`, description: `${count.all} residential and light commercial projects by ${site.name}: renovations, additions, pool houses, patio covers and commercial interiors across Dallas–Fort Worth.`, body: projectsPage }));
for (const p of live) {
  routes.push(page({ route: `/projects/${p.slug}/`, depth: 2, title: `${p.name} | ${site.name}`, description: `${p.name}: ${p.type.toLowerCase()}${p.location && p.location !== 'Various' ? ' in ' + p.location + ', Texas' : ''}, designed by ${site.name}.`, ogImage: `/img/c-${p.slug}-1400.webp`, body: u => projectPage(u, p) }));
}
routes.push(page({ route: '/about/', depth: 1, title: `Studio | ${site.name}`, description: `${site.principal} founded ${site.name} in ${site.founded}. The studio prepares permit sets, renovations, additions, millwork and patio covers in ${site.city}.`, body: aboutPage }));
routes.push(page({ route: '/contact/', depth: 1, title: `Contact | ${site.name}`, description: `Start a project with ${site.name}. Email ${site.email} or send a message about your home, addition, renovation or commercial space.`, body: contactPage }));
page({ route: '/contact/thanks/', depth: 2, noindex: true, title: `Thank you | ${site.name}`, description: 'Your message has been sent.', body: u => simplePage(u, '/contact/', 'Thank you.', `Your message is on its way to ${site.email}. Jason will reply by email.`, [['Back to home', '/'], ['See the projects', '/projects/']]) });
page({ route: '/404.html', depth: 0, noindex: true, title: `Page not found | ${site.name}`, description: 'That page does not exist.', body: u => simplePage(u, '/404', 'Page not found.', 'That address does not match a page on this site. It may have moved when the site was rebuilt.', [['Back to home', '/'], ['See the projects', '/projects/']]) });

if (!PREVIEW) {
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(r => `  <url><loc>${site.url}${r}</loc></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
}
console.log(`${PREVIEW ? 'preview' : 'dist'}: ${routes.length + 2} pages`);
