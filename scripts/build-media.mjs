// Packs the Blender renders (assets-src/renders/<job>) into web frames + src/media.json.
// Every frame of a sequence is cropped to the same union box so frames stay registered.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC = 'assets-src/renders';
const OUT = 'public/media';
const round = (v) => Math.round(v * 1e4) / 1e4;

async function alphaBox(file, threshold = 3) {
  const { data, info } = await sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    const row = y * info.width;
    for (let x = 0; x < info.width; x++) {
      if (data[row + x] > threshold) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1, w: info.width, h: info.height };
}

function union(boxes, padFrac) {
  const b = boxes.reduce((a, c) => ({
    x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1),
    w: c.w, h: c.h,
  }));
  const pad = Math.round(Math.max(b.x1 - b.x0, b.y1 - b.y0) * padFrac);
  const x = Math.max(0, b.x0 - pad), y = Math.max(0, b.y0 - pad);
  return { x, y, width: Math.min(b.w, b.x1 + pad + 1) - x, height: Math.min(b.h, b.y1 + pad + 1) - y, fw: b.w, fh: b.h };
}

const remap = (crop) => ([u, v]) => [round((u * crop.fw - crop.x) / crop.width), round((v * crop.fh - crop.y) / crop.height)];

// Lifts the alpha floor: the shadow catcher leaves a faint occlusion haze across the whole
// frame, which reads as a tinted square on the page. Real contact shadows sit well above it.
async function withAlphaFloor(file, crop, floor) {
  const { data, info } = await sharp(file).extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = 255 / (255 - floor);
  for (let i = 3; i < data.length; i += 4) data[i] = Math.max(0, Math.round((data[i] - floor) * k));
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function writeFrame(file, crop, widths, dir, name, quality, alphaFloor = 0) {
  for (const w of widths) {
    await fs.mkdir(path.join(OUT, dir, String(w)), { recursive: true });
    const src = alphaFloor
      ? await withAlphaFloor(file, crop, alphaFloor)
      : sharp(file).extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height });
    await src
      .resize({ width: Math.min(w, crop.width) })
      // alpha below 80 bands the soft shadows; above it the files roughly double
      .webp({ quality, alphaQuality: 80, effort: 6, smartSubsample: true })
      .toFile(path.join(OUT, dir, String(w), `${name}.webp`));
  }
}

async function sequence(job, widths, quality, anchorsOf, { alphaFloor = 0 } = {}) {
  const dir = path.join(SRC, job);
  const meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'));
  const files = (await fs.readdir(dir)).filter((f) => /^\d{3}\.png$/.test(f)).sort();
  if (files.length !== meta.frames.length) throw new Error(`${job}: ${files.length} frames, meta has ${meta.frames.length}`);
  const boxes = await Promise.all(files.map((f) => alphaBox(path.join(dir, f), Math.max(3, alphaFloor + 2))));
  const crop = union(boxes, 0.015);
  const map = remap(crop);
  // where the solid object (not its shadow) starts, so layouts can overlap it precisely
  const solid = await Promise.all(files.map((f) => alphaBox(path.join(dir, f), 250)));
  const solidTop = Math.min(...solid.map((b) => b.y0));
  const solidBottom = Math.max(...solid.map((b) => b.y1));
  for (const [i, f] of files.entries()) await writeFrame(path.join(dir, f), crop, widths, job, String(i).padStart(3, '0'), quality, alphaFloor);
  return {
    count: files.length,
    aspect: round(crop.width / crop.height),
    solidTop: round((solidTop - crop.y) / crop.height),
    solidBottom: round((solidBottom - crop.y) / crop.height),
    sizes: widths.map((w) => ({ dir: String(w), px: Math.min(w, crop.width) })),
    path: `/media/${job}`,
    frames: meta.frames.map((fr) => anchorsOf(fr, map)),
  };
}

const mapAll = (obj, map) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, map(v)]));

const JOBS = process.argv.slice(2).length ? process.argv.slice(2) : ['turn', 'explode', 'views'];
const manifest = JSON.parse(await fs.readFile('src/media.json', 'utf8').catch(() => '{}'));

if (JOBS.includes('turn')) {
  manifest.turn = await sequence('turn', [1800, 900], 78, (fr, map) => ({ led: map(fr.led), center: map(fr.center) }));
}
if (JOBS.includes('float')) {
  manifest.float = await sequence('float', [960, 520], 80, (fr, map) => ({ led: map(fr.led) }));
}
if (JOBS.includes('explode')) {
  // only the anchors the Inside callouts point at
  const keys = ['charger', 'uv', 'button', 'th', 'shield', 'battery', 'coil', 'logo'];
  const pick = (obj) => Object.fromEntries(keys.map((k) => [k, obj[k]]));
  manifest.explode = await sequence('explode', [1400, 760], 78, (fr, map) => ({
    lid: fr.lid, board: fr.board, battery: fr.battery, coil: fr.coil, anchors: mapAll(pick(fr.anchors), map),
  }), { alphaFloor: 14 });
}

if (JOBS.includes('views')) {
  const dir = path.join(SRC, 'views');
  const meta = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'));
  manifest.views = { mm: meta.mm };
  for (const name of Object.keys(meta.views)) {
    const file = path.join(dir, `${name}.png`);
    const crop = union([await alphaBox(file)], 0.02);
    await writeFrame(file, crop, [1600, 800], 'views', name, 86);
    manifest.views[name] = {
      aspect: round(crop.width / crop.height),
      sizes: [1600, 800].map((w) => ({ dir: String(w), px: Math.min(w, crop.width) })),
      points: mapAll(meta.views[name], remap(crop)),
    };
  }
}

await fs.writeFile('src/media.json', JSON.stringify(manifest));
let bytes = 0;
for (const job of JOBS) {
  for (const sub of await fs.readdir(path.join(OUT, job))) {
    const p = path.join(OUT, job, sub);
    const st = await fs.stat(p);
    const files = st.isDirectory() ? await fs.readdir(p) : [sub];
    let sum = 0;
    for (const f of files) sum += (await fs.stat(st.isDirectory() ? path.join(p, f) : p)).size;
    bytes += sum;
    console.log(`${job}/${sub}: ${files.length} files, ${(sum / 1024).toFixed(0)} KB`);
  }
}
console.log(`total ${(bytes / 1048576).toFixed(2)} MB`);
