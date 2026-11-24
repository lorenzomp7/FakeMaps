// Copia le librerie e genera gli asset statici serviti da GitHub Pages.
// Uso: npm run build:assets
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const out = (...p) => path.join(root, ...p);

// 1) MapLibre GL (BSD-3-Clause)
await fs.mkdir(out('vendor/maplibre'), { recursive: true });
for (const f of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  await fs.copyFile(nm('maplibre-gl/dist', f), out('vendor/maplibre', f));
}
await fs.copyFile(nm('maplibre-gl/LICENSE.txt'), out('vendor/maplibre/LICENSE.txt'));

// 2) Roboto (SIL OFL 1.1), solo latin
await fs.mkdir(out('assets/fonts'), { recursive: true });
for (const w of [400, 500, 700]) {
  await fs.copyFile(nm('@fontsource/roboto/files', `roboto-latin-${w}-normal.woff2`), out('assets/fonts', `roboto-${w}.woff2`));
}
await fs.copyFile(nm('@fontsource/roboto/LICENSE'), out('assets/fonts/LICENSE-Roboto.txt'));

// 3) Sprite di icone Material Symbols (Apache-2.0)
const icons = [
  'menu', 'search', 'close', 'directions', 'bookmark', 'bookmark-fill', 'history', 'my_location', 'add', 'remove',
  'layers', 'restaurant', 'hotel', 'local_cafe', 'museum', 'local_gas_station', 'local_pharmacy', 'grocery',
  'train', 'location_on', 'location_on-fill', 'schedule', 'public', 'call', 'share', 'content_copy', 'explore_nearby',
  'edit', 'directions_car', 'directions_walk', 'directions_bike', 'swap_vert', 'chevron_left', 'chevron_right',
  'arrow_back', 'info', 'accessible', 'trip_origin', 'travel_explore', 'map', 'check', 'keyboard_arrow_down',
  'navigation', 'park', 'local_bar', 'attractions', 'link',
];
let symbols = '';
for (const name of icons) {
  const svg = await fs.readFile(nm('@material-symbols/svg-400/outlined', `${name}.svg`), 'utf8');
  const d = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => `<path d="${m[1]}"/>`).join('');
  if (!d) throw new Error(`icona senza path: ${name}`);
  symbols += `<symbol id="i-${name}" viewBox="0 -960 960 960">${d}</symbol>`;
}
await fs.writeFile(out('assets/icons.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>\n`);
await fs.copyFile(nm('@material-symbols/svg-400/LICENSE'), out('assets/LICENSE-MaterialSymbols.txt'));

console.log(`ok: vendor/maplibre, assets/fonts, assets/icons.svg (${icons.length} icone)`);
