---
layout: post
permalink: /fix-encoder/
title: A FIX order in ten nanoseconds
description: How to write a 294-byte FIX NewOrderSingle in 31 cpu cycles.
author: Arjan Seesing
date: 2026-09-30
image: /img/fix/cover.png
---

## Where this comes from

At my previous employers I wrote a protocol code generator in Java. It generated the FIX parsers, the encoders and the
message classes for us. The focus there was always clean code, and performance was a secondary concern.
It just needed to be faster and easier to work with than [QuickFIX/J](https://quickfixj.org/). Which was not hard.
As I had a deep hatred for QuickFIX. It was slow, it loves checked exceptions, and it required a lot of boilerplate.
It would also crash and burn when something unexpected happened.

This article is about the other end: extreme performance. It's a challenge from
[HFT University](https://hftuniversity.com/): encode a FIX order as fast as you can. I'm also building my own exchange with 
A FIX gateway (topic for another time), and some of the requirements of the challenge are different from what I do there. 
Where they differ, I've put a note on the side.

> // Clean code is code everyone can read. Fast code only AI can read.

## What an encoder does

FIX sends every field as `tag=value` in plain text, with the byte 1 (SOH) between the fields. An order is a
NewOrderSingle, message type `35=D`. This is one, exactly as the final version writes it, with SOH shown as `|`:

```text
8=FIX.4.4|9=271|35=D|49=ALGO-ENG1|56=NASDAQ-GW|34=00000001|
52=20260320-17:50:00.000000000|11=01000000|54=1|38=00017453|
44=00008515.59400038|1=HEDGE-MAIN|21=1|55=AAPL|40=2|59=0|15=USD|207=XNAS|
100=XNAS|47=A|167=CS|22=8|48=100123|
58=Algo order from strategy MOMENTUM-v3.2 session 20260320|10=017|
```

Most of it is numbers turned into text: the sequence number (34), the time it was sent (52), our order ID (11), the
side (54, 1 is buy), the quantity (38) and the price (44). That's the part my [previous article](/ten-cycles/) was
about. Two fields make FIX more annoying than just printing numbers:

- **9, BodyLength**, is the number of bytes from after the 9 field up to the checksum. It comes near the front, but
  depends on everything after it. You don't know it until you've written the rest.
- **10, CheckSum**, is the sum of every byte before it, modulo 256, as three digits. It depends on every byte of the
  message.

So the simple way writes the message, measures it, puts the header in front, and then reads the whole thing again to
add up the bytes for the checksum.

> // FIX is ancient. It was designed at a time when checksums were needed, but they weren't allowed to be smart.

## The requirements

The challenge gives you a template once, in `build()`, which isn't timed. It's a list of 17 tag and value pairs: the
FIX version, the message type, who sends it to whom, the account, the symbol, the currency and so on. After that,
`encode()` is called for every order with the six fields that change:

```cpp
struct OrderFields {
    int64_t  timestamp;    // tag 52: nanoseconds since 1970
    uint64_t seq_num;      // tag 34
    uint64_t cl_ord_id;    // tag 11
    int64_t  price;        // tag 44: the price times 10^8
    int64_t  quantity;     // tag 38
    int8_t   side;         // tag 54: 1 = buy, 2 = sell
};

std::string_view encode(const OrderFields& order);  // valid until the next call
```

**My gateway.** The application calls a function specific to each message, a templated call, so the compiler knows the
message type and its fields when it compiles. The challenge fills one struct with the data instead, and the rest of
the message only arrives at run time, as the template.
{: .side}

The benchmark encodes 100,000 orders in a row. The timestamps are 1 millisecond apart, the sequence number counts up
from 1, the order ID from 1,000,000. The price is anything from $1 to $10,000 with eight random decimals, the quantity
1 to 50,000, and the side 1 or 2. It checks that every message starts with `8=FIX.4.4`, that the body length is right
and that the checksum is right.

The score is the number of cycles per message on their machine, an AMD Ryzen 9 3900 (Zen 2) with GCC 14.2. Gold is
below 400 cycles.

## The naive way

The challenge comes with a slow version that works. For every order it builds the whole message from scratch:
`std::to_string` for every tag, `gmtime_r` and `snprintf` for the timestamp, `snprintf` for the price, a loop over the
bytes for the checksum, and a copy to put `8=` and `9=` in front.

```cpp
for (const auto& [tag, value] : template_fields_) {
    body += std::to_string(tag);
    body += '=';
    body += value;
    body += SOH;
}
body += "34="; body += std::to_string(order.seq_num); body += SOH;
body += "52="; body += format_timestamp(order.timestamp); body += SOH;
...
```

That's 12,289 instructions per message, with 84 branches the CPU guesses wrong. Each wrong guess costs about 20 cycles.
It does add a hint at the top: "pre-serialize everything in build(), then only patch the variable fields". Fair
enough.

## The strategy

**Every field gets a fixed width.** FIX allows leading zeros in numbers: `34=00000001` means the same as `34=1`. So
the sequence number is always eight digits, and so are the order ID and the quantity. The price is always eight digits,
a point, and eight decimals. Now every byte of the message is always in the same place. The body length is always 271,
and `build()` can write the whole message once. `encode()` only fills in the holes.

**My gateway.** Leading zeros are valid FIX, but valid and "accepted by the venue's certification test" are two different things. I
would check with the venue before sending `34=00000001` to a real exchange.
{: .side}

**What changes rarely is written rarely.** The date is written once a day, the time (HH:MM:SS) once a second. The
benchmark's timestamps are whole milliseconds, so the last six digits of the nanoseconds are always zero and are never
written at all. For each message, only 47 of the 294 bytes change.

![The message, byte by byte](/img/fix/fig-layout.png)

*The message, byte by byte. The blue bytes are written for every order, the rest is already there.*

**The digits come from vector registers.** The digit conversion is the AVX2 one from the previous article, widened to
four numbers per register. One register converts the sequence number, the order ID, the quantity and the price's whole
part at once. A second one does the price's decimals. The three millisecond digits come from a table of 1000 entries.

**The checksum doesn't read the message.** A checksum is a sum, and a sum can be split up. The static bytes add up to
the same number every time, so `build()` works that out once, counting every variable digit as `'0'`. Per message,
only the values of the digits have to be added. They're already in the vector registers, and one instruction
(`vpsadbw`) adds up eight bytes at once. The low byte of the total is the checksum, and a table of 256 four-byte
entries gives the text, `"017|"`, in one load.

![The checksum from two sums](/img/fix/fig-checksum.png)

*The checksum of the message above, without looking at the message.*

**One branch per field, never taken.** A value that doesn't fit its width, a negative price, a timestamp on another
day: each goes to a slow path that writes normal FIX without leading zeros. The benchmark never goes there, so the CPU
always guesses these branches right.

The limits: everything above eight digits takes the slow path, and a sequence number passes 10^8 after a hundred
million messages. The message lives in one buffer inside the encoder, and the next call overwrites it. One encoder
handles one template. And the fastest version assumes whole milliseconds, which I'll come back to.

## My final solution

104 instructions and 31 cycles per message on the certified Zen 2. Their cycle counter ticks at 3.1 GHz, so that's 10
nanoseconds for a 294-byte order, checksum included.

The memory is 9 KB of tables right in front of the message: the millisecond digits (8 KB), the checksum text (1 KB),
and 64 bytes of state for the current day and second. Everything sits at a fixed distance from the message, so one
register reaches all of it.

## The journey

My laptop is an M2 Mac. The certified machine is a Zen 2, so I needed something at home that behaves like it. 
I ran the x86 version of GCC 14.2 in a Docker container. That runs under emulation, so its timings mean nothing, 
but two tools don't need timings:

- **Cachegrind** runs the program on a CPU simulated in software, and counts every instruction, every cache miss and
  every branch that was guessed wrong. I set its caches to the sizes of the Zen 2.
- **llvm-mca** takes the assembly and plays it through LLVM's model of the Zen 2 pipeline. I explained how it works in
  the [previous article](/ten-cycles/#a-zen-2-on-my-laptop).

Before anything went to the real machine, it had to pass a test of 9 million messages: each one decoded field by field
and checked against its order. It covered edge values of every field, timestamps around midnight, and a handful of
other templates, and ran again under the address and undefined-behavior sanitizers.

A quick reminder of how the CPU spends its time, from the previous article. The CPU works on many instructions at once,
out of order. So the speed depends on the longest dependency chain (instructions that each need the previous one's
result) and on the busiest resource (an execution unit, or a waiting room that fills up). Branches it guesses; a wrong
guess costs about 20 cycles.

I kept a log of every attempt, and I've left out the ones that didn't help. The code is simplified: no casts, and only
the AVX2 path.

### Version 1 · Write it once (57 cycles in the model)

`build()` lays out the message with the fixed widths and writes every static byte. `encode()` then does only this:

```cpp
const uint64_t nanos = ts % kE9;
const uint32_t hours = s / 3600, minutes = s / 60 % 60, seconds = s % 60;
const uint32_t nanos_high = nanos / 10'000'000;          // the first two digits
const uint64_t nanos_low = nanos - nanos_high * 10'000'000;  // the other seven
const uint64_t time = hours * 1'000'000 + minutes * 10'000 + seconds * 100
                    + nanos_high;
const uint64_t whole = price / kE8, frac = price - whole * kE8;

const __m256i d1 = digits8x4({seq_num, cl_ord_id, quantity, whole});
const __m256i d2 = digits8x4({frac, 0, time, nanos_low});
const __m256i sums = _mm256_sad_epu8(_mm256_add_epi8(d1, d2), zero);
const uint32_t sum = static_sum + side + add_up(sums);

store8(m + l.seq, d1 | '0'); ...                 // the digits, into their holes
store16(m + l.time, shuffle(time) | "  :  :  .");  // HH:MM:SS. and separators
m[l.side] = '0' + side;
std::memcpy(m + l.checksum, &kChecksum[sum & 0xFF], 4);  // "017|"
return {m, l.len};
```

From 12,289 instructions to 176, and not a single wrong guess. llvm-mca said 57 cycles.

> // 98.6 % of the instructions gone, and I hadn't started optimizing yet.

### Version 2 · A shorter chain (46 cycles)

llvm-mca's bottleneck analysis showed where the cycles went: most of them were spent waiting on dependencies. Each
message was one long chain, from the timestamp's multiply, through the time digits, the vector conversion, the digit
sum and the checksum table, to the store. The CPU can only keep one or two messages in flight, so that chain set the
pace, not the number of instructions.

So I shortened the chain. The vector kernel got the shorter version from the previous article. And the nanosecond
digits stopped waiting for the second:

```diff
-const uint64_t nanos = ts % kE9;
-const uint32_t nanos_high = nanos / 10'000'000;        // waits for the line above
-const uint64_t nanos_low = nanos - nanos_high * 10'000'000;
+const uint64_t tenths7 = ts / 10'000'000;              // runs beside ts / kE9
+const uint32_t nanos_high = tenths7 - ts / kE9 * 100;
+const uint64_t nanos_low = ts - tenths7 * 10'000'000;
```

Now we have one multiply more, but two fewer in a row. According to the HFT-university benchmark it was 46 cycles.

### Version 3 · The time once a second

The date was already written once a day. Now the time went the same way: HH:MM:SS is written when the second changes,
and its digits are added to the static sum. Per message, only the nine nanosecond digits are left.

```diff
-const uint32_t hours = s / 3600, minutes = s / 60 % 60, seconds = s % 60;
-const uint64_t time = hours * 1'000'000 + minutes * 10'000 + seconds * 100
-                    + nanos_high;
-store16(m + l.time, shuffle(time) | "  :  :  .");
+if (second != state.second) [[unlikely]] set_second(second);     // once a second
```

The division into hours and minutes, four multiplies, a shuffle and a store are gone from every message.

So what happens when the second changes? The encoder keeps a small state next to the message: the second that's
written in it now, and two sums. One is the static sum for the day with HH:MM:SS counted as `"00:00:00"`, the other
the same sum with the current time's digits added. Every message checks that its timestamp is still in the second the
message says. When it isn't, it takes the slow path once:

```cpp
void FixBuilder::set_second(uint64_t second) {
    const uint64_t sod = second - state.day_start;       // seconds since midnight
    write_fixed(time, sod / 3600, 2);                    // HH
    write_fixed(time + 3, sod / 60 % 60, 2);             // MM
    write_fixed(time + 6, sod % 60, 2);                  // SS
    state.sum = state.day_sum + digit_values(time);      // the new static sum
    state.second = second;
}
```

After that the message says the new second, the static sum matches it again, and the fast path carries on as if
nothing happened. A new day works the same way, one level up: it rewrites the date and `day_sum`. It doesn't matter
which way the clock moves; a timestamp from an earlier second fails the same check and gets its own second written.

With a new second every 1000 messages, that's one branch the CPU guesses wrong, and a few dozen instructions, per
thousand messages. Spread out, it costs less than a cycle per message.

### Version 4 · Six zeros that never change

Every timestamp in the benchmark is a whole millisecond, so the last six nanosecond digits are always zeros. `build()`
writes them, and the fast path never touches them. What's left per message are the three millisecond digits, from a
table of 1000 entries: the three digits and their sum, one load and one 4-byte store.

That also took the timestamp out of the vector kernel, which made the chain shorter again. And it made the check for
the second cheaper. The state now keeps the first millisecond of the second that's written, so "is this still the
same second?" is one subtract and compare: `millisecond = ts / 1'000'000 - ms_start` has to be below 1000. That
difference is also the index into the table.

Writing zeros is only right if the timestamp really is a whole millisecond, and in the model checking that cost 2
cycles. The challenge allows optimizing for what the benchmark tests, so I dropped the check:

```diff
-if (!whole_millisecond(ts)) [[unlikely]] return encode_other(order);
 const uint64_t millis = kMillis[ts / 1'000'000 - state.ms_start];  // "ddd0" + sum
 std::memcpy(v + 30, &millis, 4);
```

The certified run accepted it. Versions 3 and 4 together took it from 46 to 33 cycles.

**My gateway.** Never. A timestamp with microseconds would silently go out with the wrong time. Here the benchmark only
makes whole milliseconds, and the rules say that's fair game. The slow path still checks.
{: .side}

> // It's not cheating if the rules allow it. I'm still not putting it in production.

### Version 5 · Help GCC a little (32 cycles)

Next I read what GCC made of the code. Two things stood out.

The range checks were written as one condition, and GCC turned the seven tests into a chain of about twenty
instructions that set and combine flags. As separate branches, never taken, each test is a compare and a jump.

And GCC loaded eleven offsets from the encoder on every message. The benchmark tells the compiler, after every
message, that any memory may have changed, so it can't keep them in registers. But the variable fields sit at fixed
distances from each other, so now there's one base address and the rest are constants in the instructions:

```diff
-const bool fits = (o.timestamp >= 0) & (millisecond < 1000) & ...;
-if (!fits) [[unlikely]] return encode_other(o);
+if (o.timestamp < 0) [[unlikely]] return encode_other(o);
+if (millisecond >= 1000) [[unlikely]] return encode_other(o);
+if (o.seq_num >= kE8) [[unlikely]] return encode_other(o);
+...
-store_high(m + l.clid, seq_clid);      // l.clid loaded every message
+store_high(v + 43, seq_clid);          // v + a constant
```

About a tenth fewer instructions, and llvm-mca said it was 17 % slower. The real machine said 3 % faster. The model is
simpler than the real Zen 2: the real one has an extra queue of 64 entries in front of the vector waiting room, and
it holds exactly the instructions the model shows stuck. From here on, only the real machine got a vote.

> // All models are wrong. This one was wrong in a very consistent direction.

### Version 6 · The tables in front of the message (31 cycles)

The last cycle took two small changes, sent in one after the other. GCC rebuilt the 32 bytes of `'0'` that turn digits
into text for every message, with three instructions. Now they sit in the free bytes of the state, in front of the
message, and it's one load.

The millisecond and checksum tables sat after the message, at a distance that depends on how long the message is. So
GCC loaded that distance and added it before each lookup. Now both tables sit in front of the message, at a fixed
distance, and each lookup is one instruction:

```diff
-const __m256i zeros = _mm256_set1_epi8('0');                // three instructions
+const __m256i zeros = _mm256_load_si256(state().zeros);     // one load
-std::memcpy(&millis, m + l.tables + 8 * millisecond, 8);    // l.tables loaded
+std::memcpy(&millis, m - 9088 + 8 * millisecond, 8);        // a constant
-checksum = kChecksum[sum & 0xFF];
+std::memcpy(&checksum, m - 1088 + 4 * uint8_t(sum), 4);
```

The first change alone didn't show; the certified score has a resolution of one cycle. Together they did: 31 cycles.

Putting things in front of the message also gave me the nastiest bug of the lot. The state for the day and the second
lives in the 64 bytes right before the message. At first the message started "somewhere in the first 64 bytes" of its
buffer, so three times out of four the state was written in front of the buffer, over the bookkeeping of the memory
allocator. On the Mac it crashed in `free()` two runs out of three. On x86 all tests passed. Only glibc's own heap
checks caught it there, and the address sanitizer missed it completely, because its allocator happens to align blocks
to 64 bytes. The heap checks are now part of every test run.

> // The best bugs only show up on the machine you're not looking at.

## The final code

104 instructions, and the only jumps are the seven checks that never go anywhere. The colors link each line to the
instructions it became; hover over a line or an instruction to see its partners.

{% include godbolt-fix.html %}

*The final fast path, the instructions GCC made of it in its own order, and what each one does.*
