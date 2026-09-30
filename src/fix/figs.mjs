// Figure generator for the FIX encoder post (challenge 10): every SVG is computed from its data here.
import { esc, text, svg, arrow, polyArrow, box, godboltView } from '../lib.mjs';

// The first message the final encoder writes for the benchmark, SOH as '|'.
const MSG = '8=FIX.4.4|9=265|35=D|49=ALGO-ENG1|56=NASDAQ-GW|34=00000001|52=20260320-17:50:00.000|11=01000000|' +
  '54=1|38=00017453|44=00008515.59400038|1=HEDGE-MAIN|21=1|55=AAPL|40=2|59=0|15=USD|207=XNAS|100=XNAS|47=A|' +
  '167=CS|22=8|48=100123|58=Algo order from strategy MOMENTUM-v3.2 session 20260320|10=244|';

// How often each byte of MSG is written: 'msg' every message, 'sec' once a second, 'day' once a day, else once.
function kinds() {
  const k = new Array(MSG.length).fill('');
  const mark = (tag, from, n, kind) => { const at = MSG.indexOf(`|${tag}=`) + tag.length + 2 + from; for (let i = 0; i < n; i++) k[at + i] = kind; };
  mark('34', 0, 8, 'msg');
  mark('52', 0, 8, 'day');
  for (const i of [9, 10, 12, 13, 15, 16]) mark('52', i, 1, 'sec');
  mark('52', 18, 3, 'msg');
  mark('11', 0, 8, 'msg');
  mark('54', 0, 1, 'msg');
  mark('38', 0, 8, 'msg');
  mark('44', 0, 8, 'msg');
  mark('44', 9, 8, 'msg');
  mark('10', 0, 3, 'msg');
  return k;
}

// Fig: the message, byte by byte, colored by how often encode() writes it.
export function figLayout() {
  const cols = 42, cw = 17, ch = 24, x0 = 23, y0 = 44, k = kinds();
  const rows = Math.ceil(MSG.length / cols), H = y0 + rows * (ch + 4) + 16;
  const cls = { '': 'cell', day: 'cell cell-day', sec: 'cell cell-sec', msg: 'cell cell-msg' };
  let b = '';
  const count = (kind) => k.filter((x) => x === kind).length;
  const legend = [['', `written once, in build() · ${count('')} bytes`], ['day', `once a day · ${count('day')}`],
    ['sec', `once a second · ${count('sec')}`], ['msg', `every message · ${count('msg')}`]];
  let lx = x0;
  for (const [kind, label] of legend) {
    b += `<rect x="${lx}" y="10" width="14" height="14" rx="3" class="${cls[kind]}"/>` + text(lx + 20, 21, esc(label));
    lx += 20 + label.length * 6.1 + 22;
  }
  [...MSG].forEach((c, i) => {
    const x = x0 + (i % cols) * cw, y = y0 + Math.floor(i / cols) * (ch + 4);
    b += `<rect x="${x + 0.5}" y="${y}" width="${cw - 1}" height="${ch}" rx="2" class="${cls[k[i]]}"/>`;
    b += text(x + cw / 2, y + 16, esc(c), k[i] === 'msg' ? 't-ch t-ch-msg' : c === '|' ? 't-ch t-cell-dim' : 't-ch', 'middle');
  });
  return svg(760, H, `The 294-byte message: ${count('msg')} bytes change with every message, the rest is written once, once a day or once a second.`, b);
}

// Fig: the checksum from sums, for the message above.
export function figChecksum() {
  const k = kinds(), end = MSG.indexOf('|10=') + 1;
  const byte = (c) => (c === '|' ? 1 : c.charCodeAt(0));
  let fixed = 0, digits = 0;
  for (let i = 0; i < end; i++) {
    if (k[i] === 'msg') { fixed += 48; digits += byte(MSG[i]) - 48; } else fixed += byte(MSG[i]);
  }
  const total = fixed + digits;
  const W = 760, H = 212, bh = 58;
  let b = '';
  b += box(16, 20, 230, bh, `static sum ${fixed}`, "variable digits as '0'");
  b += box(16, 118, 230, bh, `digit values ${digits}`, 'added per message');
  b += box(290, 69, 160, bh, `${fixed} + ${digits} = ${total}`, 'one add', 'box box-hot');
  b += box(480, 69, 120, bh, `${total} & 255 = ${total & 255}`, 'the low byte', 'box box-hot');
  b += box(630, 69, 114, bh, `"${String(total & 255).padStart(3, '0')}|"`, '256-entry table', 'box box-hot');
  b += polyArrow([[246, 49], [268, 49], [268, 90], [290, 90]]);
  b += polyArrow([[246, 147], [268, 147], [268, 106], [290, 106]]);
  b += arrow(450, 98, 480, 98, 'ln-hot');
  b += arrow(600, 98, 630, 98, 'ln-hot');
  b += text(16, 200, 'The static sum changes only with the day and the second, so build() and the once-a-second code keep it up to date.', 't t-small');
  return svg(W, H, `Checksum of the example message: static sum ${fixed} plus digit values ${digits} is ${total}, whose low byte ${total & 255} is looked up as text.`, b);
}

export const figures = { layout: figLayout, checksum: figChecksum };

// The final fast path for the Godbolt-style view (casts and the non-AVX2 path left out). What versions 6 and 7
// changed is described, not shown, so as not to spoil the challenge.
const GB_SRC = [
  [null, 'std::string_view encode(const OrderFields& o) {'],
  ['a', '    const uint64_t millisecond ='],
  ['a', "        o.timestamp / 1'000'000 - state().ms_start;"],
  ['b', '    if (o.timestamp < 0) [[unlikely]] return encode_other(o);'],
  ['c', '    if (millisecond >= 1000) [[unlikely]] return encode_other(o);'],
  ['d', '    if (o.seq_num >= kE8) [[unlikely]] return encode_other(o);'],
  ['e', '    if (o.cl_ord_id >= kE8) [[unlikely]] return encode_other(o);'],
  ['f', '    if (o.quantity >= kE8) [[unlikely]] return encode_other(o);'],
  ['g', '    if (o.price >= kE8 * kE8) [[unlikely]] return encode_other(o);'],
  ['h', '    if (o.side >= 10) [[unlikely]] return encode_other(o);'],
  [null, ''],
  ['i', '    char* const v = msg + seq_offset;  // the variable block'],
  ['j', '    // millis = the table entry for millisecond (version 6: not shown)'],
  ['k', '    const uint64_t whole = o.price / kE8;'],
  ['l', '    const uint64_t frac = o.price - whole * kE8;'],
  ['m', '    uint32_t sum = state().sum + o.side + (millis >> 32);'],
  ['n', '    const __m256i d1 = digits8x4('],
  ['n', '        {o.seq_num, o.cl_ord_id, o.quantity, whole});'],
  ['o', '    const __m256i d2 = digits8x2({frac, 0, 0, 0});'],
  ['p', '    const __m256i sums = _mm256_sad_epu8('],
  ['p', '        _mm256_add_epi8(d1, d2), _mm256_setzero_si256());'],
  ['q', '    __m128i s2 = _mm_add_epi64(_mm256_castsi256_si128(sums),'],
  ['q', '                               _mm256_extracti128_si256(sums, 1));'],
  ['q', '    s2 = _mm_add_epi64(s2, _mm_unpackhi_epi64(s2, s2));'],
  ['q', '    sum += _mm_cvtsi128_si32(s2);'],
  ['r', "    // zeros = 32 × '0'                    (version 6: not shown)"],
  ['s', '    const __m256i c1 = _mm256_or_si256(d1, zeros);'],
  ['s', '    const __m128i seq_clid = _mm256_castsi256_si128(c1);'],
  ['s', '    const __m128i qty_whole = _mm256_extracti128_si256(c1, 1);'],
  ['s', '    _mm_storel_epi64(v, seq_clid);          // 34='],
  ['s', '    store_high(v + 37, seq_clid);           // 11='],
  ['s', '    _mm_storel_epi64(v + 54, qty_whole);    // 38='],
  ['s', '    store_high(v + 66, qty_whole);          // 44= whole'],
  ['t', '    _mm_storel_epi64(v + 75, _mm256_or_si256(d2, zeros));'],
  ['u', '    std::memcpy(v + 30, &millis, 4);        // 52= millis'],
  ['w', "    v[49] = '0' + o.side;                   // 54="],
  ['x', '    // checksum = the text for uint8_t(sum) (version 6: not shown)'],
  ['y', '    std::memcpy(msg + checksum_offset, &checksum, 4);'],
  ['z', '    return {msg, length};'],
  [null, '}'],
];
const GB_ASM = [
  ['a', 'mov', 'rcx, [r13]', 'load the timestamp'],
  ['a', 'mov', 'rdi, [rsp+208]', "the message's address, from the builder"],
  ['a', 'movabs', 'rax, 4835703278458516699', '⌈2⁸² / 10⁶⌉'],
  ['a', 'mul', 'rcx', 'timestamp × that, 128-bit result'],
  ['a', 'shr', 'rdx, 18', 'milliseconds since 1970'],
  ['a', 'sub', 'rdx, [rdi-40]', "minus the written second's first"],
  ['b', 'test', 'rcx, rcx', 'timestamp negative?'],
  ['b', 'js', '.cold', 'never taken'],
  ['c', 'cmp', 'rdx, 999', 'still the second the message says?'],
  ['c', 'ja', '.cold', 'taken once a second'],
  ['d', 'mov', 'rsi, [r13+8]', 'load the sequence number'],
  ['d', 'cmp', 'rsi, 99999999', 'fits eight digits?'],
  ['d', 'ja', '.cold', 'never taken'],
  ['e', 'mov', 'r11, [r13+16]', 'load the ClOrdID'],
  ['e', 'cmp', 'r11, 99999999', 'fits eight digits?'],
  ['e', 'ja', '.cold', 'never taken'],
  ['f', 'mov', 'r10, [r13+32]', 'load the quantity'],
  ['f', 'cmp', 'r10, 99999999', 'fits eight digits? (negative is huge)'],
  ['f', 'ja', '.cold', 'never taken'],
  ['g', 'mov', 'rcx, [r13+24]', 'load the price'],
  ['g', 'movabs', 'rax, 9999999999999999', '10¹⁶ − 1'],
  ['g', 'cmp', 'rax, rcx', 'eight digits before the point?'],
  ['g', 'jb', '.cold', 'never taken'],
  ['h', 'movzx', 'r9d, byte [r13+40]', 'load the side'],
  ['h', 'cmp', 'r9b, 9', 'one digit?'],
  ['h', 'ja', '.cold', 'never taken'],
  ['k', 'movabs', 'rax, -6067343680855748867', '⌈2⁹⁰ / 10⁸⌉'],
  ['j', 'mov', 'r14, [rdi+rdx*8-9088]', "the millisecond's digits and their sum"],
  ['n', 'vmovq', 'xmm7, r10', 'quantity into a vector register'],
  ['i', 'mov', 'r8d, [rsp+220]', 'where 34= starts, from the builder'],
  ['k', 'mul', 'rcx', 'price × ⌈2⁹⁰ / 10⁸⌉'],
  ['k', 'shr', 'rdx, 26', 'whole = price / 10⁸'],
  ['i', 'add', 'r8, rdi', 'v, the start of the variable block'],
  ['n', 'vpinsrq', 'xmm4, xmm7, rdx, 1', 'whole beside the quantity'],
  ['n', 'vmovq', 'xmm7, rsi', 'sequence number into a vector'],
  ['n', 'vpinsrq', 'xmm0, xmm7, r11, 1', 'ClOrdID beside it'],
  ['n', 'vinserti128', 'ymm0, ymm0, xmm4, 1', 'four numbers, one per 64-bit lane'],
  ['n', 'vpmuludq', 'ymm4, ymm0, [div10000]', '× ⌈2⁴⁵ / 10⁴⌉ in each lane'],
  ['l', 'imul', 'rdx, rdx, 100000000', 'whole × 10⁸'],
  ['l', 'sub', 'rcx, rdx', 'frac, the eight decimals'],
  ['m', 'mov', 'rdx, r14', ''],
  ['m', 'shr', 'rdx, 32', "the millisecond digits' sum"],
  ['n', 'vpsrlq', 'ymm4, ymm4, 45', 'q = x / 10⁴'],
  ['n', 'vpmuludq', 'ymm4, ymm4, [split]', 'q × (2³² − 10⁴)'],
  ['n', 'vpaddq', 'ymm0, ymm0, ymm4', 'remainder low, q in the 32 bits above'],
  ['n', 'vpsllw', 'ymm0, ymm0, 2', 'times four, to keep the next step exact'],
  ['n', 'vpshufb', 'ymm5, ymm0, [even]', 'lanes 0 and 2: each group in four lanes'],
  ['n', 'vpshufb', 'ymm0, ymm0, [odd]', 'lanes 1 and 3 the same'],
  ['n', 'vpmulhuw', 'ymm0, ymm0, ymm1', 'high half of × 8389, 5243, 13108, 32768'],
  ['n', 'vpmulhuw', 'ymm5, ymm5, ymm1', ''],
  ['n', 'vpmulhuw', 'ymm0, ymm0, ymm2', 'now ÷1000, ÷100, ÷10, ÷1'],
  ['n', 'vpmulhuw', 'ymm5, ymm5, ymm2', ''],
  ['n', 'vpsllq', 'ymm4, ymm0, 16', 'every lane gets the lane before it'],
  ['n', 'vpmullw', 'ymm4, ymm4, ymm3', 'ten times the lane before'],
  ['n', 'vpsllq', 'ymm6, ymm5, 16', ''],
  ['n', 'vpmullw', 'ymm6, ymm6, ymm3', ''],
  ['n', 'vpsubw', 'ymm0, ymm0, ymm4', 'digit = lane − 10 × the one before'],
  ['n', 'vpsubw', 'ymm5, ymm5, ymm6', ''],
  ['p', 'vpxor', 'xmm6, xmm6, xmm6', 'zero, for the byte sum'],
  ['n', 'vpackuswb', 'ymm5, ymm5, ymm0', '32 digits, one per byte'],
  ['o', 'vmovq', 'xmm0, rcx', 'frac into a vector register'],
  ['o', 'vpmuludq', 'ymm4, ymm0, [div10000]', 'the same kernel, for one number'],
  ['o', 'vpsrlq', 'ymm4, ymm4, 45', ''],
  ['o', 'vpmuludq', 'ymm4, ymm4, [split]', ''],
  ['o', 'vpaddq', 'ymm0, ymm0, ymm4', ''],
  ['o', 'vpsllw', 'ymm0, ymm0, 2', ''],
  ['o', 'vpshufb', 'ymm0, ymm0, [even]', ''],
  ['o', 'vpmulhuw', 'ymm0, ymm0, ymm1', ''],
  ['o', 'vpmulhuw', 'ymm0, ymm0, ymm2', ''],
  ['o', 'vpsllq', 'ymm4, ymm0, 16', ''],
  ['o', 'vpmullw', 'ymm4, ymm4, ymm3', ''],
  ['o', 'vpsubw', 'ymm0, ymm0, ymm4', ''],
  ['o', 'vpxor', 'xmm4, xmm4, xmm4', ''],
  ['o', 'vpackuswb', 'ymm0, ymm0, ymm4', 'eight digits, one per byte'],
  ['p', 'vpaddb', 'ymm4, ymm5, ymm0', 'add both registers byte by byte'],
  ['p', 'vpsadbw', 'ymm4, ymm4, ymm6', 'sum of every eight bytes'],
  ['q', 'vextracti128', 'xmm6, ymm4, 1', 'the upper half'],
  ['q', 'vpaddq', 'xmm6, xmm6, xmm4', 'added to the lower'],
  ['q', 'vpunpckhqdq', 'xmm4, xmm6, xmm6', 'the upper 64 bits'],
  ['q', 'vpaddq', 'xmm4, xmm4, xmm6', 'added too: one sum of all digits'],
  ['q', 'vmovd', 'eax, xmm4', 'into a general register'],
  ['r', 'vmovdqa', 'ymm4, [rdi-32]', "32 × '0', from the state's line"],
  ['m', 'add', 'eax, edx', "+ the millisecond digits' sum"],
  ['m', 'movsx', 'edx, r9b', 'the side'],
  ['m', 'add', 'edx, [rdi-56]', '+ the static sum'],
  ['w', 'add', 'r9d, 48', "side + '0'"],
  ['u', 'mov', '[r8+30], r14d', 'store the millisecond digits and the SOH'],
  ['w', 'mov', '[r8+49], r9b', 'store the side'],
  ['q', 'add', 'eax, edx', 'the whole sum'],
  ['x', 'movzx', 'eax, al', 'its low byte: the sum mod 256'],
  ['s', 'vpor', 'ymm5, ymm4, ymm5', 'digits to ASCII'],
  ['t', 'vpor', 'ymm4, ymm4, ymm0', 'the fraction to ASCII'],
  ['s', 'vmovdqa', 'xmm6, xmm5', 'a register copy'],
  ['s', 'vextracti128', 'xmm5, ymm5, 1', 'quantity and whole'],
  ['t', 'vmovq', '[r8+75], xmm4', 'store the fraction'],
  ['s', 'vmovq', '[r8], xmm6', 'store the sequence number'],
  ['s', 'vmovhps', '[r8+37], xmm6', 'store the ClOrdID'],
  ['s', 'vmovq', '[r8+54], xmm5', 'store the quantity'],
  ['s', 'vmovhps', '[r8+66], xmm5', "store the price's whole part"],
  ['x', 'mov', 'edx, [rdi+rax*4-1088]', '"ddd|" from the checksum table'],
  ['y', 'mov', 'eax, [rsp+252]', 'where 10= goes, from the builder'],
  ['y', 'mov', '[rdi+rax], edx', 'store the checksum'],
  ['z', 'mov', 'eax, [rsp+216]', 'the length, from the builder'],
  ['z', 'mov', 'rdx, rdi', 'and the address'],
];
export const godboltRows = Math.max(GB_SRC.length, GB_ASM.length);
export function godbolt() {
  return godboltView(GB_SRC, GB_ASM, 'x86-64, GCC 14.2 -O2 -march=znver2');
}
