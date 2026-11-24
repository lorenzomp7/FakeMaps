import fs from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [, , a, b, out] = process.argv;
const A = PNG.sync.read(fs.readFileSync(a));
const B = PNG.sync.read(fs.readFileSync(b));
const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
const crop = (img) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
const d = new PNG({ width: w, height: h });
const n = pixelmatch(crop(A).data, crop(B).data, d.data, w, h, { threshold: 0.1 });
fs.writeFileSync(out, PNG.sync.write(d));
console.log(JSON.stringify({ diffPixels: n, pct: +(100 * n / (w * h)).toFixed(2), sizeA: [A.width, A.height], sizeB: [B.width, B.height] }));
