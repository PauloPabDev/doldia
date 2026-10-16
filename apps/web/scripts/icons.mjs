// Genera los íconos PNG de la PWA a partir de public/icons/icon.svg.
// Uso: node scripts/icons.mjs (requiere sharp, que ya instala Next).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// sharp llega como dependencia de Next: se resuelve desde su paquete.
const nextPkg = createRequire(import.meta.url).resolve('next/package.json');
const sharp = createRequire(nextPkg)('sharp');
const dir = path.resolve(import.meta.dirname, '../public/icons');
const svg = readFileSync(path.join(dir, 'icon.svg'));

const square = (size, file) => sharp(svg).resize(size, size).png().toFile(path.join(dir, file));

await square(192, 'icon-192.png');
await square(512, 'icon-512.png');
await square(180, 'apple-touch-icon.png');
// Maskable: el dibujo ocupa el 80 % central (zona segura) sobre fondo lleno.
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2F6F5E' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(path.join(dir, 'icon-maskable-512.png'));
console.log('Íconos generados en', dir);
