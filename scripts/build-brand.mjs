// Wordmark as an alpha mask (coloured in CSS) and favicons from the app icon.
import sharp from 'sharp';
import fs from 'node:fs/promises';

await fs.mkdir('public/brand', { recursive: true });
const meta = await sharp('assets-src/sureva_logo.png').metadata();
console.log('logo', meta.width, meta.height, 'alpha:', meta.hasAlpha);

const { data, info } = await sharp('assets-src/sureva_logo.png').ensureAlpha()
  .trim({ threshold: 8 }).resize({ width: 640 }).png().toBuffer({ resolveWithObject: true });
await fs.writeFile('public/brand/wordmark-mask.png', data);
console.log('wordmark', info.width, info.height, (data.length / 1024).toFixed(1) + 'KB');

await sharp('assets-src/app-icon.png').resize(64, 64).png().toFile('public/brand/favicon-64.png');
await sharp('assets-src/app-icon.png').resize(180, 180).png().toFile('public/brand/apple-touch-icon.png');
