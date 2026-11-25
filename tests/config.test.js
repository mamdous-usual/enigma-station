import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ConfigError, createConfig } from '../js/core/enigma.js';
import {
  DEFAULT_CONFIG,
  configFromHash,
  configToHash,
  configToString,
  parseConfigString,
  parsePlugboardText,
  plugboardToString,
} from '../js/core/config.js';
import { randomConfig, rng } from './helpers.js';

const sample = createConfig({
  rotors: ['II', 'IV', 'V'],
  reflector: 'B',
  rings: [1, 20, 11],
  positions: [1, 11, 0],
  plugboard: [['A', 'V'], ['B', 'S'], ['C', 'G']],
});

test('configToString writes the canonical one-line form', () => {
  assert.equal(
    configToString(sample),
    'Enigma I | Reflector B | Rotors II-IV-V | Rings 02-21-12 | Start BLA | Plugs AV BS CG',
  );
  assert.equal(
    configToString(DEFAULT_CONFIG),
    'Enigma I | Reflector B | Rotors I-II-III | Rings 01-01-01 | Start AAA | Plugs none',
  );
});

test('settings text round-trips for random configurations', () => {
  const rand = rng(2024);
  for (let i = 0; i < 200; i += 1) {
    const original = createConfig(randomConfig(rand));
    const parsed = parseConfigString(configToString(original));
    assert.deepEqual(parsed, original);
  }
});

test('the parser is tolerant of case, separators, ring letters and German field names', () => {
  const variants = [
    'enigma i | reflector b | rotors ii iv v | rings 2 21 12 | start b l a | plugs av bs cg',
    'UKW B | Walzenlage II-IV-V | Ringstellung BUL | Grundstellung BLA | Steckerverbindungen A-V, B-S, C-G',
    'Reflector: B | Rotors: II, IV, V | Rings: 02,21,12 | Start: B L A | Plugs: AV BS CG',
  ];
  for (const text of variants) assert.deepEqual(parseConfigString(text), sample, text);
});

test('plugs are optional and "none" means no cables', () => {
  const noPlugs = 'Reflector B | Rotors I-II-III | Rings 01-01-01 | Start AAA';
  assert.deepEqual(parseConfigString(noPlugs).plugboard, []);
  assert.deepEqual(parseConfigString(`${noPlugs} | Plugs none`).plugboard, []);
  assert.deepEqual(parseConfigString(`${noPlugs} | Plugs`).plugboard, []);
});

test('the parser rejects bad settings with specific messages', () => {
  const ok = 'Reflector B | Rotors I-II-III | Rings 01-01-01 | Start AAA | Plugs none';
  const bad = [
    ['', /empty/],
    ['   |  | ', /empty/],
    [ok.replace('Reflector B | ', ''), /missing the reflector/],
    [ok.replace('Rotors I-II-III | ', ''), /missing the rotors/],
    [ok.replace('Rings 01-01-01 | ', ''), /missing the rings/],
    [ok.replace(' | Start AAA', ''), /missing the start/],
    [`Enigma M3 | ${ok}`, /Only the Enigma I/],
    [ok.replace('I-II-III', 'I-II-VI'), /Unknown rotor "VI"/],
    [ok.replace('I-II-III', 'I-II-II'), /only once/],
    [ok.replace('I-II-III', 'I-II'), /three rotor numbers/],
    [ok.replace('Reflector B', 'Reflector D'), /Unknown reflector/],
    [ok.replace('01-01-01', '01-01-27'), /ring setting/],
    [ok.replace('01-01-01', '00-01-01'), /ring setting/],
    [ok.replace('01-01-01', '01-01'), /three values/],
    [ok.replace('Start AAA', 'Start AA'), /three letters/],
    [ok.replace('Start AAA', 'Start A1A'), /three letters/],
    [ok.replace('Plugs none', 'Plugs AB BC'), /more than one cable/],
    [ok.replace('Plugs none', 'Plugs AA'), /to itself/],
    [ok.replace('Plugs none', 'Plugs A'), /not a cable/],
    [`${ok} | Colour red`, /Unrecognised field "Colour"/],
  ];
  for (const [text, pattern] of bad) {
    assert.throws(
      () => parseConfigString(text),
      (err) => err instanceof ConfigError && pattern.test(err.message),
      `${JSON.stringify(text)} should match ${pattern}`,
    );
  }
});

test('parsePlugboardText notation', () => {
  assert.deepEqual(parsePlugboardText('av bs'), [['A', 'V'], ['B', 'S']]);
  assert.deepEqual(parsePlugboardText('A-V, B/S; C:G'), [['A', 'V'], ['B', 'S'], ['C', 'G']]);
  assert.deepEqual(parsePlugboardText(''), []);
  assert.deepEqual(parsePlugboardText('  none '), []);
  assert.deepEqual(parsePlugboardText(null), []);
  assert.throws(() => parsePlugboardText('AB C'), /"C" is not a cable/);
  assert.throws(() => parsePlugboardText('ABC'), /"ABC" is not a cable/);
  assert.throws(() => parsePlugboardText('ÄV'), ConfigError);
  assert.equal(plugboardToString([['A', 'V'], ['B', 'S']]), 'AV BS');
});

test('share links round-trip and are safe to put in a URL fragment', () => {
  const hash = configToHash(sample);
  assert.match(hash, /^#key=/);
  assert.ok(!/[ |]/.test(hash), 'no raw spaces or pipes in the fragment');
  assert.deepEqual(configFromHash(hash), sample);
  const rand = rng(8);
  for (let i = 0; i < 50; i += 1) {
    const cfg = createConfig(randomConfig(rand));
    assert.deepEqual(configFromHash(configToHash(cfg)), cfg);
  }
});

test('configFromHash ignores unrelated fragments and rejects broken links', () => {
  assert.equal(configFromHash(''), null);
  assert.equal(configFromHash('#'), null);
  assert.equal(configFromHash('#section'), null);
  assert.equal(configFromHash(undefined), null);
  assert.throws(() => configFromHash('#key=%E0%A4%A'), /malformed/);
  assert.throws(() => configFromHash('#key=nonsense'), ConfigError);
  assert.throws(() => configFromHash('#key='), ConfigError);
});

test('DEFAULT_CONFIG is the quick-start machine', () => {
  assert.deepEqual(DEFAULT_CONFIG.rotors, ['I', 'II', 'III']);
  assert.equal(DEFAULT_CONFIG.reflector, 'B');
  assert.deepEqual(DEFAULT_CONFIG.plugboard, []);
});
