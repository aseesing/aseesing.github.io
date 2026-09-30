// Figure generator for the ten-cycles post (challenge 20): every SVG is computed from its data here, so
// marks, ticks and labels share one scale.
import { esc, f, hbar, vbar, text, svg, arrow, polyArrow, box, godboltView } from './lib.mjs';

// Fig: digit-length distribution of the scored stream.
export function figLengths() {
  const share = [5, 5, 5, 5, 11.25, 11.25, 6.25, 6.25, 0.9, 11.5, 2.5, 2.5, 2.5, 12.5, 2.5, 2.5, 2.5, 2.5, 2.5, 0];
  const W = 760, H = 300, x0 = 56, band = 34, base = 240, k = 180 / 14;
  let b = '';
  for (const g of [0, 5, 10]) {
    const y = base - g * k;
    b += `<line x1="${x0}" x2="${x0 + 20 * band}" y1="${f(y)}" y2="${f(y)}" class="grid"/>`;
    b += text(x0 - 8, y + 4, `${g} %`, 't t-num', 'end');
  }
  share.forEach((v, i) => {
    const d = i + 1, x = x0 + i * band + 6;
    b += vbar(x, base, 22, v * k, d <= 16 ? 'm-accent' : 'm-warm', `${d} digits: ${v} % of values`);
    b += text(x + 11, base + 18, d, 't t-num', 'middle');
  });
  b += text(x0 + 19 * band + 17, base - 6, '0', 't t-num', 'middle');
  b += text(x0 + 10 * band, base + 40, 'digits in the value', 't', 'middle');
  // Peaks named by the field that makes them.
  const peak = (d, v, s) => text(x0 + (d - 1) * band + 17, base - v * k - 8, s, 't t-small', 'middle');
  b += text(x0 + 5 * band, base - 11.25 * k - 8, 'qty + price', 't t-small', 'middle');
  b += peak(10, 11.5, 'seq. no.');
  b += peak(14, 12.5, 'timestamps');
  // The 8 | 9 split a length branch would have to predict.
  const sx = x0 + 8 * band;
  b += `<line x1="${sx}" x2="${sx}" y1="46" y2="${base}" class="ln-thin"/>`;
  b += text(sx - 6, 56, '≤ 8 digits: 55 %', 't t-strong', 'end');
  b += text(sx + 6, 56, 'more: 45 %', 't t-strong', 'start');
  // Legend.
  b += `<rect x="${x0}" y="8" width="12" height="12" rx="2" class="m-accent"/>` + text(x0 + 18, 18, '≤ 16 digits · fits one 16-byte register · 92.5 %');
  b += `<rect x="${x0 + 350}" y="8" width="12" height="12" rx="2" class="m-warm"/>` + text(x0 + 368, 18, '17–19 digits · needs top digits · 7.5 %');
  return svg(W, H, 'Share of values by digit count: 55 percent have 8 digits or fewer, 92.5 percent fit in 16 digits, none have 20.', b);
}

// Fig: the approaches on one real machine, in cycles of its core clock.
export function figLangs() {
  const rows = [['snprintf', 124.3, 'm-neutral'], ['÷10 loop', 62.8, 'm-neutral'], ['÷100 pair loop', 40.2, 'm-neutral'],
    ['std::to_chars', 40.8, 'm-neutral'], ['SWAR · our portable path', 21.7, 'm-accent']];
  const W = 760, x0 = 236, k = 480 / 130, y0 = 18, pitch = 40, H = y0 + rows.length * pitch + 44;
  let b = '';
  for (let t = 0; t <= 125; t += 25) {
    const x = x0 + t * k;
    b += `<line x1="${f(x)}" x2="${f(x)}" y1="10" y2="${y0 + rows.length * pitch - 8}" class="grid"/>`;
    b += text(x, y0 + rows.length * pitch + 10, t, 't t-num', 'middle');
  }
  b += text(x0, y0 + rows.length * pitch + 30, 'cycles per conversion', 't t-small');
  rows.forEach(([name, v, cls], i) => {
    const y = y0 + i * pitch;
    b += text(x0 - 12, y + 15, esc(name), cls === 'm-accent' ? 't t-strong' : 't', 'end');
    b += hbar(x0, y, v * k, 22, cls, `${name}: ${v} cycles per conversion`);
    b += text(x0 + v * k + 8, y + 15, Math.round(v), 't t-num t-strong');
  });
  return svg(W, H, 'Cycles per conversion on an M2 Max: snprintf 124, the divide-by-10 loop 63, the divide-by-100 pair loop 40, std::to_chars 41, the SWAR path 22.', b);
}

// Fig: what one conversion does, and which part is the critical path.
export function figFlow() {
  const W = 760, H = 330, bw = 108, bh = 52;
  let b = '';
  b += text(124, 26, 'length: ≈ 10 cycles, runs beside the digits', 't t-small');
  b += box(16, 144, 84, bh, 'value', 'uint64');
  b += box(124, 40, bw, bh, 'lzcnt', 'leading zeros');
  b += box(248, 40, bw, bh, 'length table', 'cmp + sbb');
  b += box(372, 40, bw, bh, 'shape table', 'top_len, zeros');
  b += box(124, 144, bw, bh, '2 × mul', '÷10¹⁶ and ÷10⁸', 'box box-hot');
  b += box(248, 144, bw, bh, 'imul + lea', '4·high, 4·low', 'box box-hot');
  b += box(372, 144, bw, bh, 'to vector', 'vmovq, vinsert', 'box box-hot');
  b += box(496, 144, bw, bh, 'digit kernel', '11 ymm ops', 'box box-hot');
  b += box(620, 144, 124, bh, 'pack + pshufb', 'store 16 B', 'box box-hot');
  b += box(372, 250, bw, bh, 'top-digit table', '7.4 KB');
  b += box(496, 250, bw, bh, 'store 4 B', 'at buf');
  // Main chain.
  b += arrow(100, 170, 124, 170, 'ln-hot');
  for (const x of [232, 356, 480, 604]) b += arrow(x, 170, x + 16, 170, 'ln-hot');
  b += text(434, 224, 'critical path ≈ 40 cycles', 't t-hot', 'middle');
  // Length lane.
  b += polyArrow([[58, 144], [58, 66], [124, 66]]);
  b += arrow(232, 66, 248, 66);
  b += arrow(356, 66, 372, 66);
  b += polyArrow([[480, 66], [682, 66], [682, 144]]);
  b += text(581, 58, 'shuffle mask, store offset', 't t-small', 'middle');
  // Top digits.
  b += polyArrow([[178, 196], [178, 276], [372, 276]]);
  b += text(275, 268, 'top = value ÷ 10¹⁶', 't t-small', 'middle');
  b += arrow(480, 276, 496, 276);
  return svg(W, H, 'Dataflow of one conversion: the length is computed beside the digits and meets them only at the final shuffle and store.', b);
}

// Fig: the two stores, for a short and a long value.
export function figStores() {
  const W = 760, H = 306, x0 = 196, cw = 27, ch = 26;
  let b = '';
  for (let i = 0; i < 20; i++) b += text(x0 + i * cw + cw / 2, 40, i, 't t-idx', 'middle');
  const cell = (i, y, s, kind) => {
    const cls = kind === 'keep' ? 'cell cell-keep' : kind === 'nul' ? 'cell cell-nul' : 'cell';
    const tcls = kind === 'keep' ? 't-cell t-cell-on' : kind === 'scratch' || kind === 'nul' ? 't-cell t-cell-dim' : 't-cell';
    return `<rect x="${x0 + i * cw + 1}" y="${y}" width="${cw - 2}" height="${ch}" rx="3" class="${cls}"/>` +
      text(x0 + i * cw + cw / 2, y + 17, esc(s), tcls, 'middle');
  };
  const row = (y, label, cells) => text(x0 - 12, y + 17, esc(label), 't', 'end') + cells.map(([i, s, k]) => cell(i, y, s, k)).join('');
  const A = '1234567000000000', B16 = '7433600123456789', Bres = '1727433600123456789';
  b += text(16, 64, '1234567 · 7 digits', 't t-strong');
  b += row(76, 'top, 4 B at buf', [0, 1, 2, 3].map((i) => [i, '·', 'nul']));
  b += row(108, '16 B at buf + 0', [...A].map((c, i) => [i, c, i < 7 ? '' : 'scratch']));
  b += row(140, 'buf after · length 7', [...A].map((c, i) => [i, c, i < 7 ? 'keep' : 'scratch']));
  b += text(16, 196, '1727433600123456789 · 19 digits', 't t-strong');
  b += row(208, 'top, 4 B at buf', [[0, '1', ''], [1, '7', ''], [2, '2', ''], [3, '·', 'nul']]);
  b += row(240, '16 B at buf + 3', [...B16].map((c, i) => [i + 3, c, '']));
  b += row(272, 'buf after · length 19', [...Bres].map((c, i) => [i, c, 'keep']));
  return svg(W, H, 'Both stores always happen: the 16 digit bytes land right after the top digits and overwrite the top store when there are none.', b);
}

// Fig: SWAR, eight digits in one 64-bit word.
export function figSwar() {
  const W = 760, x0 = 216, bw = 512, h = 32, ys = [30, 86, 142, 198, 254], H = 300;
  const rows = [
    ['12345678', 1, 'one value < 10⁸', 'in a 64-bit register'],
    ['1234|5678', 2, 'split by 10⁴', '2 multiplies'],
    ['12|34|56|78', 4, '÷ 100 per 32-bit half', '2 multiplies'],
    ['1|2|3|4|5|6|7|8', 8, '÷ 10 per 16-bit quarter', '2 multiplies'],
    ["'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'", 8, "add '0' to every byte", 'store 8 bytes as text'],
  ];
  let b = text(x0, 18, 'byte 0', 't t-idx') + text(x0 + bw, 18, 'byte 7', 't t-idx', 'end');
  rows.forEach(([s, n, t1, t2], r) => {
    const y = ys[r], parts = s.split('|'), w = bw / n;
    b += text(x0 - 14, y + 13, esc(t1), 't t-strong', 'end') + text(x0 - 14, y + 28, esc(t2), 't t-sub', 'end');
    parts.forEach((p, i) => {
      b += `<rect x="${f(x0 + i * w + 1)}" y="${y}" width="${f(w - 2)}" height="${h}" rx="4" class="${r === 4 ? 'cell cell-keep' : 'cell'}"/>`;
      b += text(x0 + i * w + w / 2, y + 21, esc(p), r === 4 ? 't-cell t-cell-on' : 't-cell', 'middle');
    });
  });
  return svg(W, H, 'SWAR: one 64-bit register is split by 10^4, then by 100 in each half, then by 10 in each quarter, leaving one digit per byte.', b);
}

// Fig: the AVX2 digit kernel on one 128-bit half.
export function figLanes() {
  const W = 760, x0 = 216, lw = 64, h = 30, pitch = 48, y0 = 34;
  const rows = [
    [['12345678', 8]], [['1234', 4], ['5678', 4]],
    [['1234', 1], ['1234', 1], ['1234', 1], ['1234', 1], ['5678', 1], ['5678', 1], ['5678', 1], ['5678', 1]],
    [['1', 1], ['12', 1], ['123', 1], ['1234', 1], ['5', 1], ['56', 1], ['567', 1], ['5678', 1]],
    [['0', 1], ['10', 1], ['120', 1], ['1230', 1], ['0', 1], ['50', 1], ['560', 1], ['5670', 1]],
    [["'1'", 1], ["'2'", 1], ["'3'", 1], ["'4'", 1], ["'5'", 1], ["'6'", 1], ["'7'", 1], ["'8'", 1]],
  ];
  const labels = [['one 8-digit half', 'a 64-bit lane'], ['split by 10⁴', 'vpmuludq, vpaddq'], ['repeat each group', 'vpshufb'],
    ['÷1000, ÷100, ÷10, ÷1', '2 × vpmulhuw'], ['10 × the lane before', 'vpsllq, vpmullw'], ["subtract, add '0'", 'vpsubw, vpaddw, pack']];
  let b = text(x0, 20, '16-bit lanes', 't t-idx') + text(x0 + 8 * lw, 20, 'the other 128-bit half converts low the same way', 't t-idx', 'end');
  rows.forEach((cells, r) => {
    const y = y0 + r * pitch;
    b += text(x0 - 14, y + 12, esc(labels[r][0]), 't t-strong', 'end') + text(x0 - 14, y + 27, esc(labels[r][1]), 't t-sub', 'end');
    let x = x0;
    for (const [s, n] of cells) {
      const on = r === 5;
      b += `<rect x="${x + 1}" y="${y}" width="${n * lw - 2}" height="${h}" rx="4" class="${on ? 'cell cell-keep' : 'cell'}"/>`;
      b += text(x + (n * lw) / 2, y + 20, esc(s), on ? 't-cell t-cell-on' : 't-cell', 'middle');
      x += n * lw;
    }
  });
  const H = y0 + 5 * pitch + h + 12;
  return svg(W, H, 'The AVX2 kernel: 12345678 splits into 1234 and 5678, each is repeated in four 16-bit lanes, divided by 1000, 100, 10 and 1, and each digit is its lane minus ten times the lane before.', b);
}

// Fig: certified cycles per conversion, iteration by iteration.
export function figJourney() {
  const rows = [
    ['snprintf · the start', 256, 'm-neutral', '256'],
    ['1 · SWAR, no branch', 59, 'm-accent', '59  (−197)'],
    ['2 · AVX2 lanes', 21, 'm-accent', '21  (−38)'],
    ['3 · long values branch off', 15, 'm-accent', '15  (−6)'],
    ['4 · pshufb drops zeros', 14, 'm-accent', '14  (−1)'],
    ['5 · shorter kernel', 13, 'm-accent', '13  (−1)'],
    ['6 · branchless, unrolled', 11, 'm-accent', '11  (−2)'],
    ['7 – 9 · typed, interleaved', 10, 'm-accent', '10  (−1)'],
  ];
  const W = 760, x0 = 252, k = 440 / 256, y0 = 12, pitch = 32, H = y0 + rows.length * pitch + 30;
  let b = '';
  for (let t = 0; t <= 250; t += 50) {
    const x = x0 + t * k;
    b += `<line x1="${f(x)}" x2="${f(x)}" y1="6" y2="${y0 + rows.length * pitch - 8}" class="grid"/>`;
    b += text(x, y0 + rows.length * pitch + 10, t, 't t-num', 'middle');
  }
  b += text(W - 8, y0 + rows.length * pitch + 10, 'cycles', 't t-num', 'end');
  rows.forEach(([name, v, cls, lab], i) => {
    const y = y0 + i * pitch;
    b += text(x0 - 12, y + 14, esc(name), 't', 'end');
    b += hbar(x0, y, v * k, 20, cls, `${name}: ${v} cycles on the target`);
    b += text(x0 + v * k + 8, y + 14, esc(lab), 't t-num t-strong');
  });
  return svg(W, H, 'Cycles per conversion on the target: 256 for snprintf, 59, 21, 15, 14, 13, 11, and 10', b);
}

// Fig: one conversion's dependency chain after iteration 6.
export function figChain() {
  const segs = [['load', 4, 'n'], ['mul', 4, 'n'], ['shr', 1, 'n'], ['imul', 3, 'n'], ['sub', 1, 'n'], ['vmovq', 3, 'n'], ['ins', 1, 'n'], ['14 vector µops in series · 24 cycles', 24, 'v']];
  const W = 760, x0 = 40, k = 680 / 41, y = 52, h = 34, H = 160;
  let b = '', x = x0;
  const head = 17 * k;
  b += `<polyline points="${x0},40 ${x0},34 ${f(x0 + head)},34 ${f(x0 + head)},40" class="ln-thin" fill="none"/>`;
  b += text(x0, 26, 'the scalar head, ≈ 17 cycles: the vector µops already wait in the 36-entry FP scheduler', 't t-small');
  for (const [name, c, kind] of segs) {
    const w = c * k;
    b += `<rect x="${f(x + 1)}" y="${y}" width="${f(w - 2)}" height="${h}" rx="3" class="${kind === 'v' ? 'm-accent' : 'm-neutral'}"><title>${esc(name)}: ${c} cycles</title></rect>`;
    if (w >= 44) b += text(x + w / 2, y + 22, esc(name), kind === 'v' ? 't-cell t-cell-on' : 't-cell', 'middle');
    else b += text(x + w / 2, y + h + 16, esc(name), 't t-idx', 'middle');
    x += w;
  }
  for (let t = 0; t <= 40; t += 10) {
    b += `<line x1="${f(x0 + t * k)}" x2="${f(x0 + t * k)}" y1="${y + h + 26}" y2="${y + h + 32}" class="ln-thin"/>`;
    b += text(x0 + t * k, y + h + 46, t === 40 ? '40 cycles' : t, 't t-num', 'middle');
  }
  b += `<line x1="${x0}" x2="${x0 + 680}" y1="${y + h + 26}" y2="${y + h + 26}" class="grid"/>`;
  return svg(W, H, 'One conversion is a dependency chain of about 41 cycles: 17 in the scalar head, 24 in fourteen vector operations.', b);
}

// Fig: what each resource needs per conversion, against what it took.
export function figFloors() {
  const rows = [
    ['vector multiplies · FPU0', 5, 'm-neutral', '5'],
    ['shifts, GPR→XMM · FPU2', 6, 'm-neutral', '≈ 6'],
    ['scalar multiplier', 5, 'm-neutral', '≈ 5'],
    ['loads · 7 per conversion', 3.5, 'm-neutral', '3.5'],
    ['stores · 2 per conversion', 2, 'm-neutral', '2'],
    ['dispatch · 48 µops at 6 a cycle', 8, 'm-neutral', '8'],
    ['FP scheduler · 14 µops × 41 ÷ 36', 16, 'm-warm', '≈ 16'],
  ];
  const W = 760, x0 = 300, k = 400 / 18, y0 = 30, pitch = 30, axisY = y0 + rows.length * pitch + 4, H = axisY + 46;
  let b = '';
  for (let t = 0; t <= 15; t += 5) {
    const x = x0 + t * k;
    b += `<line x1="${f(x)}" x2="${f(x)}" y1="${y0 - 6}" y2="${axisY}" class="grid"/>`;
    b += text(x, axisY + 16, t, 't t-num', 'middle');
  }
  b += text(x0, axisY + 36, 'core cycles per conversion', 't t-small');
  rows.forEach(([name, v, cls, lab], i) => {
    const y = y0 + i * pitch;
    b += text(x0 - 12, y + 13, esc(name), cls === 'm-warm' ? 't t-strong' : 't', 'end');
    b += hbar(x0, y, v * k, 18, cls, `${name}: ${lab} cycles`);
    b += text(x0 + v * k + 8, y + 13, esc(lab), 't t-num t-strong');
  });
  const mx = x0 + 15 * k;
  b += `<line x1="${f(mx)}" x2="${f(mx)}" y1="${y0 - 10}" y2="${axisY}" class="ln-hot-thin"/>`;
  b += text(mx - 6, y0 - 14, 'measured ≈ 15 (11 TSC)', 't t-hot', 'end');
  return svg(W, H, 'After iteration 6 no execution unit needs more than 8 core cycles per conversion, but the FP scheduler occupancy works out to about 16, close to the 15 measured.', b);
}

// Fig: program order before and after pre-RA scheduling (iterations 6 to 9).
export function figSched() {
  const W = 760, x0 = 60, sw = 56, vw = 104, h = 36, H = 262;
  const block = (x, kind, l) => `<rect x="${f(x + 1)}" y="Y" width="${(kind === 'S' ? sw : vw) - 2}" height="${h}" rx="4" class="${kind === 'S' ? 'm-neutral' : 'm-accent'}"/>` +
    text(x + (kind === 'S' ? sw : vw) / 2, 0, `${l} ${kind === 'S' ? 'head' : 'vector tail'}`, kind === 'S' ? 't-blk' : 't-blk t-cell-on', 'middle').replace('y="0"', 'y="TY"');
  const strip = (y, seq) => {
    let x = x0, s = '';
    for (const [k, l] of seq) { s += block(x, k, l).replace('y="Y"', `y="${y}"`).replace('y="TY"', `y="${y + 23}"`); x += k === 'S' ? sw : vw; }
    return s;
  };
  let b = '';
  b += text(x0, 30, 'Before · iterations 6 to 8: one conversion after the other', 't t-strong');
  b += strip(40, [['S', 'A'], ['V', 'A'], ['S', 'B'], ['V', 'B'], ['S', 'C'], ['V', 'C'], ['S', 'D'], ['V', 'D']]);
  for (let i = 1; i < 4; i++) { const x = x0 + i * (sw + vw); b += `<line x1="${x}" x2="${x}" y1="34" y2="${40 + h + 6}" class="ln-warm"/>`; }
  b += text(x0, 100, 'a store through char* or __m128i ends each conversion: the next load may not move above it', 't t-small');
  b += text(x0, 116, 'FP scheduler full in 55 % of cycles · batch model 13.05 cycles per conversion', 't t-small');
  b += text(x0, 156, 'After · iteration 9: each head placed among the tails before it', 't t-strong');
  b += strip(166, [['S', 'A'], ['S', 'B'], ['V', 'A'], ['S', 'C'], ['V', 'B'], ['S', 'D'], ['V', 'C'], ['V', 'D']]);
  b += text(x0, 226, 'typed stores, scheduled before register allocation, no spills', 't t-small');
  b += text(x0, 242, 'FP scheduler full in 47 % of cycles · batch model 11.18 cycles per conversion', 't t-small');
  return svg(W, H, 'Program order of four conversions before and after pre-register-allocation scheduling: afterwards each scalar head runs among the previous vector tails.', b);
}

// Fig: independent conversions overlap, so a 40-cycle chain finishes one every ~14 cycles.
export function figOverlap() {
  const W = 760, x0 = 96, k = 640 / 112, lat = 40, step = 14, n = 6, y0 = 34, pitch = 26, h = 16;
  const axisY = y0 + n * pitch + 6, H = axisY + 44;
  let b = '';
  for (let t = 0; t <= 110; t += 10) {
    const x = x0 + t * k;
    b += `<line x1="${f(x)}" x2="${f(x)}" y1="${y0 - 8}" y2="${axisY}" class="grid"/>`;
    if (t % 20 === 0) b += text(x, axisY + 16, t, 't t-num', 'middle');
  }
  b += text(x0, axisY + 36, 'core cycles', 't t-small');
  for (let i = 0; i < n; i++) {
    const y = y0 + i * pitch, s0 = i * step;
    b += text(x0 - 10, y + 12, `call ${i + 1}`, 't', 'end');
    b += `<rect x="${f(x0 + s0 * k)}" y="${y}" width="${f(lat * k - 2)}" height="${h}" rx="4" class="m-accent"><title>call ${i + 1}: cycles ${s0} to ${s0 + lat}</title></rect>`;
  }
  const t = 50, mx = x0 + t * k;
  b += `<line x1="${f(mx)}" x2="${f(mx)}" y1="${y0 - 14}" y2="${axisY}" class="ln-warm-thin"/>`;
  b += text(mx + 6, y0 - 16, 'at cycle 50, calls 2, 3 and 4 are all in flight', 't t-strong');
  b += text(W - 8, axisY + 36, 'one call finishes every ≈ 14 cycles', 't t-small', 'end');
  return svg(W, H, 'Six independent calls, each 40 cycles long, started 14 cycles apart: three or four are in flight at any moment, so one finishes every 14 cycles.', b);
}

export const figures = {
  lengths: figLengths, langs: figLangs, flow: figFlow, stores: figStores, swar: figSwar, lanes: figLanes,
  journey: figJourney, overlap: figOverlap, chain: figChain, floors: figFloors, sched: figSched,
};

// The final code for the Godbolt-style view. What versions 6 to 9 changed is described, not shown, so as not to
// spoil the challenge.
const GB_SRC = [
  [null, 'uint64_t decimal_length(uint64_t v) {'],
  ['a', '    const auto zeros = std::countl_zero(v);'],
  ['b', '    return kLengthByLeadingZeros.base[zeros]'],
  ['b', '         + (v >= kLengthByLeadingZeros.threshold[zeros]);'],
  [null, '}'],
  [null, ''],
  [null, 'size_t u64_to_chars(uint64_t value, char* buf) {'],
  ['b', '    const uint64_t length = decimal_length(value);'],
  ['c', '    // top = value / 10^16                  (version 6: not shown)'],
  ['d', '    // value / 10^8, beside it              (version 6: not shown)'],
  ['e', '    // high4 = 4 × the 8 digits below top   (version 7: not shown)'],
  ['f', '    // low4 = 4 × the last 8 digits         (version 7: not shown)'],
  ['g', '    // top_length, from a table             (version 6: not shown)'],
  ['h', '    // zeros to drop, from a table          (version 6: not shown)'],
  ['i', '    // store the top characters at buf      (version 8: not shown)'],
  ['j', '    const __m128i drop = _mm_loadu_si128(kDropLeading + zeros);'],
  ['j', '    // store _mm_shuffle_epi8(digits16(high4, low4), drop)'],
  ['j', '    //     at buf + top_length              (version 8: not shown)'],
  [null, '    return length;'],
  [null, '}'],
  [null, ''],
  [null, '__m128i digits16(uint64_t high4, uint64_t low4) {'],
  ['k', '    const __m256i x = _mm256_inserti128_si256('],
  ['k', '        _mm256_castsi128_si256(_mm_cvtsi64_si128(high4)),'],
  ['k', '        _mm_cvtsi64_si128(low4), 1);'],
  ['l', '    // q = the first four digits of each half'],
  ['l', '    //                                      (version 7: not shown)'],
  ['m', '    const __m256i rq = _mm256_add_epi64(x,'],
  ['m', '        _mm256_mul_epu32(q, kSplit));'],
  ['n', '    const __m256i v = _mm256_shuffle_epi8(rq, kSpread);'],
  ['o', '    const __m256i quotients = _mm256_mulhi_epu16('],
  ['o', '        _mm256_mulhi_epu16(v, kRecip), kShift);'],
  ['p', '    const __m256i tens = _mm256_mullo_epi16('],
  ['p', '        _mm256_slli_epi64(quotients, 16), kTimesTen);'],
  ['q', '    const __m256i digits = _mm256_sub_epi16('],
  ['q', '        _mm256_add_epi16(quotients, kAsciiZero), tens);'],
  ['r', '    return _mm_packus_epi16(_mm256_castsi256_si128(digits),'],
  ['r', '                            _mm256_extracti128_si256(digits, 1));'],
  [null, '}'],
];
const GB_ASM = [
  ['a', 'lzcnt', 'rdx, rcx', 'count the leading zero bits'],
  ['b', 'cmp', 'rcx, [threshold + rdx*8]', 'past the next power of ten?'],
  ['b', 'mov', 'r8, [base + rdx*8]', 'shortest length for this bit width'],
  ['b', 'sbb', 'r8, -1', 'length = base + 1 − carry'],
  ['c', 'mul', 'rdi', 'value × ⌈2¹¹⁵ / 10¹⁶⌉, 128-bit result'],
  ['d', 'mul', 'rsi', 'value × ⌈2⁹⁰ / 10⁸⌉, beside the first'],
  ['h', 'movzx', 'edi, byte [zeros + r8]', 'leading zeros to drop'],
  ['c', 'shr', 'rax, 51', 'top = value / 10¹⁶'],
  ['d', 'shr', 'rdx, 26', 'value / 10⁸'],
  ['e', 'imul', 'rbx, rax, -400000000', 'top × −4·10⁸'],
  ['i', 'mov', 'r11d, [top_chars + rax*4]', 'the top digits as four text bytes'],
  ['f', 'imul', 'rax, rdx, -400000000', '(value / 10⁸) × −4·10⁸'],
  ['e', 'lea', 'rdx, [rbx + rdx*4]', '4·high'],
  ['f', 'lea', 'rax, [rax + rcx*4]', '4·low'],
  ['k', 'vmovq', 'xmm1, rdx', '4·high into a vector register'],
  ['g', 'movzx', 'edx, byte [top_len + r8]', 'top_length'],
  ['i', 'mov', '[rsi], r11d', 'store 1: four bytes at buf'],
  ['k', 'vmovq', 'xmm3, rax', '4·low into a vector register'],
  ['k', 'vinserti128', 'ymm1, ymm1, xmm3, 1', 'high in the low half, low in the high'],
  ['l', 'vpmuludq', 'ymm0, ymm1, [div40000]', '× ⌈2⁴⁷ / 40000⌉ in each 64-bit lane'],
  ['l', 'vpsrlq', 'ymm0, ymm0, 47', 'q: the first 4 digits of each half'],
  ['m', 'vpmuludq', 'ymm0, ymm0, [split]', 'q × (2¹⁸ − 40000)'],
  ['m', 'vpaddq', 'ymm0, ymm1, ymm0', '4r in bits 0–15, 4q in bits 16–31'],
  ['n', 'vpshufb', 'ymm0, ymm0, [spread]', '4q into lanes 0–3, 4r into 4–7'],
  ['o', 'vpmulhuw', 'ymm0, ymm0, [recip]', 'high half of × 8389, 5243, 13108, 32768'],
  ['o', 'vpmulhuw', 'ymm0, ymm0, [shift]', 'lanes now ÷1000, ÷100, ÷10, ÷1'],
  ['p', 'vpsllq', 'ymm1, ymm0, 16', 'every lane gets the lane before it'],
  ['p', 'vpmullw', 'ymm1, ymm1, [times_ten]', 'ten times the lane before'],
  ['q', 'vpaddw', 'ymm0, ymm0, [ascii_zero]', "add '0' to every lane"],
  ['q', 'vpsubw', 'ymm0, ymm0, ymm1', "digit = lane − 10 · before + '0'"],
  ['r', 'vextracti128', 'xmm1, ymm0, 1', "the upper half: low's digits"],
  ['r', 'vpackuswb', 'xmm0, xmm0, xmm1', '16 words to 16 ASCII bytes'],
  ['j', 'vpshufb', 'xmm0, xmm0, [drop + rdi]', 'drop the leading zeros'],
  ['j', 'vmovdqu', '[rsi + rdx], xmm0', 'store 2: 16 bytes at buf + top_length'],
];
export function godbolt() {
  return godboltView(GB_SRC, GB_ASM, 'x86-64, GCC 14.2 -O2 -march=znver2');
}

export const godboltRows = Math.max(GB_SRC.length, GB_ASM.length);
