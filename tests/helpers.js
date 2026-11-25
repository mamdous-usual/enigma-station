// Shared helpers for the test suite (not a test file itself).

import { ALPHABET } from '../js/core/data.js';

/** Small deterministic PRNG (mulberry32) so "random" tests are reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rand, list) => list[Math.floor(rand() * list.length)];

export function shuffled(rand, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomLetters(rand, n) {
  let s = '';
  for (let i = 0; i < n; i += 1) s += ALPHABET[Math.floor(rand() * 26)];
  return s;
}

/** A random but valid configuration (any rotor order, reflector, rings, start, 0–10 cables). */
export function randomConfig(rand) {
  const letters = shuffled(rand, [...ALPHABET]);
  const cables = Math.floor(rand() * 11);
  const plugboard = [];
  for (let i = 0; i < cables; i += 1) plugboard.push([letters[2 * i], letters[2 * i + 1]]);
  return {
    rotors: shuffled(rand, ['I', 'II', 'III', 'IV', 'V']).slice(0, 3),
    reflector: pick(rand, ['A', 'B', 'C']),
    rings: [0, 0, 0].map(() => Math.floor(rand() * 26)),
    positions: [0, 0, 0].map(() => Math.floor(rand() * 26)),
    plugboard,
  };
}

export const idx = (letters) => [...letters].map((ch) => ch.charCodeAt(0) - 65);
