/**
 * Text handling for message mode.
 *
 * Rules (also documented in the README and in the UI):
 *  - The letters A–Z, in either case, are encrypted and always come out upper-case.
 *  - Every other character (spaces, digits, punctuation, accented letters, emoji,
 *    line breaks…) is passed through unchanged and does NOT advance the rotors.
 *  - Accented and non-Latin letters are never transliterated (ä stays ä).
 */

import { Enigma, letterIndex, positionsToString } from './enigma.js';

/**
 * Encrypts (or, identically, decrypts) a whole text from the configured start positions.
 * @returns {{output: string, letters: number, preserved: number, startPositions: string, endPositions: string}}
 */
export function encryptText(config, text) {
  const machine = new Enigma(config);
  const startPositions = positionsToString(machine.positions);
  let output = '';
  let letters = 0;
  let preserved = 0;
  // Iterating a string yields whole code points, so surrogate pairs (emoji) stay intact.
  for (const ch of String(text ?? '')) {
    if (letterIndex(ch) >= 0) {
      output += machine.press(ch).output;
      letters += 1;
    } else {
      output += ch;
      preserved += 1;
    }
  }
  return { output, letters, preserved, startPositions, endPositions: positionsToString(machine.positions) };
}

/** Keeps only the letters A–Z (upper-cased). */
export function lettersOnly(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    if (letterIndex(ch) >= 0) out += ch.toUpperCase();
  }
  return out;
}

/** Letters only, in space-separated groups (five by default, the traditional radio format). */
export function groupLetters(text, size = 5) {
  const letters = lettersOnly(text);
  const groups = [];
  for (let i = 0; i < letters.length; i += size) groups.push(letters.slice(i, i + size));
  return groups.join(' ');
}

/** @param {'preserve'|'groups'} format */
export function formatOutput(text, format) {
  return format === 'groups' ? groupLetters(text) : String(text ?? '');
}
