import * as maplibregl from '../vendor/maplibre/maplibre-gl.mjs';
import * as S from './services.js?v=6';

// ------------------------------------------------------------------ utilità
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="assets/icons.svg#i-${name}"/></svg>`;
const isMobile = () => matchMedia('(max-width: 767.98px)').matches;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const store = {
  get(key, def) { try { return JSON.parse(localStorage.getItem(`pm.${key}`)) ?? def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem(`pm.${key}`, JSON.stringify(val)); } catch { /* storage non disponibile */ } },
};

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
async function copy(text, msg = 'Copiato negli appunti') {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast('Impossibile copiare'); }
}
const placeKey = (p) => p.id || `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
const slim = (p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, key: p.key, value: p.value, cat: p.cat, icon: p.icon, addr: p.addr, short: p.short });

// ------------------------------------------------------------------ stato
const STYLES = {
  liberty: { label: 'Predefinita', url: 'https://tiles.openfreemap.org/styles/liberty', swatch: 'linear-gradient(135deg,#f2efe9 0 45%,#cde3b8 45% 60%,#aad3df 60%)' },
  bright: { label: 'Chiara', url: 'https://tiles.openfreemap.org/styles/bright', swatch: 'linear-gradient(135deg,#f8f4f0 0 45%,#d8e8c8 45% 60%,#a0c8f0 60%)' },
  positron: { label: 'Minimal', url: 'https://tiles.openfreemap.org/styles/positron', swatch: 'linear-gradient(135deg,#fafaf8 0 45%,#e8e8e8 45% 60%,#d4dadc 60%)' },
};

const state = {
  view: null,            // null | home | results | place | directions | saved | recent | about
  stack: [],             // viste precedenti per il pulsante indietro
  results: [], resultsTitle: '', category: null,
  place: null, placeTab: 'overview',
  dir: { from: null, to: null, mode: 'car', routes: [], times: {}, sel: 0 },
  styleId: store.get('style', 'liberty'),
  myPos: null,
  sheet: 'peek',
};
if (!STYLES[state.styleId]) state.styleId = 'liberty';

// ------------------------------------------------------------------ mappa
const map = new maplibregl.Map({
  container: 'map',
  style: STYLES[state.styleId].url,
  center: [9.19, 45.4642],
  zoom: 13,
  hash: 'map',
  attributionControl: false,
  dragRotate: true,
  maxPitch: 60,
});
map.addControl(new maplibregl.AttributionControl({
  compact: false,
  customAttribution: 'Ricerca <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a> · Percorsi <a href="https://routing.openstreetmap.de" target="_blank" rel="noopener">OSRM / FOSSGIS</a>',
}), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 80 }), 'bottom-right');

const pinSVG = `<svg viewBox="0 0 27 43"><path d="M13.5 0C6 0 0 6 0 13.4 0 23.5 13.5 43 13.5 43S27 23.5 27 13.4C27 6 21 0 13.5 0z" fill="var(--pin)"/><path d="M13.5 1C6.6 1 1 6.5 1 13.4c0 9.2 11.3 26.3 12.5 28.1C14.7 39.7 26 22.6 26 13.4 26 6.5 20.4 1 13.5 1z" fill="none" stroke="rgba(0,0,0,.25)"/><circle cx="13.5" cy="13.5" r="5" fill="#8a1c1f" opacity=".85"/></svg>`;
function makePin() { const el = document.createElement('div'); el.className = 'pin drop'; el.innerHTML = pinSVG; return el; }
const placeMarker = new maplibregl.Marker({ element: makePin(), anchor: 'bottom' });
const originEl = document.createElement('div');
originEl.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #202124;box-shadow:0 1px 2px rgba(0,0,0,.4)';
const originMarker = new maplibregl.Marker({ element: originEl });
const meEl = document.createElement('div'); meEl.className = 'me-dot';
const meMarker = new maplibregl.Marker({ element: meEl });

function emptyFC() { return { type: 'FeatureCollection', features: [] }; }
function resultsFC() {
  return { type: 'FeatureCollection', features: state.results.map((p, i) => ({ type: 'Feature', id: i, properties: { i }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) };
}
function routesFC() {
  const { routes, sel } = state.dir;
  return {
    type: 'FeatureCollection',
    features: routes.map((r, i) => ({ type: 'Feature', properties: { sel: i === sel ? 1 : 0, i }, geometry: r.geometry }))
      .sort((a, b) => a.properties.sel - b.properties.sel),
  };
}

function addOverlays() {
  if (!map.getSource('results')) {
    map.addSource('results', { type: 'geojson', data: resultsFC() });
    map.addLayer({
      id: 'results-dots', type: 'circle', source: 'results',
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'hl'], false], 9, 7],
        'circle-color': '#e0393e', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
      },
    });
  }
  if (!map.getSource('route')) {
    map.addSource('route', { type: 'geojson', data: routesFC() });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['case', ['==', ['get', 'sel'], 1], '#174ea6', '#80868b'], 'line-width': 9 } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['case', ['==', ['get', 'sel'], 1], '#1a6fe0', '#bdc1c6'], 'line-width': 6 } });
  }
}
// Etichette in italiano: lo stile di base preferisce l'inglese (name_en).
function localizeLabels() {
  const it = ['coalesce', ['get', 'name:it'], ['get', 'name'], ['get', 'name_en']];
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue;
    const tf = map.getLayoutProperty(layer.id, 'text-field');
    if (tf && /name_en|name:latin/.test(JSON.stringify(tf))) map.setLayoutProperty(layer.id, 'text-field', it);
  }
}
map.on('style.load', () => { try { localizeLabels(); } catch (e) { console.warn('etichette', e); } addOverlays(); });
map.on('error', (e) => { if (String(e?.error?.message || '').includes('Failed to fetch')) console.warn('Tile non raggiungibili', e.error); });

function setResultsOnMap() {
  map.getSource('results')?.setData(state.view === 'directions' ? emptyFC() : resultsFC());
}
function setRouteOnMap() { map.getSource('route')?.setData(routesFC()); }

// Margini per centrare la mappa nella parte visibile (non coperta da pannello o foglio).
function mapPadding() {
  const w = window.innerWidth, h = window.innerHeight;
  let p;
  if (isMobile()) p = { top: 130, bottom: Math.min(h * 0.5, 420) + 20, left: 40, right: 40 };
  else {
    const panelOpen = panel.dataset.state === 'open';
    p = { top: 80, bottom: 60, left: panelOpen ? 8 + 72 + 408 + 40 : 120, right: 70 };
  }
  // non lasciare mai meno di 120 px di mappa utile
  const fix = (a, b, total) => { const over = p[a] + p[b] - (total - 120); if (over > 0) { const k = (total - 120) / (p[a] + p[b]); p[a] = Math.floor(p[a] * k); p[b] = Math.floor(p[b] * k); } void over; };
  fix('left', 'right', w); fix('top', 'bottom', h);
  return p;
}
function centerOffset() {
  const p = mapPadding();
  return [(p.left - p.right) / 2, (p.top - p.bottom) / 2];
}

// ------------------------------------------------------------------ elementi
const panel = $('#panel');
const content = $('#panel-content');
const sb = $('#searchbox');
const q = $('#q');
const sugBox = $('#suggestions');

// ------------------------------------------------------------------ pannello / foglio dal basso
function sheetGeometry() {
  const H = window.innerHeight - 64;
  return { H, full: 0, half: Math.max(0, H - Math.round(window.innerHeight * 0.5)), peek: Math.max(0, H - 200) };
}
function setSheet(name, offset) {
  state.sheet = name;
  const g = sheetGeometry();
  const y = offset ?? g[name] ?? g.peek;
  document.documentElement.style.setProperty('--sheet-y', `${y}px`);
  document.documentElement.style.setProperty('--sheet-visible', `${Math.min(g.H - y, window.innerHeight * 0.55)}px`);
  document.body.classList.toggle('sheet-full', isMobile() && y < 40);
}

function openPanel(view) {
  if (state.view && state.view !== view && !['home'].includes(state.view)) state.stack.push(state.view);
  state.view = view;
  panel.dataset.state = 'open';
  document.body.classList.add('panel-open');
  render();
}
function closePanel() {
  state.view = isMobile() ? 'home' : null;
  state.stack = [];
  if (isMobile()) { panel.dataset.state = 'open'; setSheet('peek'); } else { panel.dataset.state = 'closed'; document.body.classList.remove('panel-open'); }
  render();
}
function back() {
  const prev = state.stack.pop();
  if (state.view === 'place') { placeMarker.remove(); setPlaceParam(null); }
  const wasDirections = state.view === 'directions';
  if (wasDirections) clearRoute();
  if (!prev) { clearAll(); return; }
  state.view = prev;
  if (wasDirections) { setResultsOnMap(); if (prev === 'place' && state.place) placeMarker.setLngLat([state.place.lng, state.place.lat]).addTo(map); }
  if (prev === 'results') fitResults();
  render();
}

$('#panel-toggle').addEventListener('click', () => {
  const collapsed = panel.dataset.state === 'collapsed';
  panel.dataset.state = collapsed ? 'open' : 'collapsed';
  document.body.classList.toggle('panel-open', collapsed);
  $('#panel-toggle').setAttribute('aria-label', collapsed ? 'Comprimi il riquadro laterale' : 'Espandi il riquadro laterale');
});

// trascinamento del foglio su telefono
(function sheetDrag() {
  let startY = 0, startOff = 0, dragging = false, lastY = 0, lastT = 0, v = 0;
  const current = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-y')) || sheetGeometry().peek;
  panel.addEventListener('pointerdown', (e) => {
    if (!isMobile()) return;
    const grab = e.target.closest('.sheet-grab, .pane-head, .home-title');
    if (!grab || e.target.closest('button, a, input')) return;
    dragging = true; startY = lastY = e.clientY; lastT = performance.now(); startOff = current();
    panel.classList.add('dragging'); panel.setPointerCapture(e.pointerId);
  });
  panel.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const g = sheetGeometry();
    const off = Math.min(g.H - 72, Math.max(0, startOff + (e.clientY - startY)));
    const now = performance.now(); v = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
    setSheet(state.sheet, off);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false; panel.classList.remove('dragging');
    const g = sheetGeometry(); const off = current();
    let target;
    if (Math.abs(v) > 0.6) target = v > 0 ? (off > g.half ? 'peek' : 'half') : (off < g.half ? 'full' : 'half');
    else target = ['full', 'half', 'peek'].reduce((a, b) => (Math.abs(g[b] - off) < Math.abs(g[a] - off) ? b : a));
    setSheet(target);
  };
  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
  panel.querySelector('.sheet-grab').addEventListener('click', () => { if (isMobile()) setSheet(state.sheet === 'peek' ? 'half' : state.sheet === 'half' ? 'full' : 'peek'); });
})();

// ------------------------------------------------------------------ rendering
function render() {
  const v = state.view;
  sb.classList.toggle('active', !!(v && v !== 'home') || q.value.length > 0);
  sb.classList.toggle('back', !!(v && v !== 'home'));
  document.body.classList.toggle('dir-mode', v === 'directions');
  renderRailRecent();
  if (!v) { content.innerHTML = ''; return; }
  const views = { home: viewHome, results: viewResults, place: viewPlace, directions: viewDirections, saved: viewSaved, recent: viewRecent, about: viewAbout };
  content.innerHTML = views[v]();
  content.scrollTop = 0;
  if (v === 'directions') bindDirections();
}

function viewHome() {
  const recent = store.get('recent', []).slice(0, 5);
  return `
    <div class="home-only">
      <h2 class="home-title">Indicazioni stradali</h2>
      <div class="home-modes">
        ${S.MODES.map((m) => `<button class="home-mode" data-action="dir-mode" data-mode="${m.id}"><span class="bubble">${icon(m.icon)}</span>${m.label}</button>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="pane-section-title">Esplora nei dintorni</div>
      <div class="explore-grid">
        ${S.CATEGORIES.slice(0, 8).map((c) => `<button class="explore-item" data-action="category" data-cat="${c.id}"><span class="bubble">${icon(c.icon)}</span>${c.label}</button>`).join('')}
      </div>
      ${recent.length ? `<div class="divider"></div><div class="pane-section-title">Recenti</div>${listHTML(recent, 'recent')}` : ''}
    </div>`;
}

function listHTML(items, kind) {
  return `<ul class="results">${items.map((p, i) => `
    <li><button class="result" data-action="open-${kind}" data-i="${i}">
      <span class="result-ic">${icon(p.icon || 'location_on')}</span>
      <span class="result-main"><div class="result-title">${esc(p.name)}</div>
      <div class="result-sub">${esc([p.cat, p.short || p.addr].filter(Boolean).join(' · '))}</div>
      ${p.dist != null ? `<div class="result-sub">${S.fmtDistance(p.dist)}</div>` : ''}</span>
    </button></li>`).join('')}</ul>`;
}

function viewResults() {
  const n = state.results.length;
  return `<div class="pane-top"></div>
    <div class="results-head"><h2>${esc(state.resultsTitle)}</h2>${state.loading ? '' : `<span class="result-sub">${n === 1 ? '1 risultato' : `${n} risultati`}</span>`}</div>
    ${state.loading ? '<div class="spinner" role="progressbar" aria-label="Caricamento"></div>'
      : state.loadError ? '<p class="pane-note">Il servizio non risponde in questo momento. Riprova tra poco.</p>'
      : n ? listHTML(state.results, 'result')
        : '<p class="pane-note">Nessun risultato in quest\'area. Prova a spostare la mappa o a cercare un altro termine.</p>'}`;
}

function viewPlace() {
  const p = state.place;
  const t = p.tags || {};
  const saved = store.get('saved', []).some((s) => placeKey(s) === placeKey(p));
  const [a, b] = S.heroColors(p.icon);
  const backRow = state.stack.at(-1) === 'results'
    ? `<button class="info-row" data-action="back" style="min-height:40px">${icon('arrow_back')}<span class="txt">${esc(state.resultsTitle)}</span></button>` : '';
  const head = `
    <div class="hero" style="--hero-a:${a};--hero-b:${b}">${icon(p.icon || 'location_on')}</div>
    ${backRow}
    <div class="pane-head">
      <h1 class="pane-title">${esc(p.name)}</h1>
      <div class="pane-sub">${esc(p.cat || 'Luogo')}${t.cuisine ? ` · ${esc(t.cuisine.replace(/;/g, ', ').replace(/_/g, ' '))}` : ''}${t.wheelchair === 'yes' ? ` · <span title="Accessibile in sedia a rotelle" role="img" aria-label="Accessibile in sedia a rotelle">${icon('accessible')}</span>` : ''}</div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-action="tab" data-tab="overview" aria-selected="${state.placeTab === 'overview'}">Panoramica</button>
      <button class="tab" role="tab" data-action="tab" data-tab="info" aria-selected="${state.placeTab === 'info'}">Informazioni</button>
    </div>`;
  if (state.placeTab === 'info') {
    const rows = Object.entries(t).filter(([k]) => !k.startsWith('source')).sort(([x], [y]) => x.localeCompare(y));
    return `${head}${rows.length
      ? `<table class="tag-table">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`
      : '<p class="pane-note">Nessuna informazione aggiuntiva su OpenStreetMap per questo luogo.</p>'}`;
  }
  const actions = [
    ['directions', 'Indicazioni', 'directions', true],
    ['save', saved ? 'Salvato' : 'Salva', saved ? 'bookmark-fill' : 'bookmark'],
    ['nearby', 'Nelle vicinanze', 'explore_nearby'],
    ['share', 'Condividi', 'share'],
    ['copy-coords', 'Copia coordinate', 'content_copy'],
  ];
  const osmUrl = p.id ? `https://www.openstreetmap.org/${{ N: 'node', W: 'way', R: 'relation' }[p.id[0]]}/${p.id.slice(1)}` : null;
  const editUrl = p.id ? `https://www.openstreetmap.org/edit?${{ N: 'node', W: 'way', R: 'relation' }[p.id[0]]}=${p.id.slice(1)}`
    : `https://www.openstreetmap.org/note/new#map=19/${p.lat}/${p.lng}`;
  const site = t.website || t['contact:website'];
  const phone = t.phone || t['contact:phone'];
  const coords = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
  const rows = [
    p.addr && `<li><button class="info-row" data-action="copy" data-text="${esc(p.addr)}">${icon('location_on')}<span class="txt">${esc(p.addr)}</span></button></li>`,
    t.opening_hours && `<li><div class="info-row">${icon('schedule')}<span class="txt hours">${esc(t.opening_hours.replace(/;\s*/g, '\n'))}</span></div></li>`,
    site && `<li><a class="info-row" href="${esc(/^https?:/.test(site) ? site : `https://${site}`)}" target="_blank" rel="noopener nofollow">${icon('public')}<span class="txt">${esc(site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</span></a></li>`,
    phone && `<li><a class="info-row" href="tel:${esc(phone.replace(/\s/g, ''))}">${icon('call')}<span class="txt">${esc(phone)}</span></a></li>`,
    t.wheelchair === 'yes' && `<li><div class="info-row">${icon('accessible')}<span class="txt">Accessibile in sedia a rotelle</span></div></li>`,
    `<li><button class="info-row" data-action="copy" data-text="${coords}">${icon('trip_origin')}<span class="txt">${coords}</span></button></li>`,
    osmUrl && `<li><a class="info-row" href="${osmUrl}" target="_blank" rel="noopener">${icon('map')}<span class="txt">Vedi su OpenStreetMap</span></a></li>`,
  ].filter(Boolean).join('');
  return `${head}
    <div class="actions">${actions.map(([act, label, ic, primary]) => `
      <button class="action ${primary ? 'primary' : ''}" data-action="${act}"><span class="bubble">${icon(ic)}</span>${label}</button>`).join('')}
    </div>
    <ul class="info-list">${rows}</ul>
    ${state.placeLoading ? '<div class="spinner" role="progressbar" aria-label="Caricamento dettagli"></div>' : ''}
    <div class="pill-wrap"><a class="pill-btn" href="${editUrl}" target="_blank" rel="noopener">${icon('edit')}Suggerisci una modifica</a></div>`;
}

function viewSaved() {
  const items = store.get('saved', []);
  return `<div class="pane-top"></div><div class="results-head"><h2>Salvati</h2></div>
    ${items.length ? listHTML(items, 'saved') : '<p class="pane-note">Non hai ancora salvato nessun luogo. Apri un luogo e tocca «Salva».</p>'}`;
}
function viewRecent() {
  const items = store.get('recent', []);
  return `<div class="pane-top"></div><div class="results-head"><h2>Recenti</h2>
    ${items.length ? '<button class="mode" data-action="clear-recent">Cancella</button>' : ''}</div>
    ${items.length ? listHTML(items, 'recent') : '<p class="pane-note">I luoghi che apri compariranno qui.</p>'}`;
}
function viewAbout() {
  return `<div class="pane-top"></div><div class="pane-head"><h1 class="pane-title">FakeMaps</h1>
    <div class="pane-sub">Progetto personale, non ufficiale e senza scopo di lucro</div></div>
    <div class="about">
      <p>FakeMaps è un esercizio personale di sviluppo: una mappa web open source con un'interfaccia <strong>ispirata</strong> a Google Maps.</p>
      <p><strong>Nessuna parte del codice è stata copiata.</strong> Tutto il codice è stato scritto da zero; di Google Maps è stato osservato solo ciò che chiunque vede usando il sito (disposizione e dimensioni degli elementi), senza leggerne il codice.</p>
      <p>FakeMaps non è affiliata, approvata o sponsorizzata da Google LLC e non usa marchi, logo, icone, immagini, testi, dati o servizi di Google. «Google Maps» è un marchio di Google LLC, citato solo per indicare la fonte d'ispirazione.</p>
      <h3>Dati e servizi</h3>
      <p>Dati cartografici © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">collaboratori di OpenStreetMap</a> (ODbL). Tile vettoriali: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> e <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a>.</p>
      <p>Ricerca: <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a> di komoot. Dettagli e luoghi nei dintorni: <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noopener">Nominatim</a> e <a href="https://overpass-api.de" target="_blank" rel="noopener">Overpass API</a>. Percorsi: <a href="https://routing.openstreetmap.de" target="_blank" rel="noopener">OSRM di FOSSGIS</a>.</p>
      <h3>Software</h3>
      <p><a href="https://maplibre.org" target="_blank" rel="noopener">MapLibre GL JS</a> (BSD-3-Clause), font Roboto (SIL OFL 1.1), icone <a href="https://fonts.google.com/icons" target="_blank" rel="noopener">Material Symbols</a> (Apache 2.0).</p>
      <h3>Privacy</h3>
      <p>Nessun account e nessun tracciamento. Luoghi salvati e recenti restano solo in questo browser. Le ricerche vengono inviate ai servizi sopra elencati.</p>
    </div>`;
}

function renderRailRecent() {
  const items = store.get('recent', []).slice(0, 3);
  $('#rail-recent').innerHTML = items.map((p, i) => `
    <button class="rail-item" data-action="open-recent" data-i="${i}" title="${esc(p.name)}">
      <span class="rail-thumb">${icon(p.icon || 'location_on')}</span><span>${esc(p.name)}</span>
    </button>`).join('');
}

// ------------------------------------------------------------------ luoghi
function rememberRecent(p) {
  const list = store.get('recent', []).filter((x) => placeKey(x) !== placeKey(p));
  list.unshift(slim(p));
  store.set('recent', list.slice(0, 20));
}

let detailsCtl;
async function openPlace(p, { fly = true, fromResults = false } = {}) {
  state.place = { ...p, tags: p.tags || {} };
  state.placeTab = 'overview';
  q.value = p.name;
  if (!fromResults) state.stack = state.view === 'results' ? state.stack : [];
  openPanel('place');
  placeMarker.setLngLat([p.lng, p.lat]).addTo(map);
  placeMarker.getElement().classList.remove('drop'); void placeMarker.getElement().offsetWidth; placeMarker.getElement().classList.add('drop');
  if (fly) map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 16), offset: centerOffset(), duration: 700 });
  if (isMobile()) setSheet('half');
  rememberRecent(p);
  setPlaceParam(p);
  render();

  const hasTags = Object.keys(state.place.tags).length > 2;
  if (!hasTags) {
    detailsCtl?.abort(); detailsCtl = new AbortController();
    state.placeLoading = true; render();
    try {
      const d = await S.details(p, detailsCtl.signal);
      if (d && state.place && placeKey(state.place) === placeKey(p)) {
        state.place = { ...state.place, tags: d.tags, id: state.place.id || d.id, key: state.place.key || d.key,
          cat: state.place.cat && state.place.cat !== 'Luogo' ? state.place.cat : d.cat, icon: state.place.icon !== 'location_on' ? state.place.icon : d.icon,
          addr: state.place.addr || d.addr };
      }
    } catch (e) { if (e.name !== 'AbortError') console.warn('dettagli', e); }
    state.placeLoading = false;
    if (state.view === 'place') render();
  }
}

function setPlaceParam(p) {
  const u = new URL(location.href);
  ['place', 'name', 'id'].forEach((k) => u.searchParams.delete(k));
  if (p) {
    u.searchParams.set('place', `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`);
    u.searchParams.set('name', p.name);
    if (p.id) u.searchParams.set('id', p.id);
  }
  history.replaceState(null, '', u);
}

async function dropPin(lngLat) {
  const p = { id: null, name: 'Posizione inserita', lat: lngLat.lat, lng: lngLat.lng, cat: 'Pin', icon: 'location_on', addr: '', tags: {} };
  await openPlace(p, { fly: false });
  try {
    const r = await S.reverse(lngLat.lat, lngLat.lng);
    if (r && state.place?.lat === p.lat) { state.place.addr = r.addr || r.name; state.place.cat = 'Posizione inserita'; render(); }
  } catch { /* ignoro */ }
}

// ------------------------------------------------------------------ risultati
function fitResults() {
  if (!state.results.length) return;
  const b = new maplibregl.LngLatBounds();
  state.results.forEach((p) => b.extend([p.lng, p.lat]));
  map.fitBounds(b, { padding: mapPadding(), maxZoom: 16, duration: 600 });
}
function showResults(title, items, { category = null, fit = true } = {}) {
  state.resultsTitle = title; state.results = items; state.category = category; state.loading = false; state.loadError = false;
  placeMarker.remove();
  setResultsOnMap();
  state.stack = [];
  state.view = 'results'; panel.dataset.state = 'open'; document.body.classList.add('panel-open');
  if (isMobile()) setSheet('half');
  render();
  if (fit) fitResults();
  updateChips();
}

let searchCtl;
async function runSearch(text) {
  text = text.trim();
  if (!text) return;
  closeSuggestions();
  q.blur();
  state.loadError = false; state.loading = true; state.resultsTitle = text; state.results = []; state.category = null;
  state.view = 'results'; panel.dataset.state = 'open'; document.body.classList.add('panel-open'); render();
  searchCtl?.abort(); searchCtl = new AbortController();
  try {
    const c = map.getCenter();
    const items = await S.search(text, { lat: c.lat, lng: c.lng, limit: 15, signal: searchCtl.signal });
    if (items.length === 1) { state.results = items; setResultsOnMap(); openPlace(items[0]); return; }
    showResults(text, items);
  } catch (e) {
    if (e.name === 'AbortError') return;
    state.loading = false; state.loadError = true; render(); toast('Ricerca non disponibile al momento');
  }
}

let catCtl;
async function runCategory(cat) {
  if (map.getZoom() < 12) map.jumpTo({ zoom: 13 });
  q.value = cat.label;
  state.loadError = false; state.loading = true; state.resultsTitle = cat.label; state.results = []; state.category = cat.id;
  state.view = 'results'; panel.dataset.state = 'open'; document.body.classList.add('panel-open');
  if (isMobile()) setSheet('half');
  render(); updateChips(); hideAreaButton();
  catCtl?.abort(); catCtl = new AbortController();
  try {
    const b = map.getBounds();
    const items = await S.nearbyCategory(cat, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], { signal: catCtl.signal });
    const c = map.getCenter();
    items.forEach((p) => { p.dist = c.distanceTo(new maplibregl.LngLat(p.lng, p.lat)); });
    items.sort((x, y) => x.dist - y.dist);
    showResults(cat.label, items, { category: cat.id, fit: false });
  } catch (e) {
    if (e.name === 'AbortError') return;
    state.loading = false; state.loadError = true; render(); toast('Servizio dei luoghi nei dintorni non disponibile');
  }
}

async function runNearby(p) {
  state.loadError = false; state.loading = true; state.resultsTitle = `Vicino a ${p.name}`; state.results = []; state.category = null;
  state.view = 'results'; render();
  try {
    const items = await S.nearbyAround(p.lat, p.lng, 300);
    const here = new maplibregl.LngLat(p.lng, p.lat);
    items.forEach((x) => { x.dist = here.distanceTo(new maplibregl.LngLat(x.lng, x.lat)); });
    items.sort((x, y) => x.dist - y.dist);
    showResults(`Vicino a ${p.name}`, items.filter((x) => placeKey(x) !== placeKey(p)));
  } catch { state.loading = false; state.loadError = true; render(); toast('Servizio non disponibile'); }
}

// pulsante "Cerca in questa zona"
const areaBtn = document.createElement('button');
areaBtn.className = 'chip'; areaBtn.hidden = true;
areaBtn.style.cssText = 'position:fixed;z-index:25;left:50%;transform:translateX(-50%);top:72px;box-shadow:var(--shadow-card)';
areaBtn.innerHTML = `${icon('search')}Cerca in questa zona`;
document.body.append(areaBtn);
areaBtn.addEventListener('click', () => { const cat = S.CATEGORIES.find((c) => c.id === state.category); if (cat) runCategory(cat); });
function hideAreaButton() { areaBtn.hidden = true; }
map.on('moveend', (e) => {
  if (!e.originalEvent) return;
  areaBtn.style.top = isMobile() ? '112px' : '72px';
  areaBtn.hidden = !(state.category && state.view === 'results');
});

// ------------------------------------------------------------------ indicazioni
function clearRoute() {
  state.dir.routes = []; state.dir.times = {};
  setRouteOnMap(); originMarker.remove();
}
function openDirections({ to = null, mode } = {}) {
  closeSuggestions();
  if (mode) state.dir.mode = mode;
  state.dir.to = to || state.dir.to;
  state.dir.from = state.dir.from || (state.myPos ? { name: 'La tua posizione', lat: state.myPos.lat, lng: state.myPos.lng, me: true } : null);
  state.dir.sel = 0;
  if (state.view === 'place') state.stack.push('place');
  state.view = 'directions'; panel.dataset.state = 'open'; document.body.classList.add('panel-open');
  if (isMobile()) setSheet('half');
  setResultsOnMap(); hideAreaButton();
  render();
  computeRoutes();
}

function viewDirections() {
  const { from, to, mode, routes, times, sel } = state.dir;
  const r = routes[sel];
  return `
    <div class="dir-head">
      <button class="icon-btn" data-action="back" aria-label="Chiudi indicazioni">${icon('arrow_back')}</button>
      <div class="dir-fields">
        <div class="dir-field from">${icon('trip_origin')}<input id="dir-from" placeholder="Scegli il punto di partenza" value="${esc(from?.name || '')}" autocomplete="off" aria-label="Partenza"><ul class="suggestions" role="listbox" hidden></ul></div>
        <div class="dir-field to">${icon('location_on')}<input id="dir-to" placeholder="Scegli la destinazione" value="${esc(to?.name || '')}" autocomplete="off" aria-label="Destinazione"><ul class="suggestions" role="listbox" hidden></ul></div>
      </div>
      <button class="icon-btn" data-action="swap" aria-label="Inverti partenza e destinazione" style="margin-top:20px">${icon('swap_vert')}</button>
    </div>
    <div class="modes" role="group" aria-label="Mezzo di trasporto">
      ${S.MODES.map((m) => `<button class="mode" data-action="mode" data-mode="${m.id}" aria-pressed="${m.id === mode}" aria-label="${m.label}">${icon(m.icon)}${times[m.id] ? S.fmtDuration(times[m.id]) : ''}</button>`).join('')}
    </div>
    ${!from || !to ? `<p class="pane-note">${!from ? 'Scegli il punto di partenza, oppure tocca «La tua posizione».' : 'Scegli la destinazione.'}</p>
      ${!from ? `<div class="pill-wrap" style="justify-content:flex-start;padding-top:0"><button class="pill-btn" data-action="from-me">${icon('my_location')}Usa la tua posizione</button></div>` : ''}`
    : state.dirLoading ? '<div class="spinner" role="progressbar" aria-label="Calcolo del percorso"></div>'
      : !routes.length ? '<p class="pane-note">Nessun percorso trovato tra questi due punti.</p>'
        : `${routes.map((rt, i) => `<div class="route-card ${i === sel ? 'sel' : ''}" data-action="route" data-i="${i}" role="button" tabindex="0">
              <div class="route-time">${S.fmtDuration(rt.duration)}</div>
              <div class="route-dist">${S.fmtDistance(rt.distance)}${rt.legs?.[0]?.summary ? ` · via ${esc(rt.legs[0].summary)}` : ''}${i === 0 ? ' · Percorso più veloce' : ''}</div></div>`).join('')}
          <div class="pane-section-title">Passaggi</div>
          <ol class="steps">${(r.legs?.[0]?.steps || []).map((st) => `<li class="step">${icon(S.stepIcon(st))}<div><div>${esc(S.stepText(st))}</div>${st.distance ? `<div class="step-dist">${S.fmtDistance(st.distance)}</div>` : ''}</div></li>`).join('')}</ol>
          <p class="pane-note" style="font-size:12px">Percorsi calcolati con OSRM sui dati OpenStreetMap. Verifica sempre la segnaletica.</p>`}`;
}

function bindDirections() {
  for (const which of ['from', 'to']) {
    const input = $(`#dir-${which}`);
    const list = input.parentElement.querySelector('.suggestions');
    attachAutocomplete(input, list, (p) => {
      state.dir[which] = p;
      render(); computeRoutes();
    });
  }
}

let routeCtl;
async function computeRoutes() {
  const { from, to, mode } = state.dir;
  if (!from || !to) { clearRoute(); render(); return; }
  routeCtl?.abort(); routeCtl = new AbortController();
  state.dirLoading = true; render();
  originMarker.setLngLat([from.lng, from.lat]).addTo(map);
  placeMarker.setLngLat([to.lng, to.lat]).addTo(map);
  try {
    const routes = await S.route(from, to, mode, routeCtl.signal);
    state.dir.routes = routes; state.dir.sel = 0;
    state.dir.times[mode] = routes[0]?.duration;
    state.dirLoading = false;
    setRouteOnMap(); render();
    const b = new maplibregl.LngLatBounds();
    routes[0].geometry.coordinates.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: mapPadding(), duration: 600 });
    // tempi degli altri mezzi, per i pulsanti in alto
    for (const m of S.MODES.filter((x) => x.id !== mode && !state.dir.times[x.id])) {
      S.route(from, to, m.id, routeCtl.signal).then((rs) => { state.dir.times[m.id] = rs[0]?.duration; if (state.view === 'directions') updateModeTimes(); }).catch(() => {});
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    state.dir.routes = []; state.dirLoading = false; setRouteOnMap(); render(); toast('Servizio percorsi non disponibile');
  }
}
function updateModeTimes() {
  content.querySelectorAll('.mode[data-mode]').forEach((b) => {
    const m = S.MODES.find((x) => x.id === b.dataset.mode);
    const t = state.dir.times[m.id];
    b.innerHTML = `${icon(m.icon)}${t ? S.fmtDuration(t) : ''}`;
  });
}

// ------------------------------------------------------------------ autocompletamento
function attachAutocomplete(input, list, onPick, { onSubmit } = {}) {
  let items = [], idx = -1, ctl;
  const close = () => { list.hidden = true; items = []; idx = -1; input.setAttribute('aria-expanded', 'false'); if (input === q) sb.classList.remove('has-suggestions'); };
  const draw = () => {
    list.innerHTML = items.length ? items.map((p, i) => `
      <li role="option" aria-selected="${i === idx}" data-i="${i}">${icon(p._recent ? 'history' : (p.icon || 'location_on'))}
        <div class="sug-text"><div class="sug-main">${esc(p.name)}</div><div class="sug-sub">${esc(p.short || p.addr || p.cat || '')}</div></div></li>`).join('')
      : '<li class="sug-empty">Nessun suggerimento</li>';
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    if (input === q) sb.classList.add('has-suggestions');
  };
  const load = debounce(async () => {
    const text = input.value.trim();
    if (text.length < 3) {
      const rec = store.get('recent', []).slice(0, 5).map((p) => ({ ...p, _recent: true }));
      if (!text && rec.length && document.activeElement === input) { items = rec; idx = -1; draw(); } else close();
      return;
    }
    ctl?.abort(); ctl = new AbortController();
    try {
      const c = map.getCenter();
      items = await S.search(text, { lat: c.lat, lng: c.lng, limit: 6, signal: ctl.signal });
      idx = -1;
      if (document.activeElement === input) draw();
    } catch (e) { if (e.name !== 'AbortError') close(); }
  }, 250);
  input.addEventListener('input', () => { load(); if (input === q) sb.classList.toggle('active', !!input.value || !!(state.view && state.view !== 'home')); });
  input.addEventListener('focus', () => { if (!input.value) load(); else input.select(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && items.length) { idx = (idx + 1) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && items.length) { idx = (idx - 1 + items.length) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0 && items[idx]) { const p = items[idx]; close(); onPick(p); }
      else if (onSubmit) { close(); onSubmit(input.value); }
      else if (items[0]) { const p = items[0]; close(); onPick(p); }
    } else if (e.key === 'Escape') { close(); }
  });
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]'); if (!li) return;
    const p = items[+li.dataset.i]; close(); input.blur(); onPick(p);
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  return { close };
}
const mainAC = attachAutocomplete(q, sugBox, (p) => { state.results = []; setResultsOnMap(); openPlace(p); }, { onSubmit: runSearch });
function closeSuggestions() { mainAC.close(); }

// ------------------------------------------------------------------ chip
function renderChips() {
  $('#chips').innerHTML = S.CATEGORIES.map((c) => `<button class="chip" data-action="category" data-cat="${c.id}" aria-pressed="false">${icon(c.icon)}${c.label}</button>`).join('');
}
function updateChips() {
  document.querySelectorAll('#chips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.category && state.view === 'results')));
}

// ------------------------------------------------------------------ livelli
function renderLayers() {
  $('#layers-pop').innerHTML = Object.entries(STYLES).map(([id, s]) => `
    <button class="layer-opt" data-action="set-style" data-style="${id}" aria-pressed="${id === state.styleId}">
      <span class="sw" style="background:${s.swatch}"></span>${s.label}</button>`).join('');
  const next = Object.keys(STYLES).find((k) => k !== state.styleId);
  $('.layers-thumb').style.setProperty('--thumb', STYLES[next].swatch);
}
function toggleLayers(force) {
  const pop = $('#layers-pop');
  const open = force ?? pop.hidden;
  pop.hidden = !open;
  $('#layers-btn').setAttribute('aria-expanded', String(open));
}
$('#layers-btn').addEventListener('click', (e) => { e.stopPropagation(); renderLayers(); toggleLayers(); });

// ------------------------------------------------------------------ posizione
function locate() {
  if (!navigator.geolocation) { toast('Posizione non disponibile su questo dispositivo'); return; }
  toast('Ricerca della posizione…');
  navigator.geolocation.getCurrentPosition((pos) => {
    state.myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    meMarker.setLngLat([state.myPos.lng, state.myPos.lat]).addTo(map);
    $('.ctrl.locate').classList.add('on');
    map.flyTo({ center: [state.myPos.lng, state.myPos.lat], zoom: Math.max(map.getZoom(), 15), offset: centerOffset() });
    $('#toast').hidden = true;
    if (state.view === 'directions' && !state.dir.from) { state.dir.from = { name: 'La tua posizione', ...state.myPos, me: true }; render(); computeRoutes(); }
  }, () => toast('Non è stato possibile ottenere la tua posizione'), { enableHighAccuracy: true, timeout: 10000 });
}

// ------------------------------------------------------------------ menu
function openDrawer() { $('#drawer').hidden = false; $('#scrim').hidden = false; $('#drawer button').focus(); }
function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; }
$('#scrim').addEventListener('click', closeDrawer);

function clearAll() {
  q.value = '';
  state.results = []; state.category = null; state.place = null;
  setResultsOnMap(); placeMarker.remove(); clearRoute(); hideAreaButton(); setPlaceParam(null);
  closePanel(); updateChips();
}

async function share(url, title) {
  if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copy(url, 'Link copiato');
}

// ------------------------------------------------------------------ azioni (delegazione)
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!$('#layers-pop').hidden && !e.target.closest('#layers-pop, #layers-btn')) toggleLayers(false);
  if (!el) return;
  const a = el.dataset.action;
  const i = el.dataset.i != null ? +el.dataset.i : null;
  switch (a) {
    case 'open-drawer': openDrawer(); break;
    case 'close-drawer': closeDrawer(); break;
    case 'search': runSearch(q.value); break;
    case 'clear': clearAll(); break;
    case 'back': back(); break;
    case 'directions':
      closeDrawer();
      openDirections({ to: state.view === 'place' ? slim(state.place) : null });
      break;
    case 'dir-mode': openDirections({ mode: el.dataset.mode }); break;
    case 'category': { closeDrawer(); const c = S.CATEGORIES.find((x) => x.id === el.dataset.cat);
      if (state.category === c.id && state.view === 'results' && el.closest('#chips')) { clearAll(); break; }
      runCategory(c); break; }
    case 'open-result': openPlace(state.results[i], { fromResults: true }); break;
    case 'open-saved': openPlace(store.get('saved', [])[i]); break;
    case 'open-recent': closeDrawer(); openPlace(store.get('recent', [])[i]); break;
    case 'show-saved': closeDrawer(); state.stack = []; state.view = null; openPanel('saved'); if (isMobile()) setSheet('half'); break;
    case 'show-recent': closeDrawer(); state.stack = []; state.view = null; openPanel('recent'); if (isMobile()) setSheet('half'); break;
    case 'show-about': closeDrawer(); state.stack = []; state.view = null; openPanel('about'); if (isMobile()) setSheet('full'); break;
    case 'clear-recent': store.set('recent', []); render(); break;
    case 'tab': state.placeTab = el.dataset.tab; render(); break;
    case 'save': {
      const list = store.get('saved', []);
      const k = placeKey(state.place);
      const exists = list.some((s) => placeKey(s) === k);
      store.set('saved', exists ? list.filter((s) => placeKey(s) !== k) : [slim(state.place), ...list]);
      toast(exists ? 'Rimosso dai salvati' : 'Salvato'); render(); break;
    }
    case 'nearby': runNearby(state.place); break;
    case 'share': share(location.href, state.place?.name); break;
    case 'share-map': closeDrawer(); share(location.href, 'FakeMaps'); break;
    case 'copy-coords': copy(`${state.place.lat.toFixed(6)}, ${state.place.lng.toFixed(6)}`, 'Coordinate copiate'); break;
    case 'copy': copy(el.dataset.text); break;
    case 'locate': locate(); break;
    case 'zoom-in': map.zoomIn(); break;
    case 'zoom-out': map.zoomOut(); break;
    case 'open-layers': closeDrawer(); renderLayers(); toggleLayers(true); break;
    case 'set-style':
      state.styleId = el.dataset.style; store.set('style', state.styleId);
      map.setStyle(STYLES[state.styleId].url); renderLayers(); toggleLayers(false); break;
    case 'mode':
      state.dir.mode = el.dataset.mode; render(); computeRoutes(); break;
    case 'route': state.dir.sel = i; setRouteOnMap(); render(); break;
    case 'swap': { const { from, to } = state.dir; state.dir.from = to; state.dir.to = from; state.dir.times = {}; render(); computeRoutes(); break; }
    case 'from-me': locate(); break;
    default: break;
  }
});

// evidenzia il marker quando si passa sopra a un risultato
let hlId = null;
content.addEventListener('pointerover', (e) => {
  const b = e.target.closest('[data-action="open-result"]');
  const id = b ? +b.dataset.i : null;
  if (id === hlId || !map.getSource('results')) return;
  if (hlId != null) map.setFeatureState({ source: 'results', id: hlId }, { hl: false });
  hlId = id;
  if (id != null) map.setFeatureState({ source: 'results', id }, { hl: true });
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-action]')) { e.preventDefault(); e.target.click(); return; }
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); q.focus(); }
  if (e.key === 'Escape') {
    if (!$('#drawer').hidden) closeDrawer();
    else if (!$('#layers-pop').hidden) toggleLayers(false);
  }
});

// ------------------------------------------------------------------ click sulla mappa
function placeFromFeature(f, lngLat) {
  const pr = f.properties || {};
  const value = pr.subclass || pr.class || null;
  const key = value ? S.guessKey(value) : null;
  const coords = f.geometry?.type === 'Point' ? f.geometry.coordinates : [lngLat.lng, lngLat.lat];
  return {
    id: null, name: pr['name:it'] || pr.name, lat: coords[1], lng: coords[0], key, value,
    cat: S.categoryLabel(key, value), icon: S.categoryIcon(key, value), addr: '', tags: {},
  };
}

map.on('click', (e) => {
  if (!$('#layers-pop').hidden) return;
  const hit = map.getLayer('results-dots') ? map.queryRenderedFeatures(e.point, { layers: ['results-dots'] }) : [];
  if (hit.length) { openPlace(state.results[hit[0].properties.i], { fromResults: true }); return; }
  const bbox = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
  const poi = map.queryRenderedFeatures(bbox).find((f) => f.sourceLayer === 'poi' && f.properties?.name);
  if (poi) { state.results = state.view === 'results' ? state.results : []; openPlace(placeFromFeature(poi, e.lngLat), { fly: true }); return; }
  if (state.view === 'place' && !isMobile()) { back(); return; }
  if (isMobile() && state.view !== 'home') setSheet('peek');
});
map.on('mousemove', (e) => {
  const hit = map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]])
    .some((f) => f.layer.id === 'results-dots' || (f.sourceLayer === 'poi' && f.properties?.name));
  map.getCanvas().style.cursor = hit ? 'pointer' : '';
});
map.on('contextmenu', (e) => dropPin(e.lngLat));
(function longPress() {
  let timer, start;
  map.on('touchstart', (e) => {
    if (e.originalEvent.touches.length !== 1) return;
    start = e.point; clearTimeout(timer);
    timer = setTimeout(() => dropPin(e.lngLat), 550);
  });
  const cancel = (e) => { if (!start || !e?.point || Math.hypot(e.point.x - start.x, e.point.y - start.y) > 8) clearTimeout(timer); };
  map.on('touchmove', cancel);
  map.on('touchend', () => clearTimeout(timer));
  map.on('touchcancel', () => clearTimeout(timer));
})();

// ------------------------------------------------------------------ avvio
renderChips();
renderLayers();
window.addEventListener('resize', debounce(() => {
  if (isMobile()) { if (!state.view) state.view = 'home'; panel.dataset.state = 'open'; setSheet(state.sheet); }
  else if (state.view === 'home') { state.view = null; panel.dataset.state = 'closed'; document.body.classList.remove('panel-open'); }
  render();
}, 150));

if (isMobile()) { state.view = 'home'; panel.dataset.state = 'open'; setSheet('peek'); }
render();

// link condiviso: ?place=lat,lng&name=...&id=...
(function restoreFromUrl() {
  const u = new URL(location.href);
  const pl = u.searchParams.get('place');
  if (!pl) return;
  const [lat, lng] = pl.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const id = u.searchParams.get('id');
  map.once('load', () => openPlace({ id: /^[NWR]\d+$/.test(id || '') ? id : null, name: u.searchParams.get('name') || 'Luogo', lat, lng, icon: 'location_on', cat: 'Luogo', addr: '', tags: {} }, { fly: !location.hash }));
})();
