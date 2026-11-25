/**
 * Regression tests against vectors produced by an independent implementation
 * (the `py-enigma` Python package, v1.0.2). The fixture covers every rotor,
 * reflectors A/B/C (A built through py-enigma's own Rotor class from the same
 * wiring), plugboards of 0–10 cables, random ring settings, and starts placed
 * one step before a double step. See tests/fixtures/README.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createConfig } from '../js/core/enigma.js';
import { encryptText } from '../js/core/text.js';
import { EXAMPLES, findExample } from '../js/core/examples.js';
import { idx } from './helpers.js';

const vectors = JSON.parse(
  readFileSync(new URL('./fixtures/reference-vectors.json', import.meta.url), 'utf8'),
);

test('the fixture is non-trivial', () => {
  assert.ok(vectors.length >= 60);
  assert.ok(vectors.reduce((n, v) => n + v.input.length, 0) > 15000);
  assert.ok(new Set(vectors.map((v) => v.reflector)).size === 3, 'all three reflectors are covered');
  assert.ok(new Set(vectors.flatMap((v) => v.rotors)).size === 5, 'all five rotors are covered');
});

test('output matches the independent implementation for every vector', () => {
  for (const [n, v] of vectors.entries()) {
    const config = createConfig({
      rotors: v.rotors,
      reflector: v.reflector,
      rings: v.rings,
      positions: idx(v.start),
      plugboard: v.plugs.map((p) => [p[0], p[1]]),
    });
    const { output } = encryptText(config, v.input);
    assert.equal(
      output,
      v.output,
      `vector ${n}: rotors ${v.rotors.join('-')}, UKW-${v.reflector}, rings ${v.rings}, start ${v.start}, plugs ${v.plugs.join(' ') || 'none'}`,
    );
  }
});

/* ---------------- bundled examples ---------------- */

test('example ids are unique and every example is complete', () => {
  assert.equal(new Set(EXAMPLES.map((e) => e.id)).size, EXAMPLES.length);
  for (const e of EXAMPLES) {
    assert.ok(e.title && e.description && e.message, e.id);
    assert.ok(Array.isArray(e.config.rotors), e.id);
    assert.ok(findExample(e.id) === e);
  }
  assert.equal(findExample('nope'), undefined);
});

test('quick start example: AAAAA → BDZGO', () => {
  const e = findExample('quickstart');
  assert.equal(encryptText(e.config, e.message).output, 'BDZGO');
});

test('double-step example walks ADU → ADV → AEW → BFX → BFY', () => {
  const e = findExample('doublestep');
  const r = encryptText(e.config, e.message);
  assert.equal(r.startPositions, 'ADU');
  assert.equal(r.endPositions, 'BFY');
});

test('ring example differs from the quick start only by its rings', () => {
  const quick = findExample('quickstart');
  const rings = findExample('rings');
  assert.deepEqual(rings.config.rotors, quick.config.rotors);
  assert.deepEqual(rings.config.positions, quick.config.positions);
  assert.notEqual(encryptText(rings.config, rings.message).output, 'BDZGO');
});

test('Barbarossa example decrypts to German text, keeping the five-letter layout', () => {
  const e = findExample('barbarossa');
  const { output } = encryptText(e.config, e.message);
  assert.ok(output.startsWith('AUFKL XABTE ILUNG XVONX KURTI NOWAX'), output.slice(0, 40));
  assert.equal(output.replace(/ /g, '').length, e.message.replace(/ /g, '').length);
});

test('plugboard example is reciprocal', () => {
  const e = findExample('plugboard');
  const once = encryptText(e.config, e.message).output;
  assert.equal(encryptText(e.config, once).output, e.message);
  assert.notEqual(once, e.message);
});
