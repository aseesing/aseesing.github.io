// Renders the figures ../index.md uses (drawn in figs.mjs) and the cover to PNG in ../img, 2x, on white.
// Needs Google Chrome. Run: node export.mjs [figure name]
import { writeFileSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { figures, godbolt } from './figs.mjs';

const here = new URL('.', import.meta.url).pathname;
const img = new URL('../img/', import.meta.url).pathname;
mkdirSync(img, { recursive: true });
const css = readFileSync(`${here}figures.css`, 'utf8');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..600&display=swap">';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shoot = (file, w, h, scale, out) => execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--virtual-time-budget=6000', `--screenshot=${out}`, `file://${file}`], { stdio: 'ignore' });

// Only the figures ../index.md uses, so an unused one can stay in figs.mjs without cluttering img/.
const used = new Set([...readFileSync(`${here}../index.md`, 'utf8').matchAll(/img\/fig-(\w+)\.png/g)].map((m) => m[1]));
const only = process.argv[2];
const all = { ...Object.fromEntries(Object.entries(figures).map(([k, f]) => [k, f()])), godbolt: godbolt() };
for (const k of Object.keys(all)) if (!used.has(k)) delete all[k];
for (const [name, markup] of Object.entries(all)) {
  if (only && only !== name) continue;
  // The Godbolt view is HTML: 39 source rows of 22px under a header, in a 1100px grid.
  const [w, h] = name === 'godbolt' ? [1100, 34 + 20 + 39 * 22 + 2] : markup.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
  const page = `${here}.export-${name}.html`;
  writeFileSync(page, `<!doctype html><meta charset="utf-8">${fonts}<style>${css}
.wrap { width: ${w}px; padding: 24px; } .wrap svg { display: block; width: 100%; height: auto; }</style><div class="wrap">${markup}</div>`);
  shoot(page, w + 48, h + 48, 2, `${img}fig-${name}.png`);
  unlinkSync(page);
  console.log(name);
}
if (!only || only === 'cover') { shoot(`${here}cover.html`, 1280, 720, 1.5, `${img}cover.png`); console.log('cover'); }
