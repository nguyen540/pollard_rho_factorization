# Pollard Rho Factorization

Integer factorization for JavaScript numbers, combining deterministic Miller-Rabin
primality testing with Pollard's rho (Brent variant). Exposes three names from
`src/index.js`:

- `factorize(n)` — returns the prime factorization of `n` as a sorted array,
  with repeated factors repeated (e.g. `factorize(12)` returns `[2, 2, 3]`).
- `isPrime(n)` — deterministic primality test for integers in this library's
  supported range.
- `gcd(a, b)` — binary GCD, used internally and useful on its own.

## Usage

```js
import { factorize, isPrime, gcd } from 'pollard-rho-factorization';

factorize(62773369); // [7919, 7927]
isPrime(7919);       // true
gcd(54, 24);         // 6
```

## Why this exists

Pollard's rho is the standard answer when trial division gets slow but a full
SQUFOF or GNFS is overkill — it splits semiprimes in the 12-digit range in a
handful of iterations. The trade-off here is scope: this library treats integers
as JS `Number`s, so the safe input ceiling is `Number.MAX_SAFE_INTEGER` (2^53 − 1).
Going above that would require arbitrary-precision arithmetic and a third-party
bignum dependency, which the brief explicitly forbids. The deterministic
Miller-Rabin witnesses are the first twelve primes, which Sorenson & Webster
proved sufficient for the entire safe-integer range, so `isPrime` is genuinely
deterministic here — not probabilistic.

## Awkward edge

`factorize(1)` returns `[1]`. This is the empty-product convention dressed up as
a one-element array; callers that sum or multiply the result get back the input.
If you need a strictly empty list for the unit, special-case `1` yourself.

Inputs above `2^53 − 1` throw `RangeError` rather than silently producing wrong
factors from floating-point rounding. Non-integers throw `TypeError`.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

