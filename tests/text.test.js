import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createConfig } from '../js/core/enigma.js';
import { DEFAULT_CONFIG } from '../js/core/config.js';
import { encryptText, formatOutput, groupLetters, lettersOnly } from '../js/core/text.js';
import { idx, randomConfig, rng } from './helpers.js';

const cfg = createConfig({
  rotors: ['III', 'I', 'II'],
  reflector: 'B',
  rings: [4, 11, 2],
  positions: idx('MCK'),
  plugboard: [['A', 'M'], ['F', 'I']],
});

/** Upper-cases only A–Z, exactly like the machine does. */
const upperAscii = (s) => s.replace(/[a-z]/g, (c) => c.toUpperCase());
/** Extracts the letters the machine is expected to process. */
const asciiLetters = (s) => s.replace(/[^A-Za-z]/g, '').toUpperCase();

test('empty input gives empty output and zero counts', () => {
  const r = encryptText(cfg, '');
  assert.deepEqual(r, { output: '', letters: 0, preserved: 0, startPositions: 'MCK', endPositions: 'MCK' });
  assert.equal(encryptText(cfg, undefined).output, '');
  assert.equal(encryptText(cfg, null).output, '');
});

test('spaces, digits and punctuation are preserved and do not advance the rotors', () => {
  const noisy = encryptText(cfg, 'HE,LL O 123 -- WOR!LD?\n\tOK.');
  const clean = encryptText(cfg, 'HELLOWORLDOK');
  assert.equal(asciiLetters(noisy.output), clean.output);
  assert.equal(noisy.endPositions, clean.endPositions);
  assert.equal(noisy.letters, 12);
  // Layout is untouched: replace the letters in the output by the originals' positions.
  const original = 'HE,LL O 123 -- WOR!LD?\n\tOK.';
  assert.equal(noisy.output.replace(/[A-Z]/g, '#'), original.replace(/[A-Za-z]/g, '#'));
});

test('lower-case letters are encrypted and come out upper-case', () => {
  assert.equal(encryptText(cfg, 'hello world').output, encryptText(cfg, 'HELLO WORLD').output);
  assert.match(encryptText(cfg, 'hello').output, /^[A-Z]{5}$/);
});

test('non-ASCII text passes through untouched and never advances the rotors', () => {
  const text = 'Äpfel ß 😀 日本語 É k';
  const result = encryptText(cfg, text);
  assert.equal(result.letters, asciiLetters(text).length);
  // Every non-ASCII-letter character appears unchanged at the same position.
  const strip = (s) => [...s].map((ch) => (/^[A-Za-z]$/.test(ch) ? '#' : ch)).join('');
  assert.equal(strip(result.output), strip(text));
  assert.ok(result.output.includes('😀'), 'surrogate pairs stay intact');
  assert.ok(result.output.includes('ß'));
  assert.ok(result.output.includes('日本語'));
  assert.equal(result.output.includes('�'), false, 'no broken surrogates');
});

test('reciprocal on mixed text: encrypt twice returns the upper-cased original', () => {
  const rand = rng(42);
  const samples = [
    'The quick brown fox jumps over the lazy dog.',
    'Ärger, Übung & Öl — 12:30 "Quoted" text\nsecond line\twith tab',
    'ß ŉ 😀 AAAA aaaa',
    '',
    '   ',
    '12345 !!!',
  ];
  for (const text of samples) {
    const twice = encryptText(cfg, encryptText(cfg, text).output).output;
    assert.equal(twice, upperAscii(text), JSON.stringify(text));
  }
  for (let i = 0; i < 20; i += 1) {
    const config = randomConfig(rand);
    const text = 'Hello, World! '.repeat(1 + Math.floor(rand() * 30));
    assert.equal(encryptText(config, encryptText(config, text).output).output, upperAscii(text));
  }
});

test('start and end positions are reported', () => {
  const r = encryptText(DEFAULT_CONFIG, 'AAAAA');
  assert.equal(r.startPositions, 'AAA');
  assert.equal(r.endPositions, 'AAF');
  assert.equal(r.output, 'BDZGO');
});

test('encryptText always begins at the configured start positions (no shared state)', () => {
  const first = encryptText(cfg, 'HELLO').output;
  const second = encryptText(cfg, 'HELLO').output;
  assert.equal(first, second);
});

/* ---------------- formatting helpers ---------------- */

test('lettersOnly keeps A–Z only and upper-cases', () => {
  assert.equal(lettersOnly('a1 b,c-Ä😀d'), 'ABCD');
  assert.equal(lettersOnly(''), '');
});

test('groupLetters builds groups of five', () => {
  assert.equal(groupLetters('HELLOWORLD'), 'HELLO WORLD');
  assert.equal(groupLetters('hello world!'), 'HELLO WORLD');
  assert.equal(groupLetters('ABCDEFGHIJKL'), 'ABCDE FGHIJ KL');
  assert.equal(groupLetters('ABC'), 'ABC');
  assert.equal(groupLetters(''), '');
  assert.equal(groupLetters('ABCDEFGH', 4), 'ABCD EFGH');
});

test('formatOutput switches between layouts', () => {
  assert.equal(formatOutput('Ab, cd!', 'preserve'), 'Ab, cd!');
  assert.equal(formatOutput('Ab, cd!', 'groups'), 'ABCD');
  assert.equal(formatOutput(undefined, 'preserve'), '');
});

test('grouped output is still decryptable (spaces are ignored on the way back)', () => {
  const message = 'Attack at dawn from the north side';
  const grouped = formatOutput(encryptText(cfg, message).output, 'groups');
  assert.equal(encryptText(cfg, grouped).output.replace(/ /g, ''), asciiLetters(message));
});
