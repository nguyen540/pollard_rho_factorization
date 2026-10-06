import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factorize, isPrime, gcd } from '../src/index.js';

test('gcd handles small and edge cases', () => {
  assert.equal(gcd(0, 0), 0);
  assert.equal(gcd(0, 5), 5);
  assert.equal(gcd(5, 0), 5);
  assert.equal(gcd(54, 24), 6);
  assert.equal(gcd(17, 19), 1);
  assert.equal(gcd(-54, 24), 6);
  assert.equal(gcd(54, -24), 6);
});

test('isPrime rejects non-integers and below 2', () => {
  assert.equal(isPrime(1.5), false);
  assert.equal(isPrime(1), false);
  assert.equal(isPrime(0), false);
  assert.equal(isPrime(-7), false);
});

test('isPrime identifies small primes', () => {
  for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]) {
    assert.equal(isPrime(p), true, `${p} should be prime`);
  }
});

test('isPrime identifies small composites', () => {
  for (const c of [4, 6, 8, 9, 15, 21, 25, 27, 33, 35, 49]) {
    assert.equal(isPrime(c), false, `${c} should not be prime`);
  }
});

test('isPrime is deterministic on deterministic range', () => {
  // 2^53 - 57 is the largest Miller-Rabin pseudoprime that the 12-witness set
  // would still reject; we exercise several near the top of the safe range.
  assert.equal(isPrime(Number.MAX_SAFE_INTEGER - 33), false);
  assert.equal(isPrime(9007199254740881), true);
  assert.equal(isPrime(9007199254740882), false);
});

test('factorize of 1 returns [1]', () => {
  assert.deepEqual(factorize(1), [1]);
});

test('factorize of a prime returns that prime', () => {
  assert.deepEqual(factorize(2), [2]);
  assert.deepEqual(factorize(17), [17]);
  assert.deepEqual(factorize(7919), [7919]);
});

test('factorize of a prime power repeats the factor', () => {
  assert.deepEqual(factorize(8), [2, 2, 2]);
  assert.deepEqual(factorize(9), [3, 3]);
  assert.deepEqual(factorize(1024), Array(10).fill(2));
});

test('factorize of a composite with distinct factors', () => {
  assert.deepEqual(factorize(12), [2, 2, 3]);
  assert.deepEqual(factorize(60), [2, 2, 3, 5]);
  assert.deepEqual(factorize(1001), [7, 11, 13]);
});

test('factorize of a product of two large primes', () => {
  // 7919 * 7927 = 62773913 — Pollard's territory (no small factors).
  assert.deepEqual(factorize(62773913), [7919, 7927]);
});

test('factorize rejects non-integers', () => {
  assert.throws(() => factorize(1.5), TypeError);
  assert.throws(() => factorize('12'), TypeError);
});

test('factorize rejects inputs below 1', () => {
  assert.throws(() => factorize(0), RangeError);
  assert.throws(() => factorize(-5), RangeError);
});

test('factorize rejects inputs above MAX_SAFE_INTEGER', () => {
  assert.throws(() => factorize(Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => factorize(2 ** 54), RangeError);
});

test('factorize output is sorted ascending and produces the original product', () => {
  for (const n of [97, 360, 1024, 62773369, 314159]) {
    const fs = factorize(n);
    for (let i = 1; i < fs.length; i++) {
      assert.ok(fs[i] >= fs[i - 1], 'factors must be sorted');
    }
    const product = fs.reduce((a, b) => a * b, 1);
    assert.equal(product, n);
  }
});
