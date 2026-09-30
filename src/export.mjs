// Renders each post's figures (drawn in its figs module) and cover to PNG, 2x, on a transparent background, and writes the live
// Godbolt view to ../_includes. Only the figures a post uses are rendered.
// Needs Google Chrome. Run: node src/export.mjs [figure name]
import { writeFileSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = new URL('.', import.meta.url).pathname;
const root = `${here}../`;
const posts = [
  { post: '_posts/2026-09-28-ten-cycles.md', figs: './figs.mjs', img: 'img/', include: 'godbolt.html', cover: 'cover.html' },
  { post: '_posts/2026-09-30-fix-encoder.md', figs: './fix/figs.mjs', img: 'img/fix/', include: 'godbolt-fix.html', cover: 'fix/cover.html' },
];
const css = readFileSync(`${here}figures.css`, 'utf8');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..600&display=swap">';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shoot = (file, w, h, scale, out) => execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
  `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--virtual-time-budget=6000', `--screenshot=${out}`, `file://${file}`], { stdio: 'ignore' });
const only = process.argv[2];

for (const p of posts) {
  const { figures, godbolt, godboltRows = 39 } = await import(p.figs);
  const img = `${root}${p.img}`;
  mkdirSync(img, { recursive: true });
  const text = readFileSync(`${root}${p.post}`, 'utf8');
  const used = new Set([...text.matchAll(/img\/(?:fix\/)?fig-(\w+)\.png/g)].map((m) => m[1]));
  // The page shows the Godbolt view live, from _includes; the PNG of it is for LinkedIn.
  if (text.includes(`include ${p.include}`)) used.add('godbolt');
  const all = { ...Object.fromEntries(Object.entries(figures).map(([k, f]) => [k, f()])), godbolt: godbolt() };
  for (const [name, markup] of Object.entries(all)) {
    if (!used.has(name) || (only && only !== name)) continue;
    // The Godbolt view is HTML: rows of 22px under a header, in a 1100px grid.
    const [w, h] = name === 'godbolt' ? [1100, 34 + 20 + godboltRows * 22 + 2] : markup.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1).map(Number);
    const page = `${here}.export-${name}.html`;
    writeFileSync(page, `<!doctype html><meta charset="utf-8">${fonts}<style>${css}
.wrap { width: ${w}px; padding: 24px; } .wrap svg { display: block; width: 100%; height: auto; }</style><div class="wrap">${markup}</div>`);
    shoot(page, w + 48, h + 48, 2, `${img}fig-${name}.png`);
    unlinkSync(page);
    console.log(`${p.img}fig-${name}.png`);
  }
  // The live Godbolt view for the page: the same markup as the PNG, plus the hover script.
  if (used.has('godbolt') && (!only || only === 'godbolt')) {
    mkdirSync(`${root}_includes`, { recursive: true });
    writeFileSync(`${root}_includes/${p.include}`, `<div class="gb-wrap">
${godbolt()}
</div>
<script>
(() => {
  const gb = document.currentScript.previousElementSibling.querySelector('.gb');
  const parts = gb.querySelectorAll('[data-g]');
  const show = (g) => {
    gb.classList.toggle('focus', g !== null);
    parts.forEach((e) => e.classList.toggle('hl', e.dataset.g === g));
  };
  parts.forEach((e) => {
    e.addEventListener('mouseenter', () => show(e.dataset.g));
    e.addEventListener('focus', () => show(e.dataset.g));
  });
  gb.addEventListener('mouseleave', () => show(null));
  gb.addEventListener('focusout', () => show(null));
})();
</script>
`);
    console.log(`_includes/${p.include}`);
  }
  if (!only || only === 'cover') { shoot(`${here}${p.cover}`, 1280, 720, 1.5, `${img}cover.png`); console.log(`${p.img}cover.png`); }
}
