// Scratch: snprintf, the /10 loop, the /100 pair loop, std::to_chars and our portable (SWAR) path on the
// benchmark's workload in batches of 16, in ns and in cycles of the core clock measured beside them.
// Run from the repository root in the arm64 container (tools/README.md):
//   g++-14 -std=c++23 -O2 -Ichallenge-20-int-to-string -I. -o cmp challenge-20-int-to-string/blog/src/cmp.cpp && ./cmp

#include <algorithm>
#include <charconv>
#include <chrono>
#include <cinttypes>
#include <cstdio>
#include <cstring>
#include <vector>
#include "common/hftu_xoshiro.h"
#include "solution/solution.h"

static std::vector<uint64_t> make_values(uint64_t seed, size_t n) {
    static constexpr uint64_t P[20] = {1ULL,10ULL,100ULL,1000ULL,10000ULL,100000ULL,1000000ULL,10000000ULL,100000000ULL,1000000000ULL,10000000000ULL,100000000000ULL,1000000000000ULL,10000000000000ULL,100000000000000ULL,1000000000000000ULL,10000000000000000ULL,100000000000000000ULL,1000000000000000000ULL,10000000000000000000ULL};
    hftu::Rng rng(seed); std::vector<uint64_t> v(n);
    for (size_t i = 0; i < n; ++i) {
        uint64_t roll = rng.next_range(100), lo, span;
        if (roll < 30) { int k = int(rng.next_range(6)) + 1; lo = k == 1 ? 0 : P[k-1]; span = P[k] - lo; }
        else if (roll < 55) { int k = int(rng.next_range(4)) + 5; lo = P[k-1]; span = P[k] - lo; }
        else if (roll < 80) { int k = int(rng.next_range(10)) + 10; lo = P[k-1]; span = P[k] - lo; }
        else if (roll < 90) { lo = 1; span = 10'000'000'000ULL; }
        else { lo = 34'200'000'000'000ULL; span = 23'400'000'000'000ULL; }
        v[i] = lo + rng.next_range(span);
    }
    return v;
}

__attribute__((noinline)) size_t naive(uint64_t v, char* buf) {
    char tmp[20]; size_t n = 0;
    do { tmp[n++] = char('0' + v % 10); v /= 10; } while (v);
    for (size_t i = 0; i < n; ++i) buf[i] = tmp[n - 1 - i];
    return n;
}
static inline size_t naive_i(uint64_t v, char* buf) {
    char tmp[20]; size_t n = 0;
    do { tmp[n++] = char('0' + v % 10); v /= 10; } while (v);
    for (size_t i = 0; i < n; ++i) buf[i] = tmp[n - 1 - i];
    return n;
}
static constexpr char kPairs[201] =
    "00010203040506070809101112131415161718192021222324252627282930313233343536373839"
    "40414243444546474849505152535455565758596061626364656667686970717273747576777879"
    "8081828384858687888990919293949596979899";
static constexpr uint64_t kP10[20] = {1ULL,10ULL,100ULL,1000ULL,10000ULL,100000ULL,1000000ULL,10000000ULL,100000000ULL,1000000000ULL,10000000000ULL,100000000000ULL,1000000000000ULL,10000000000000ULL,100000000000000ULL,1000000000000000ULL,10000000000000000ULL,100000000000000000ULL,1000000000000000000ULL,10000000000000000000ULL};
// Two digits per step from a table, written in place because the length is counted first.
static inline size_t pairs(uint64_t v, char* buf) {
    size_t n = 1;
    while (n < 20 && v >= kP10[n]) ++n;
    char* p = buf + n;
    while (v >= 100) {
        const uint64_t pair = v % 100;
        v /= 100;
        p -= 2;
        std::memcpy(p, &kPairs[2 * pair], 2);
    }
    if (v >= 10) std::memcpy(buf, &kPairs[2 * v], 2);
    else buf[0] = char('0' + v);
    return n;
}
static inline size_t tochars(uint64_t v, char* buf) { return size_t(std::to_chars(buf, buf + 32, v).ptr - buf); }
static inline size_t sn(uint64_t v, char* buf) { return size_t(std::snprintf(buf, 21, "%" PRIu64, v)); }
static inline size_t ours(uint64_t v, char* buf) { return hftu::u64_to_chars(v, buf); }

template <size_t (*F)(uint64_t, char*)>
double run(const std::vector<uint64_t>& values) {
    alignas(64) char out[16 * 32];
    char* volatile esc = out; (void)esc;
    uint64_t acc = 0;
    auto t0 = std::chrono::steady_clock::now();
    for (size_t j = 0; j < values.size(); j += 16) {
        for (size_t k = 0; k < 16; ++k) acc += F(values[j + k], out + k * 32);
        asm volatile("" ::: "memory");
    }
    auto t1 = std::chrono::steady_clock::now();
    asm volatile("" :: "r"(acc));
    return std::chrono::duration<double, std::nano>(t1 - t0).count() / values.size();
}

// Core clock from a chain of dependent adds, one cycle each.
static double clock_ghz() {
    constexpr long kIters = 50'000'000;
    uint64_t x = 0;
    auto t0 = std::chrono::steady_clock::now();
    for (long i = 0; i < kIters; ++i) {
#if defined(__aarch64__)
        asm volatile("add %0, %0, #1\n\tadd %0, %0, #1\n\tadd %0, %0, #1\n\tadd %0, %0, #1\n\t"
                     "add %0, %0, #1\n\tadd %0, %0, #1\n\tadd %0, %0, #1\n\tadd %0, %0, #1" : "+r"(x));
#else
        asm volatile("add $1, %0\n\tadd $1, %0\n\tadd $1, %0\n\tadd $1, %0\n\t"
                     "add $1, %0\n\tadd $1, %0\n\tadd $1, %0\n\tadd $1, %0" : "+r"(x));
#endif
    }
    auto t1 = std::chrono::steady_clock::now();
    return 8.0 * kIters / std::chrono::duration<double, std::nano>(t1 - t0).count();
}

int main() {
    auto values = make_values(0x175A57, 1'000'000);
    // correctness check vs to_chars
    for (auto v : values) { char a[32], b[32]; size_t n = ours(v, a), m = tochars(v, b), k = naive_i(v, b + 0);
        char c[32]; tochars(v, c); char d[32]; size_t e = pairs(v, d);
        if (n != m || memcmp(a, c, n) || k != m || memcmp(b, c, k) || e != m || memcmp(d, c, e)) { printf("mismatch %" PRIu64 "\n", v); return 1; } }
    const char* names[] = {"snprintf", "naive /10 loop", "/100 pair loop", "std::to_chars", "ours (SWAR)"};
    std::vector<double> r[5], ghz;
    for (int round = 0; round < 15; ++round) {
        ghz.push_back(clock_ghz());
        r[0].push_back(run<sn>(values));
        r[1].push_back(run<naive_i>(values));
        r[2].push_back(run<pairs>(values));
        r[3].push_back(run<tochars>(values));
        r[4].push_back(run<ours>(values));
    }
    std::sort(ghz.begin(), ghz.end());
    const double f = ghz[ghz.size() / 2];
    printf("clock %.2f GHz (dependent adds)\n", f);
    for (int i = 0; i < 5; ++i) { std::sort(r[i].begin(), r[i].end()); const double m = r[i][r[i].size()/2];
        printf("%-16s %7.2f ns  %6.1f cycles (min %.2f ns)\n", names[i], m, m * f, r[i][0]); }
}
