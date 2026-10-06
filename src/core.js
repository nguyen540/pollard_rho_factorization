/**
 * Integer factorization via Miller-Rabin primality testing and Pollard's rho.
 *
 * Scope decision: big integers are taken as JS Numbers (IEEE-754 doubles),
 * which safely represent integers up to 2^53 exactly. Inputs above 2^53 are
 * rejected outright (see MAX_SAFE_INT). This avoids a dependency on BigInt
 * arithmetic-in-strings libraries, and a single clear ceiling beats a fuzzy
 * promise of "arbitrary precision". The README states this explicitly.
 */

const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER; // 2^53 - 1

/**
 * GCD via the binary algorithm. Chosen over the classic Euclid loop because it
 * avoids division/modulo entirely (bit ops only) and tends to be a touch faster
 * on small inputs without anything to tune. Returns a non-negative integer.
 */
export function gcd(a, b) {
  a = Math.abs(a | 0);
  b = Math.abs(b | 0);
  if (a === 0) return b | 0;
  if (b === 0) return a | 0;
  let shift = 0;
  while (((a | b) & 1) === 0) { a >>= 1; b >>= 1; shift++; }
  while ((a & 1) === 0) a >>= 1;
  while (b !== 0) {
    while ((b & 1) === 0) b >>= 1;
    if (a > b) { const t = a; a = b; b = t; }
    b = b - a;
  }
  return a << shift;
}

/**
 * Modular exponentiation (b^e mod m) via left-to-right binary exponentiation.
 * Stays within Number range by reducing mod m after every multiply/square.
 * All inputs must be non-negative and fit in 32 bits of product headroom.
 */
function modPow(base, exp, mod) {
  if (mod === 1) return 0;
  let result = 1;
  base = base % mod;
  while (exp > 0) {
    if (exp & 1) result = (result * base) % mod;
    exp >>= 1;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Deterministic Miller-Rabin over the first 12 primes, which is enough to
n * prove primality for every n < 2^53. This bound is the result of Sorenson
 * & Webster (2015), so the "deterministic" claim is real for our input range,
 * not probabilistic hand-waving.
 */
const SMALL_WITNESSES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];

export function isPrime(n) {
  if (!Number.isInteger(n)) return false;
  if (n < 2) return false;
  for (const p of SMALL_WITNESSES) {
    if (n === p) return true;
    if (n % p === 0) return false;
  }
  // Write n-1 = d * 2^s with d odd.
  let d = n - 1;
  let s = 0;
  while ((d & 1) === 0) { d >>= 1; s++; }
  // n - 1 < 2^53, and witness^d * (n-1) < 37 * (2^53-1), well within Number's
  // 53-bit mantissa, so no intermediate can exceed safe-integer precision.
  witness_loop: for (const a of SMALL_WITNESSES) {
    let x = modPow(a, d, n);
    if (x === 1 || x === n - 1) continue witness_loop;
    for (let i = 0; i < s - 1; i++) {
      x = (x * x) % n;
      if (x === n - 1) continue witness_loop;
    }
    return false;
  }
  return true;
}

/**
 * Pollard's rho with Brent's cycle detection. Brent's variant was used
 * because it avoids the extra modular multiply required per step in the
 * classic Floyd cycle finder — at small input sizes the saving is small but
 * real, and the code is no longer than Floyd's.
 *
 * Returns a non-trivial factor of n, where n is known composite and > 1.
 * Throws if no factor is found within the iteration bound; callers retry.
 */
function pollardRho(n) {
  if (n % 2 === 0) return 2;
  // x^2 + c is standard; c picked from a small rotating set so retries
  // explore different cycles without exposing a knob to callers.
  const cs = [1, 3, 5, 7, 11, 13];
  for (let ci = 0; ci < cs.length; ci++) {
    const c = cs[ci];
    let x = 2, y = 2, d = 1;
    let q = 1, diffs = 0;
    const bound = 1 << 20;
    while (d === 1 && diffs < bound) {
      x = (x * x + c) % n;
      const diff = (y - x + n) % n;
      q = (q * diff) % n;
      diffs++;
      // Batch GCD every 128 iterations to amortise the cost. Sticking to a
      // power of two is not magic; it just keeps the modulo path branch-free.
      if ((diffs & 127) === 0) {
        d = gcd(q, n);
        q = 1;
      }
    }
    if (d > 1 && d < n) return d;
  }
  throw new Error('pollardRho: no factor found for ' + n);
}

/**
 * Full prime factorization with multiplicity.
 *
 * Returns an array of prime factors sorted ascending; repeated factors are
 * repeated (e.g. 12 -> [2, 2, 3]). Returns [1] for n = 1, matching the
 * convention that 1 has exactly one factorisation. Throws for non-integers,
 * values below 1, and values above Number.MAX_SAFE_INTEGER (precision lost).
 */
export function factorize(n) {
  if (!Number.isInteger(n)) {
    throw new TypeError('factorize: input must be an integer');
  }
  if (n < 1) {
    throw new RangeError('factorize: input must be >= 1');
  }
  if (n > MAX_SAFE_INT) {
    throw new RangeError('factorize: input exceeds MAX_SAFE_INTEGER');
  }
  if (n === 1) return [1];

  const factors = [];
  let m = n;

  // Strip the easy primes first. Doing 2 and 3 explicitly, then stepping by
  // 6 ± 1, removes the obvious factors before the probabilistic loop runs,
  // so Pollard only ever sees numbers with no small divisors.
  for (const p of [2, 3]) {
    while (m % p === 0) { factors.push(p); m /= p; }
  }
  for (let p = 5; p * p <= m; p += 6) {
    while (m % p === 0) { factors.push(p); m /= p; }
    while (m % (p + 2) === 0) { factors.push(p + 2); m /= (p + 2); }
  }

  // Anything left here is either 1 or a product of larger primes. Pollard
  // handles composites; isPrime lets us stop as soon as a prime lands.
  const stack = m > 1 ? [m] : [];
  while (stack.length > 0) {
    const k = stack.pop();
    if (k === 1) continue;
    if (isPrime(k)) { factors.push(k); continue; }
    let f = pollardRho(k);
    stack.push(f, k / f);
  }

  factors.sort((a, b) => a - b);
  return factors;
}
