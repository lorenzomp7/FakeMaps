// Servizi esterni, tutti gratuiti e basati su OpenStreetMap.
// Rispettare le regole d'uso: poche richieste, debounce sulla ricerca, nessun uso massivo.
//  - Ricerca:   Photon (komoot)              https://photon.komoot.io
//  - Dintorni:  Overpass API                 https://overpass-api.de
//  - Percorsi:  OSRM su routing.openstreetmap.de (FOSSGIS)

const PHOTON = 'https://photon.komoot.io';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Overpass è spesso sovraccarico: si prova un server dopo l'altro, con un timeout breve.
const OVERPASS = ['https://overpass-api.de/api/interpreter'];
const ROUTING = 'https://routing.openstreetmap.de';

function withTimeout(signal, ms) {
  const t = AbortSignal.timeout(ms);
  return signal && AbortSignal.any ? AbortSignal.any([signal, t]) : (signal || t);
}
async function getJSON(url, { timeout = 12000, signal, ...opts } = {}) {
  const res = await fetch(url, { ...opts, signal: withTimeout(signal, timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- etichette categorie ----------
const LABELS = {
  'amenity:restaurant': 'Ristorante', 'amenity:fast_food': 'Fast food', 'amenity:cafe': 'Caffè', 'amenity:bar': 'Bar',
  'amenity:pub': 'Pub', 'amenity:ice_cream': 'Gelateria', 'amenity:pharmacy': 'Farmacia', 'amenity:hospital': 'Ospedale',
  'amenity:clinic': 'Clinica', 'amenity:doctors': 'Studio medico', 'amenity:dentist': 'Dentista', 'amenity:fuel': 'Distributore di benzina',
  'amenity:parking': 'Parcheggio', 'amenity:bank': 'Banca', 'amenity:atm': 'Bancomat', 'amenity:school': 'Scuola',
  'amenity:university': 'Università', 'amenity:library': 'Biblioteca', 'amenity:place_of_worship': 'Luogo di culto',
  'amenity:theatre': 'Teatro', 'amenity:cinema': 'Cinema', 'amenity:post_office': 'Ufficio postale', 'amenity:police': 'Polizia',
  'amenity:townhall': 'Municipio', 'amenity:marketplace': 'Mercato', 'amenity:charging_station': 'Colonnina di ricarica',
  'amenity:bicycle_rental': 'Noleggio bici', 'amenity:car_rental': 'Autonoleggio', 'amenity:toilets': 'Bagni pubblici',
  'tourism:hotel': 'Hotel', 'tourism:guest_house': 'Pensione', 'tourism:hostel': 'Ostello', 'tourism:apartment': 'Appartamento',
  'tourism:museum': 'Museo', 'tourism:gallery': 'Galleria d\'arte', 'tourism:attraction': 'Attrazione turistica',
  'tourism:viewpoint': 'Punto panoramico', 'tourism:artwork': 'Opera d\'arte', 'tourism:camp_site': 'Campeggio',
  'shop:supermarket': 'Supermercato', 'shop:convenience': 'Minimarket', 'shop:bakery': 'Panetteria', 'shop:clothes': 'Abbigliamento',
  'shop:mall': 'Centro commerciale', 'shop:books': 'Libreria', 'shop:hairdresser': 'Parrucchiere', 'shop:electronics': 'Elettronica',
  'leisure:park': 'Parco', 'leisure:garden': 'Giardino', 'leisure:playground': 'Parco giochi', 'leisure:sports_centre': 'Centro sportivo',
  'leisure:stadium': 'Stadio', 'leisure:fitness_centre': 'Palestra', 'leisure:pitch': 'Campo sportivo',
  'railway:station': 'Stazione ferroviaria', 'railway:subway_entrance': 'Ingresso metropolitana', 'railway:tram_stop': 'Fermata del tram',
  'public_transport:station': 'Stazione', 'highway:bus_stop': 'Fermata dell\'autobus', 'aeroway:aerodrome': 'Aeroporto',
  'historic:monument': 'Monumento', 'historic:castle': 'Castello', 'historic:memorial': 'Memoriale',
  'place:city': 'Città', 'place:town': 'Città', 'place:village': 'Paese', 'place:hamlet': 'Frazione', 'place:suburb': 'Quartiere',
  'place:neighbourhood': 'Quartiere', 'place:quarter': 'Quartiere', 'place:locality': 'Località', 'place:country': 'Paese',
  'place:state': 'Regione', 'place:county': 'Provincia', 'highway:residential': 'Via', 'highway:primary': 'Strada',
  'highway:secondary': 'Strada', 'highway:tertiary': 'Strada', 'highway:pedestrian': 'Zona pedonale', 'highway:unclassified': 'Strada',
  'building:yes': 'Edificio', 'building:house': 'Casa', 'boundary:administrative': 'Area amministrativa', 'natural:peak': 'Cima',
  'natural:water': 'Specchio d\'acqua', 'waterway:river': 'Fiume', 'landuse:residential': 'Zona residenziale',
};
const ICONS_BY_KEY = {
  amenity: 'location_on', tourism: 'attractions', shop: 'grocery', leisure: 'park', railway: 'train', public_transport: 'train',
  highway: 'navigation', place: 'location_on', historic: 'museum',
};
const ICONS = {
  'amenity:restaurant': 'restaurant', 'amenity:fast_food': 'restaurant', 'amenity:cafe': 'local_cafe', 'amenity:bar': 'local_bar',
  'amenity:pub': 'local_bar', 'amenity:pharmacy': 'local_pharmacy', 'amenity:fuel': 'local_gas_station', 'tourism:hotel': 'hotel',
  'tourism:guest_house': 'hotel', 'tourism:hostel': 'hotel', 'tourism:museum': 'museum', 'tourism:gallery': 'museum',
  'shop:supermarket': 'grocery', 'shop:convenience': 'grocery', 'leisure:park': 'park', 'leisure:garden': 'park',
};
const HERO = {
  restaurant: ['#ffd8b5', '#f6a96b'], local_cafe: ['#f2dcc6', '#c99f7a'], local_bar: ['#f6cde0', '#d98ab0'], hotel: ['#e3d7fb', '#b29bef'],
  museum: ['#d9e7fc', '#8fb4f2'], attractions: ['#d9e7fc', '#8fb4f2'], local_pharmacy: ['#fcd8d6', '#ef8f8a'],
  local_gas_station: ['#d6eef7', '#7fc4de'], grocery: ['#d9f0dd', '#86c995'], park: ['#d4f0d0', '#79c57a'], train: ['#dde3ea', '#9aa8b8'],
};

const pretty = (v) => { const s = String(v).replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
export function categoryLabel(key, value) {
  if (!key) return value ? pretty(value) : 'Luogo';
  return LABELS[`${key}:${value}`] || pretty(value || key);
}
// Indovina la chiave OSM (amenity, tourism...) da un valore come "restaurant" o "museum".
export function guessKey(value) {
  return ['amenity', 'tourism', 'shop', 'leisure', 'railway', 'historic', 'aeroway'].find((k) => LABELS[`${k}:${value}`]) || null;
}
export function categoryIcon(key, value) {
  return ICONS[`${key}:${value}`] || ICONS_BY_KEY[key] || 'location_on';
}
export function heroColors(icon) { return HERO[icon] || ['#cfe0fb', '#a8c7fa']; }

// ---------- Photon ----------
function photonToPlace(f) {
  const p = f.properties || {};
  const [lng, lat] = f.geometry.coordinates;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const cityLine = [p.postcode, p.city || p.town || p.village || p.district].filter(Boolean).join(' ');
  const name = p.name || street || p.city || 'Luogo senza nome';
  const addrParts = [street !== name ? street : '', cityLine, p.state, p.country].filter(Boolean);
  return {
    id: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : null,
    name, lat, lng,
    key: p.osm_key, value: p.osm_value,
    cat: categoryLabel(p.osm_key, p.osm_value),
    icon: categoryIcon(p.osm_key, p.osm_value),
    addr: addrParts.join(', '),
    short: [street !== name ? street : '', p.city || p.town || p.village, p.country].filter(Boolean).join(', '),
    extent: p.extent || null,
    tags: {},
  };
}

export async function search(q, { lat, lng, limit = 8, signal } = {}) {
  const u = new URL(`${PHOTON}/api/`);
  u.searchParams.set('q', q);
  u.searchParams.set('limit', String(limit));
  u.searchParams.append('osm_tag', '!boundary'); // niente confini amministrativi tra i suggerimenti
  if (lat != null) { u.searchParams.set('lat', lat.toFixed(4)); u.searchParams.set('lon', lng.toFixed(4)); }
  const data = await getJSON(u, { signal });
  return (data.features || []).map(photonToPlace);
}

export async function reverse(lat, lng) {
  const u = new URL(`${PHOTON}/reverse`);
  u.searchParams.set('lat', lat.toFixed(6));
  u.searchParams.set('lon', lng.toFixed(6));
  const data = await getJSON(u);
  return data.features?.[0] ? photonToPlace(data.features[0]) : null;
}

// ---------- Overpass ----------
export const CATEGORIES = [
  { id: 'restaurant', nom: 'restaurant', label: 'Ristoranti', icon: 'restaurant', q: 'nwr["amenity"~"^(restaurant|fast_food)$"]' },
  { id: 'hotel', nom: 'hotel', label: 'Hotel', icon: 'hotel', q: 'nwr["tourism"~"^(hotel|guest_house|hostel)$"]' },
  { id: 'todo', nom: 'attraction', label: 'Cose da fare', icon: 'attractions', q: 'nwr["tourism"~"^(attraction|viewpoint)$"]' },
  { id: 'museum', nom: 'museum', label: 'Musei', icon: 'museum', q: 'nwr["tourism"~"^(museum|gallery)$"]' },
  { id: 'transit', nom: 'railway station', label: 'Trasporti', icon: 'train', q: 'nwr["railway"~"^(station|halt)$"]' },
  { id: 'bar', nom: 'bar', label: 'Bar', icon: 'local_bar', q: 'nwr["amenity"~"^(bar|cafe|pub)$"]' },
  { id: 'pharmacy', nom: 'pharmacy', label: 'Farmacie', icon: 'local_pharmacy', q: 'nwr["amenity"="pharmacy"]' },
  { id: 'fuel', nom: 'fuel', label: 'Benzina', icon: 'local_gas_station', q: 'nwr["amenity"="fuel"]' },
  { id: 'grocery', nom: 'supermarket', label: 'Supermercati', icon: 'grocery', q: 'nwr["shop"~"^(supermarket|convenience)$"]' },
  { id: 'park', nom: 'park', label: 'Parchi', icon: 'park', q: 'nwr["leisure"="park"]["name"]' },
];

const MAIN_KEYS = ['amenity', 'tourism', 'shop', 'leisure', 'railway', 'public_transport', 'historic', 'office', 'craft', 'healthcare', 'place', 'highway', 'building'];

export function overpassToPlace(el) {
  const t = el.tags || {};
  const key = MAIN_KEYS.find((k) => t[k]) || null;
  const value = key ? t[key] : null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const city = [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ');
  return {
    id: `${el.type[0].toUpperCase()}${el.id}`,
    name: t.name || t.brand || categoryLabel(key, value),
    lat, lng, key, value,
    cat: categoryLabel(key, value),
    icon: categoryIcon(key, value),
    addr: [street, city].filter(Boolean).join(', '),
    short: street || '',
    tags: t,
  };
}

async function overpass(query, signal) {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const data = await getJSON(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal, timeout: 6000 });
      return (data.elements || []).filter((e) => (e.lat ?? e.center?.lat) != null);
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

// ---------- Nominatim (riserva: massimo una richiesta al secondo, mai per l'autocompletamento) ----------
function nominatimToPlace(x) {
  const a = x.address || {};
  const t = { ...(x.extratags || {}) };
  if (x.name) t.name = x.name;
  const road = [a.road, a.pedestrian, a.square].find((r) => r && !/^[\d_]+$/.test(r)); // scarta codici interni tipo "1_33051"
  const street = [road, road ? a.house_number : null].filter(Boolean).join(' ');
  const city = [a.postcode, a.city || a.town || a.village || a.suburb].filter(Boolean).join(' ');
  return {
    id: x.osm_type && x.osm_id ? `${x.osm_type[0].toUpperCase()}${x.osm_id}` : null,
    name: x.name || String(x.display_name || '').split(',')[0],
    lat: +x.lat, lng: +x.lon, key: x.category, value: x.type,
    cat: categoryLabel(x.category, x.type), icon: categoryIcon(x.category, x.type),
    addr: [street, city, a.state, a.country].filter(Boolean).join(', '),
    short: street || '',
    tags: t,
  };
}
async function nominatimLookup(id, signal) {
  const u = new URL(`${NOMINATIM}/lookup`);
  u.searchParams.set('osm_ids', id);
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('extratags', '1');
  u.searchParams.set('addressdetails', '1');
  u.searchParams.set('accept-language', 'it');
  const data = await getJSON(u, { signal, timeout: 10000 });
  return data[0] ? nominatimToPlace(data[0]) : null;
}
async function nominatimCategory(phrase, [w, s, e, n], signal) {
  const u = new URL(`${NOMINATIM}/search`);
  u.searchParams.set('q', phrase);
  u.searchParams.set('viewbox', `${w},${n},${e},${s}`);
  u.searchParams.set('bounded', '1');
  u.searchParams.set('limit', '40');
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('addressdetails', '1');
  u.searchParams.set('extratags', '1');
  u.searchParams.set('accept-language', 'it');
  return (await getJSON(u, { signal, timeout: 10000 })).map(nominatimToPlace);
}

export async function nearbyCategory(cat, bounds, { limit = 60, signal } = {}) {
  const [w, s, e, n] = bounds;
  // Prima Nominatim (veloce e stabile, fino a 40 risultati), poi Overpass come riserva.
  try {
    const items = await nominatimCategory(cat.nom, bounds, signal);
    if (items.length) return items;
  } catch (err) { if (signal?.aborted) throw err; }
  const q = `[out:json][timeout:15];(${cat.q}(${s},${w},${n},${e}););out center tags ${limit};`;
  return (await overpass(q, signal)).map(overpassToPlace);
}

export async function nearbyAround(lat, lng, radius = 300, { limit = 25, signal } = {}) {
  const u = new URL(`${PHOTON}/reverse`);
  u.searchParams.set('lat', lat.toFixed(6));
  u.searchParams.set('lon', lng.toFixed(6));
  u.searchParams.set('radius', String(radius / 1000));
  u.searchParams.set('limit', String(limit));
  const data = await getJSON(u, { signal });
  return (data.features || []).filter((f) => f.properties?.name && !['highway', 'place', 'building', 'boundary'].includes(f.properties.osm_key))
    .map(photonToPlace);
}

// Recupera i tag OSM completi di un elemento (orari, telefono, sito...).
export async function details(place, signal) {
  let q;
  if (place.id && /^[NWR]\d+$/.test(place.id)) {
    try { const p = await nominatimLookup(place.id, signal); if (p) return p; } catch (e) { if (signal?.aborted) throw e; }
    const type = { N: 'node', W: 'way', R: 'relation' }[place.id[0]];
    q = `[out:json][timeout:15];${type}(${place.id.slice(1)});out center tags;`;
  } else if (place.name) {
    // luogo toccato sulla mappa: cerca l'elemento OSM con lo stesso nome lì vicino (Photon), poi i dettagli (Nominatim)
    try {
      const near = await nearbyAround(place.lat, place.lng, 80, { limit: 10, signal });
      const hit = near.find((x) => x.id && x.name.toLowerCase() === place.name.toLowerCase());
      if (hit) { const p = await nominatimLookup(hit.id, signal); if (p) return p; }
    } catch (e) { if (signal?.aborted) throw e; }
    const name = place.name.replace(/(["\\])/g, '\\$1');
    q = `[out:json][timeout:15];nwr["name"="${name}"](around:60,${place.lat},${place.lng});out center tags 1;`;
  } else return null;
  const els = await overpass(q, signal);
  return els[0] ? overpassToPlace(els[0]) : null;
}

// ---------- Percorsi ----------
export const MODES = [
  { id: 'car', label: 'In auto', icon: 'directions_car', path: 'routed-car' },
  { id: 'foot', label: 'A piedi', icon: 'directions_walk', path: 'routed-foot' },
  { id: 'bike', label: 'In bicicletta', icon: 'directions_bike', path: 'routed-bike' },
];

export async function route(from, to, modeId, signal) {
  const mode = MODES.find((m) => m.id === modeId) || MODES[0];
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const u = `${ROUTING}/${mode.path}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=true`;
  const data = await getJSON(u, { signal });
  if (data.code !== 'Ok') throw new Error(data.message || data.code);
  return data.routes;
}

const MOD = { left: 'a sinistra', right: 'a destra', 'slight left': 'leggermente a sinistra', 'slight right': 'leggermente a destra',
  'sharp left': 'nettamente a sinistra', 'sharp right': 'nettamente a destra', straight: 'dritto', uturn: 'con un\'inversione a U' };

export function stepText(step) {
  const m = step.maneuver || {};
  const on = step.name ? ` in ${step.name}` : '';
  const dir = MOD[m.modifier] || '';
  switch (m.type) {
    case 'depart': return `Parti${step.name ? ` su ${step.name}` : ''}`;
    case 'arrive': return 'Sei arrivato a destinazione';
    case 'turn': case 'end of road': return m.modifier === 'straight' ? `Prosegui dritto${on}` : `Svolta ${dir}${on}`;
    case 'continue': case 'new name': return `Continua${on || ' dritto'}`;
    case 'merge': return `Immettiti${on}`;
    case 'on ramp': return `Prendi la rampa${on}`;
    case 'off ramp': return `Prendi l'uscita${on}`;
    case 'fork': return `Al bivio tieni ${dir}${on}`;
    case 'roundabout': case 'rotary': return `Alla rotonda prendi la ${step.maneuver.exit || ''}ª uscita${on}`;
    case 'exit roundabout': case 'exit rotary': return `Esci dalla rotonda${on}`;
    default: return `Prosegui${on}`;
  }
}
export function stepIcon(step) {
  const mod = step.maneuver?.modifier || '';
  if (step.maneuver?.type === 'arrive') return 'location_on';
  if (mod.includes('left')) return 'chevron_left';
  if (mod.includes('right')) return 'chevron_right';
  return 'navigation';
}

export function fmtDuration(s) {
  const m = Math.round(s / 60);
  if (m < 60) return `${Math.max(m, 1)} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
}
export function fmtDistance(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}
