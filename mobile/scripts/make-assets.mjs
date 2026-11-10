// 앱 아이콘과 시작 화면의 원본을 만든다. 사이트 아이콘(src/app/apple-icon.tsx)과 같은 네이비 M 마크를 흰 바탕 가운데에 놓는다.
// 만든 원본으로 `npm run assets` 가 iOS 의 모든 크기를 만든다.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = fileURLToPath(new URL('../assets/', import.meta.url));
mkdirSync(out, { recursive: true });

const mark = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">
  <path d="M8 22.4V10.2L16 18l8-7.8v12.2" stroke="#051049" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 18v4.4" stroke="#F2C879" stroke-width="2.7" stroke-linecap="round"/>
  <circle cx="23.2" cy="7.8" r="1.7" fill="#F2C879"/>
</svg>`);

const white = { r: 255, g: 255, b: 255, alpha: 1 };

// width 는 캔버스 대비 마크의 크기.
async function place(file, size, width) {
  const logo = await sharp(mark(Math.round(size * width))).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: white } })
    .composite([{ input: logo, gravity: 'center' }])
    .flatten({ background: white })
    .png()
    .toFile(out + file);
}

await place('icon-only.png', 1024, 0.88);
await place('splash.png', 2732, 0.16);
await place('splash-dark.png', 2732, 0.16);
console.log('assets ready in', out);
