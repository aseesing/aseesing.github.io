// Shared by the figure generators of every post: SVG helpers on one set of CSS classes (figures.css), and
// the Godbolt-style view of source, instructions and what each one does.
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const f = (n) => Math.round(n * 10) / 10;

// Bar with a 4px rounded data end, square at the baseline.
export function hbar(x, y, w, h, cls, title) {
  const r = Math.min(4, w / 2, h / 2);
  const d = `M${f(x)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x)}Z`;
  return `<path class="${cls}" d="${d}">${title ? `<title>${esc(title)}</title>` : ''}</path>`;
}
export function vbar(x, base, w, h, cls, title) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const top = base - h;
  const d = `M${f(x)} ${f(base)}V${f(top + r)}Q${f(x)} ${f(top)} ${f(x + r)} ${f(top)}H${f(x + w - r)}Q${f(x + w)} ${f(top)} ${f(x + w)} ${f(top + r)}V${f(base)}Z`;
  return `<path class="${cls}" d="${d}">${title ? `<title>${esc(title)}</title>` : ''}</path>`;
}
export const text = (x, y, s, cls = 't', anchor = 'start', extra = '') =>
  `<text x="${f(x)}" y="${f(y)}" class="${cls}" text-anchor="${anchor}"${extra}>${s}</text>`;
export const svg = (w, h, label, body) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">
${body}</svg>`;

// Arrowheads as polygons, so each takes its line's class.
export function arrow(x1, y1, x2, y2, cls = 'ln') {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 8, W = 4;
  const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
  const p = [[x2, y2], [bx + W * Math.sin(a), by - W * Math.cos(a)], [bx - W * Math.sin(a), by + W * Math.cos(a)]];
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(bx)}" y2="${f(by)}" class="${cls}"/>` +
    `<polygon points="${p.map((q) => q.map(f).join(',')).join(' ')}" class="${cls}-head"/>`;
}
export function polyArrow(pts, cls = 'ln') {
  const segs = pts.slice(0, -1).map((p) => p.map(f).join(',')).join(' ');
  const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
  return `<polyline points="${segs} ${f(x1)},${f(y1)}" class="${cls}" fill="none"/>` + arrow(x1, y1, x2, y2, cls);
}
export function box(x, y, w, h, title, sub, cls = 'box') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="${cls}"/>` +
    text(x + w / 2, y + h / 2 - 3, esc(title), 't-box', 'middle') +
    (sub ? text(x + w / 2, y + h / 2 + 13, esc(sub), 't-sub', 'middle') : '');
}

// The Godbolt-style view: source lines, GCC's instructions in its own order, and what each does. Each
// source line has a group letter; its instructions share the group's color, and hovering links them.
export function godboltView(src, asm, head) {
  const letters = [...new Set([...src.map(([g]) => g), ...asm.map(([g]) => g)].filter(Boolean))].sort();
  const hue = (g) => (g ? ` h${letters.indexOf(g) % 8}` : '');
  const s = src.map(([g, t]) => `<div class="gb-l${hue(g)}"${g ? ` data-g="${g}" tabindex="0"` : ''}>${esc(t) || '&nbsp;'}</div>`).join('');
  const a = asm.map(([g, op, args, why]) =>
    `<div class="gb-a${hue(g)}" data-g="${g}"><span class="gb-op">${esc(op)}</span><span class="gb-args">${esc(args)}</span><span class="gb-why">${esc(why)}</span></div>`).join('');
  return `<div class="gb" role="group" aria-label="The C++ source, the instructions GCC 14.2 makes of it in GCC's order, and what each instruction does">
<div class="gb-head"><span>C++</span><span>${esc(head)}</span><span>what it does</span></div>
<div class="gb-body"><div class="gb-src">${s}</div><div class="gb-asm">${a}</div></div></div>`;
}
