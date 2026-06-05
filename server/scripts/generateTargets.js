// One-shot generator: produces 50 simple black-on-transparent SVG silhouettes
// in server/public/targets/. Run once: `node scripts/generateTargets.js`.
// Pure geometry — no external assets. Caveman approach: one function per shape.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, '..', 'public', 'targets');

const S = 400;
const C = 200; // center

function wrap(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><g fill="#000">${body}</g></svg>`;
}

const shapes = {
  heart: () => wrap(`<path d="M200 340 C 60 240, 40 120, 130 90 C 170 80, 200 110, 200 140 C 200 110, 230 80, 270 90 C 360 120, 340 240, 200 340 Z"/>`),
  star: () => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 150 : 65;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${C + Math.cos(a) * r},${C + Math.sin(a) * r}`);
    }
    return wrap(`<polygon points="${pts.join(' ')}"/>`);
  },
  cat: () => wrap(`
    <path d="M120 130 L80 60 L150 110 Z"/>
    <path d="M280 130 L320 60 L250 110 Z"/>
    <ellipse cx="200" cy="220" rx="130" ry="110"/>
    <ellipse cx="200" cy="290" rx="155" ry="75"/>
  `),
  dog: () => wrap(`
    <ellipse cx="200" cy="220" rx="120" ry="110"/>
    <path d="M105 130 Q90 220 130 240 Z"/>
    <path d="M295 130 Q310 220 270 240 Z"/>
    <ellipse cx="200" cy="290" rx="60" ry="40"/>
  `),
  rabbit: () => wrap(`
    <ellipse cx="160" cy="100" rx="22" ry="80"/>
    <ellipse cx="240" cy="100" rx="22" ry="80"/>
    <circle cx="200" cy="240" r="90"/>
    <ellipse cx="200" cy="320" rx="110" ry="55"/>
  `),
  bird: () => wrap(`
    <ellipse cx="200" cy="220" rx="120" ry="80"/>
    <circle cx="290" cy="180" r="55"/>
    <polygon points="330,180 380,170 330,200"/>
    <polygon points="120,250 60,310 150,260"/>
  `),
  fish: () => wrap(`
    <ellipse cx="180" cy="200" rx="130" ry="70"/>
    <polygon points="310,200 380,140 380,260"/>
    <circle cx="120" cy="180" r="10" fill="#fff"/>
  `),
  butterfly: () => wrap(`
    <ellipse cx="120" cy="160" rx="90" ry="70"/>
    <ellipse cx="280" cy="160" rx="90" ry="70"/>
    <ellipse cx="130" cy="280" rx="70" ry="55"/>
    <ellipse cx="270" cy="280" rx="70" ry="55"/>
    <rect x="195" y="120" width="10" height="200"/>
  `),
  elephant: () => wrap(`
    <ellipse cx="180" cy="220" rx="140" ry="95"/>
    <path d="M280 230 Q360 220 340 320 Q330 360 290 350 L290 250 Z"/>
    <rect x="80" y="280" width="35" height="80"/>
    <rect x="180" y="290" width="35" height="70"/>
    <rect x="270" y="290" width="35" height="70"/>
  `),
  bear: () => wrap(`
    <circle cx="120" cy="120" r="40"/>
    <circle cx="280" cy="120" r="40"/>
    <circle cx="200" cy="220" r="120"/>
    <circle cx="200" cy="260" r="60" fill="#fff"/>
  `),
  turtle: () => wrap(`
    <ellipse cx="200" cy="220" rx="130" ry="90"/>
    <circle cx="200" cy="120" r="35"/>
    <rect x="80" y="240" width="40" height="35"/>
    <rect x="280" y="240" width="40" height="35"/>
    <rect x="130" y="300" width="40" height="35"/>
    <rect x="230" y="300" width="40" height="35"/>
  `),
  snail: () => wrap(`
    <circle cx="180" cy="200" r="110"/>
    <circle cx="180" cy="200" r="70" fill="#fff"/>
    <circle cx="180" cy="200" r="35"/>
    <ellipse cx="320" cy="270" rx="80" ry="30"/>
    <rect x="290" y="160" width="8" height="100"/>
    <rect x="320" y="160" width="8" height="100"/>
  `),
  house: () => wrap(`
    <polygon points="200,60 70,200 330,200"/>
    <rect x="100" y="200" width="200" height="160"/>
    <rect x="175" y="260" width="50" height="100" fill="#fff"/>
  `),
  car: () => wrap(`
    <rect x="60" y="220" width="280" height="80" rx="20"/>
    <path d="M110 220 L150 160 L260 160 L300 220 Z"/>
    <circle cx="120" cy="310" r="30"/>
    <circle cx="280" cy="310" r="30"/>
  `),
  plane: () => wrap(`
    <ellipse cx="200" cy="200" rx="150" ry="25"/>
    <polygon points="200,90 230,200 170,200"/>
    <polygon points="200,310 230,210 170,210"/>
    <polygon points="50,200 80,180 80,220"/>
  `),
  boat: () => wrap(`
    <polygon points="60,260 340,260 300,340 100,340"/>
    <rect x="195" y="80" width="10" height="180"/>
    <polygon points="200,90 290,230 200,230"/>
  `),
  key: () => wrap(`
    <circle cx="130" cy="200" r="70"/>
    <circle cx="130" cy="200" r="30" fill="#fff"/>
    <rect x="190" y="185" width="180" height="30"/>
    <rect x="300" y="215" width="20" height="40"/>
    <rect x="340" y="215" width="20" height="40"/>
  `),
  cup: () => wrap(`
    <path d="M110 130 L290 130 L270 320 L130 320 Z"/>
    <ellipse cx="200" cy="130" rx="90" ry="20"/>
    <path d="M290 170 Q360 170 360 230 Q360 290 290 290 L290 270 Q340 270 340 230 Q340 190 290 190 Z"/>
  `),
  umbrella: () => wrap(`
    <path d="M60 200 A 140 140 0 0 1 340 200 Z"/>
    <rect x="195" y="200" width="10" height="150"/>
    <path d="M205 340 Q230 350 230 320"/>
  `),
  anchor: () => wrap(`
    <circle cx="200" cy="90" r="25"/>
    <circle cx="200" cy="90" r="12" fill="#fff"/>
    <rect x="190" y="110" width="20" height="190"/>
    <rect x="140" y="140" width="120" height="18"/>
    <path d="M60 230 Q60 320 200 320 Q340 320 340 230 L320 230 Q320 300 200 300 Q80 300 80 230 Z"/>
  `),
  leaf: () => wrap(`
    <path d="M200 60 Q340 200 200 340 Q60 200 200 60 Z"/>
    <rect x="195" y="200" width="10" height="140" fill="#fff"/>
  `),
  mountain: () => wrap(`
    <polygon points="40,320 160,140 230,240 280,180 360,320"/>
  `),
  sun: () => wrap(`
    <circle cx="200" cy="200" r="90"/>
    ${Array.from({length: 12}).map((_, i) => {
      const a = (i * Math.PI * 2) / 12;
      const x1 = C + Math.cos(a) * 110;
      const y1 = C + Math.sin(a) * 110;
      const x2 = C + Math.cos(a) * 160;
      const y2 = C + Math.sin(a) * 160;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="14" stroke-linecap="round"/>`;
    }).join('')}
  `),
  cloud: () => wrap(`
    <circle cx="130" cy="220" r="60"/>
    <circle cx="190" cy="180" r="80"/>
    <circle cx="270" cy="200" r="70"/>
    <rect x="120" y="220" width="170" height="60"/>
  `),
  tree: () => wrap(`
    <rect x="180" y="240" width="40" height="120"/>
    <circle cx="200" cy="180" r="110"/>
  `),
  flower: () => wrap(`
    <circle cx="200" cy="120" r="45"/>
    <circle cx="120" cy="190" r="45"/>
    <circle cx="280" cy="190" r="45"/>
    <circle cx="160" cy="270" r="45"/>
    <circle cx="240" cy="270" r="45"/>
    <circle cx="200" cy="200" r="40" fill="#fff"/>
    <rect x="195" y="290" width="10" height="80"/>
  `),
  mushroom: () => wrap(`
    <path d="M60 220 Q60 100 200 100 Q340 100 340 220 Z"/>
    <rect x="160" y="220" width="80" height="140"/>
  `),
  drop: () => wrap(`<path d="M200 60 C 120 200, 100 280, 200 340 C 300 280, 280 200, 200 60 Z"/>`),
  snowflake: () => wrap(`
    ${Array.from({length: 6}).map((_, i) => {
      const a = (i * Math.PI) / 3;
      const x2 = C + Math.cos(a) * 150;
      const y2 = C + Math.sin(a) * 150;
      return `<line x1="${C}" y1="${C}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="14" stroke-linecap="round"/>`;
    }).join('')}
    <circle cx="200" cy="200" r="18"/>
  `),
  wave: () => wrap(`
    <path d="M40 220 Q100 140 160 220 T 280 220 T 400 220 L 400 280 L 0 280 Z"/>
  `),
  arrow: () => wrap(`
    <rect x="60" y="180" width="200" height="40"/>
    <polygon points="260,120 360,200 260,280"/>
  `),
  bolt: () => wrap(`<polygon points="230,40 100,220 180,220 150,360 300,160 220,160"/>`),
  moon: () => wrap(`<path d="M260 60 A 160 160 0 1 0 260 340 A 130 130 0 1 1 260 60 Z"/>`),
  diamond: () => wrap(`<polygon points="200,60 340,200 200,340 60,200"/>`),
  circle: () => wrap(`<circle cx="200" cy="200" r="150"/>`),
  square: () => wrap(`<rect x="60" y="60" width="280" height="280"/>`),
  triangle: () => wrap(`<polygon points="200,60 340,320 60,320"/>`),
  cross: () => wrap(`
    <rect x="170" y="60" width="60" height="280"/>
    <rect x="60" y="170" width="280" height="60"/>
  `),
  hourglass: () => wrap(`<polygon points="80,60 320,60 200,200 320,340 80,340 200,200"/>`),
  bell: () => wrap(`
    <path d="M120 290 Q120 120 200 120 Q280 120 280 290 Z"/>
    <rect x="100" y="285" width="200" height="20"/>
    <circle cx="200" cy="330" r="20"/>
  `),
  crown: () => wrap(`
    <polygon points="60,300 70,140 140,240 200,120 260,240 330,140 340,300"/>
    <rect x="60" y="300" width="280" height="30"/>
  `),
  pencil: () => wrap(`
    <polygon points="80,300 130,250 320,60 350,90 160,280"/>
    <rect transform="rotate(-45 90 290)" x="40" y="280" width="80" height="40"/>
  `),
  book: () => wrap(`
    <rect x="70" y="70" width="260" height="260"/>
    <rect x="80" y="80" width="240" height="240" fill="#fff"/>
    <rect x="190" y="70" width="20" height="260"/>
  `),
  gift: () => wrap(`
    <rect x="60" y="160" width="280" height="180"/>
    <rect x="60" y="160" width="280" height="40" fill="#fff"/>
    <rect x="190" y="160" width="20" height="180" fill="#fff"/>
    <path d="M100 120 Q140 60 200 120 Q260 60 300 120 Z"/>
  `),
  cake: () => wrap(`
    <rect x="80" y="180" width="240" height="140"/>
    <rect x="100" y="220" width="200" height="20" fill="#fff"/>
    <rect x="195" y="100" width="10" height="80"/>
    <ellipse cx="200" cy="100" rx="14" ry="22"/>
  `),
  apple: () => wrap(`
    <circle cx="160" cy="230" r="100"/>
    <circle cx="240" cy="230" r="100"/>
    <rect x="195" y="110" width="10" height="50"/>
    <path d="M200 130 Q260 110 270 70 Q220 80 200 130 Z"/>
  `),
  mug: () => wrap(`
    <path d="M120 180 L280 180 L260 340 L140 340 Z"/>
    <ellipse cx="200" cy="180" rx="80" ry="20"/>
    <path d="M280 200 Q330 200 330 250 Q330 300 280 300 L 280 280 Q310 280 310 250 Q310 220 280 220 Z"/>
  `),
  fan: () => wrap(`
    <path d="M200 320 L60 160 Q200 60 340 160 Z"/>
    <rect x="195" y="300" width="10" height="60"/>
  `),
  lantern: () => wrap(`
    <rect x="120" y="100" width="160" height="200" rx="40"/>
    <rect x="100" y="90" width="200" height="20"/>
    <rect x="100" y="290" width="200" height="20"/>
    <rect x="195" y="50" width="10" height="50"/>
    <rect x="160" y="160" width="80" height="80" fill="#fff"/>
  `),
  koi: () => wrap(`
    <ellipse cx="180" cy="200" rx="130" ry="60"/>
    <path d="M310 200 L380 140 L370 200 L380 260 Z"/>
    <path d="M180 140 Q200 100 220 140"/>
    <path d="M180 260 Q200 300 220 260"/>
    <circle cx="120" cy="190" r="8" fill="#fff"/>
  `),
};

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  let count = 0;
  for (const [id, builder] of Object.entries(shapes)) {
    const svg = builder().replace(/\n\s+/g, ' ').trim();
    await fs.writeFile(path.join(OUT_DIR, `${id}.svg`), svg, 'utf8');
    count++;
  }
  console.log(`Wrote ${count} silhouettes to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
