/**
 * Reading and writing machine settings as text, so they can be recorded, pasted
 * and shared. Pure logic: no DOM access.
 *
 * Canonical form (one line):
 *   Enigma I | Reflector B | Rotors II-IV-V | Rings 02-21-12 | Start BLA | Plugs AV BS CG DL FU HZ IN KM OW RX
 */

import { ConfigError, createConfig, letterIndex, positionsToString, ringLabel } from './enigma.js';
import { ALPHABET, REFLECTOR_IDS, ROTOR_IDS } from './data.js';

/** A random valid configuration with 6–10 cables. Not cryptographically random: this is a teaching tool. */
export function randomConfig(random = Math.random) {
  const int = (n) => Math.floor(random() * n);
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const letters = shuffle([...ALPHABET]);
  const cables = 6 + int(5);
  const plugboard = [];
  for (let i = 0; i < cables; i += 1) plugboard.push([letters[2 * i], letters[2 * i + 1]]);
  return createConfig({
    rotors: shuffle(ROTOR_IDS).slice(0, 3),
    reflector: REFLECTOR_IDS[int(REFLECTOR_IDS.length)],
    rings: [int(26), int(26), int(26)],
    positions: [int(26), int(26), int(26)],
    plugboard,
  });
}

export const DEFAULT_CONFIG = createConfig({
  rotors: ['I', 'II', 'III'],
  reflector: 'B',
  rings: [0, 0, 0],
  positions: [0, 0, 0],
  plugboard: [],
});

export const plugboardToString = (plugboard) => plugboard.map((pair) => pair.join('')).join(' ');

export function configToString(cfg) {
  return [
    'Enigma I',
    `Reflector ${cfg.reflector}`,
    `Rotors ${cfg.rotors.join('-')}`,
    `Rings ${cfg.rings.map(ringLabel).join('-')}`,
    `Start ${positionsToString(cfg.positions)}`,
    `Plugs ${cfg.plugboard.length > 0 ? plugboardToString(cfg.plugboard) : 'none'}`,
  ].join(' | ');
}

/**
 * Parses plugboard text such as "AV BS CG" (also "A-V, B-S" or "none").
 * Only checks the notation; createConfig() checks that cables don't clash.
 */
export function parsePlugboardText(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '' || /^(none|-|–|—)$/i.test(trimmed)) return [];
  const pairs = [];
  const problems = [];
  for (const token of trimmed.split(/[\s,;]+/).filter(Boolean)) {
    const m = /^([A-Za-z])[-–—/:↔]?([A-Za-z])$/.exec(token);
    if (m) pairs.push([m[1].toUpperCase(), m[2].toUpperCase()]);
    else problems.push(`"${token}" is not a cable. Write each cable as two letters, for example AV.`);
  }
  if (problems.length > 0) throw new ConfigError(problems);
  return pairs;
}

const FIELD_ALIASES = {
  enigma: 'model',
  model: 'model',
  reflector: 'reflector',
  ukw: 'reflector',
  rotors: 'rotors',
  walzenlage: 'rotors',
  rings: 'rings',
  ringstellung: 'rings',
  start: 'start',
  grundstellung: 'start',
  positions: 'start',
  plugs: 'plugs',
  plugboard: 'plugs',
  stecker: 'plugs',
  steckerverbindungen: 'plugs',
};

const TOKEN_SPLIT = /[\s,\-–—·]+/;

/** Splits "BUL" or "B U L" or "B-U-L" into letters; returns null if it isn't three letters. */
function threeLetters(value) {
  const letters = value.replace(/[^A-Za-z]/g, '');
  return /^[A-Za-z]{3}$/.test(letters) && !/\d/.test(value) ? [...letters.toUpperCase()] : null;
}

function parseRings(value, problems) {
  const tokens = value.split(TOKEN_SPLIT).filter(Boolean);
  const letters = tokens.length === 1 ? threeLetters(value) : null;
  const items = letters ?? tokens;
  if (items.length !== 3) {
    problems.push('Rings needs three values, for example 02-21-12 or BUL.');
    return null;
  }
  const rings = items.map((t) => {
    if (/^\d{1,2}$/.test(t)) {
      const n = Number(t);
      return n >= 1 && n <= 26 ? n - 1 : NaN;
    }
    return /^[A-Za-z]$/.test(t) ? letterIndex(t) : NaN;
  });
  if (rings.some(Number.isNaN)) {
    problems.push('Each ring setting must be a number from 01 to 26 or a letter from A to Z.');
    return null;
  }
  return rings;
}

/**
 * Parses the one-line settings text produced by configToString (tolerant of
 * case, spacing and the German field names Walzenlage, Ringstellung,
 * Grundstellung and Steckerverbindungen). Throws ConfigError.
 */
export function parseConfigString(text) {
  const parts = String(text ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new ConfigError('The settings text is empty.');

  const fields = {};
  const problems = [];
  for (const part of parts) {
    const m = /^([A-Za-z]+)\s*:?\s*(.*)$/.exec(part);
    const field = m ? FIELD_ALIASES[m[1].toLowerCase()] : undefined;
    if (!field) {
      problems.push(`Unrecognised field "${part.split(/\s/)[0]}".`);
      continue;
    }
    fields[field] = m[2].trim();
  }

  if (fields.model !== undefined && fields.model.toUpperCase() !== 'I') {
    problems.push('Only the Enigma I is simulated.');
  }
  for (const required of ['reflector', 'rotors', 'rings', 'start']) {
    if (fields[required] === undefined) problems.push(`The settings are missing the ${required} field.`);
  }
  if (problems.length > 0) throw new ConfigError(problems);

  const rotors = fields.rotors.split(TOKEN_SPLIT).filter(Boolean).map((s) => s.toUpperCase());
  if (rotors.length !== 3) problems.push('Rotors needs three rotor numbers, for example II-IV-V.');

  const rings = parseRings(fields.rings, problems);

  const start = threeLetters(fields.start);
  if (!start) problems.push('Start needs three letters, for example BLA.');

  const reflector = fields.reflector.toUpperCase();
  let plugboard = [];
  try {
    plugboard = parsePlugboardText(fields.plugs ?? '');
  } catch (err) {
    if (err instanceof ConfigError) problems.push(...err.problems);
    else throw err;
  }
  if (problems.length > 0) throw new ConfigError(problems);

  return createConfig({
    rotors,
    reflector,
    rings,
    positions: start.map((ch) => letterIndex(ch)),
    plugboard,
  });
}

/* Share links: the settings travel in the URL fragment, which is never sent to a server. */

export const configToHash = (cfg) => `#key=${encodeURIComponent(configToString(cfg))}`;

/** Returns null when the hash carries no settings; throws ConfigError when it carries unreadable ones. */
export function configFromHash(hash) {
  const m = /^#?key=(.*)$/.exec(String(hash ?? ''));
  if (!m) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(m[1]);
  } catch {
    throw new ConfigError('The link is malformed.');
  }
  return parseConfigString(decoded);
}
