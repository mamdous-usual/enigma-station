/**
 * Enigma I cipher engine. Pure logic: no DOM, no storage, no timers.
 *
 * Model (all indices are 0–25, A = 0):
 *  - Rotor slots are ordered [left, middle, right]. The right rotor is the fast one.
 *  - `positions` are the letters shown in the rotor windows (the alphabet ring).
 *  - `rings` are the ring settings (Ringstellung). The wiring core is offset from
 *    the displayed letter by (position − ring).
 *  - Stepping happens BEFORE each letter is encrypted, and it is decided by the
 *    displayed letters (the notch is cut into the alphabet ring), so ring
 *    settings never influence stepping.
 *  - Signal path: keyboard → plugboard → right → middle → left rotor → reflector
 *    → left → middle → right rotor (inverse) → plugboard → lamp.
 */

import { ALPHABET, ROTORS, REFLECTORS, MAX_PLUGS, SLOT_NAMES } from './data.js';

const SIZE = 26;

export const mod26 = (n) => ((n % SIZE) + SIZE) % SIZE;

/**
 * Index (0–25) of a single A–Z / a–z character, or −1 for anything else
 * (including strings longer than one UTF-16 code unit).
 */
export function letterIndex(ch) {
  if (typeof ch !== 'string' || ch.length !== 1) return -1;
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97;
  return -1;
}

export const indexLetter = (i) => ALPHABET[mod26(i)];

export const positionsToString = (positions) => positions.map(indexLetter).join('');

export const ringLabel = (i) => String(i + 1).padStart(2, '0');

export class ConfigError extends Error {
  constructor(problems) {
    const list = Array.isArray(problems) ? problems : [String(problems)];
    super(list.join(' '));
    this.name = 'ConfigError';
    this.problems = list;
  }
}

/** True when the rotor, showing `positionIndex` in its window, carries the next rotor on the next step. */
export function isNotch(rotorId, positionIndex) {
  return ROTORS[rotorId].notches.includes(ALPHABET[mod26(positionIndex)]);
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

function validateTriple(values, label, problems) {
  if (!Array.isArray(values) || values.length !== 3) {
    problems.push(`Provide exactly three ${label}s (left, middle, right).`);
    return;
  }
  values.forEach((v, i) => {
    if (!Number.isInteger(v) || v < 0 || v >= SIZE) {
      problems.push(`The ${SLOT_NAMES[i]} ${label} must be a whole number from 0 to 25.`);
    }
  });
}

function validatePlugboard(plugs, problems) {
  if (!Array.isArray(plugs)) {
    problems.push('The plugboard must be a list of letter pairs.');
    return;
  }
  if (plugs.length > MAX_PLUGS) {
    problems.push(`At most ${MAX_PLUGS} plugboard cables can be used (found ${plugs.length}).`);
  }
  const used = new Set();
  for (const pair of plugs) {
    const valid =
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every((l) => typeof l === 'string' && /^[A-Z]$/.test(l));
    if (!valid) {
      problems.push('Each plugboard cable must connect two letters from A to Z.');
      continue;
    }
    const [a, b] = pair;
    if (a === b) {
      problems.push(`A cable cannot connect ${a} to itself.`);
      continue;
    }
    for (const l of pair) {
      if (used.has(l)) problems.push(`Letter ${l} is used by more than one cable.`);
      used.add(l);
    }
  }
}

/** Returns a list of human-readable problems; an empty list means the configuration is valid. */
export function validateConfig(cfg) {
  const problems = [];
  if (!cfg || typeof cfg !== 'object') return ['The machine configuration is missing.'];

  if (!Array.isArray(cfg.rotors) || cfg.rotors.length !== 3) {
    problems.push('Choose exactly three rotors (left, middle, right).');
  } else {
    cfg.rotors.forEach((id, i) => {
      if (typeof id !== 'string' || !Object.hasOwn(ROTORS, id)) {
        problems.push(
          `Unknown rotor ${JSON.stringify(id)} in the ${SLOT_NAMES[i]} slot. Enigma I uses rotors I to V.`,
        );
      }
    });
    if (new Set(cfg.rotors).size !== cfg.rotors.length) {
      problems.push('Each rotor can be fitted only once.');
    }
  }

  if (typeof cfg.reflector !== 'string' || !Object.hasOwn(REFLECTORS, cfg.reflector)) {
    problems.push(`Unknown reflector ${JSON.stringify(cfg.reflector)}. Choose A, B or C.`);
  }

  validateTriple(cfg.rings, 'ring setting', problems);
  validateTriple(cfg.positions, 'start position', problems);
  validatePlugboard(cfg.plugboard, problems);

  return [...new Set(problems)];
}

const deepFreeze = (cfg) => {
  cfg.plugboard.forEach((pair) => Object.freeze(pair));
  [cfg.rotors, cfg.rings, cfg.positions, cfg.plugboard].forEach((a) => Object.freeze(a));
  return Object.freeze(cfg);
};

/** Mutable plain-object copy of a configuration, convenient for building edited versions. */
export function cloneConfig(cfg) {
  return {
    rotors: [...cfg.rotors],
    reflector: cfg.reflector,
    rings: [...cfg.rings],
    positions: [...cfg.positions],
    plugboard: cfg.plugboard.map((pair) => [...pair]),
  };
}

/**
 * Normalises (upper-case, pair letters sorted) and validates a configuration.
 * Throws ConfigError listing every problem. Returns a frozen configuration.
 *
 * Shape: { rotors: ['I','II','III'], reflector: 'B', rings: [0,0,0],
 *          positions: [0,0,0], plugboard: [['A','V'], …] }
 */
export function createConfig(raw) {
  const upper = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v);
  const cfg = {
    rotors: Array.isArray(raw?.rotors) ? raw.rotors.map(upper) : raw?.rotors,
    reflector: upper(raw?.reflector),
    rings: Array.isArray(raw?.rings) ? [...raw.rings] : raw?.rings,
    positions: Array.isArray(raw?.positions) ? [...raw.positions] : raw?.positions,
    plugboard: Array.isArray(raw?.plugboard)
      ? raw.plugboard.map((p) => (Array.isArray(p) ? p.map(upper) : p))
      : (raw?.plugboard ?? []),
  };
  const problems = validateConfig(cfg);
  if (problems.length > 0) throw new ConfigError(problems);
  cfg.plugboard = cfg.plugboard.map(([a, b]) => (a < b ? [a, b] : [b, a]));
  return deepFreeze(cfg);
}

/* ------------------------------------------------------------------ */
/* Stepping                                                            */
/* ------------------------------------------------------------------ */

/**
 * Advances the rotors the way the pawls and ratchets of an Enigma I do, before a letter is encrypted.
 *
 *  - The right rotor always steps.
 *  - The middle rotor steps if the right rotor is at its notch…
 *  - …or if the middle rotor itself is at its notch (the "double step": the
 *    left pawl drops into the middle rotor's notch and pushes both the left and
 *    the middle rotor).
 *  - The left rotor steps only when the middle rotor is at its notch.
 *
 * @param {number[]} positions window letters [left, middle, right] before the key press
 * @param {string[]} rotorIds  rotor names [left, middle, right]
 */
export function stepPositions(positions, rotorIds) {
  const rightAtNotch = isNotch(rotorIds[2], positions[2]);
  const middleAtNotch = isNotch(rotorIds[1], positions[1]);
  const stepped = [middleAtNotch, middleAtNotch || rightAtNotch, true];
  return {
    positions: positions.map((p, i) => (stepped[i] ? mod26(p + 1) : p)),
    stepped,
    rightAtNotch,
    middleAtNotch,
    /** True when this key press is the double step (the middle rotor moves under its own notch). */
    doubleStep: middleAtNotch,
  };
}

/* ------------------------------------------------------------------ */
/* The machine                                                         */
/* ------------------------------------------------------------------ */

const L = indexLetter;

export class Enigma {
  /** @param {object} config see createConfig */
  constructor(config) {
    this.config = createConfig(config);
    const { rotors, reflector, plugboard } = this.config;

    this._rotors = rotors.map((id) => {
      const forward = Array.from(ROTORS[id].wiring, (ch) => letterIndex(ch));
      const inverse = new Array(SIZE);
      forward.forEach((out, i) => {
        inverse[out] = i;
      });
      return { id, forward, inverse };
    });
    this._reflector = Array.from(REFLECTORS[reflector].wiring, (ch) => letterIndex(ch));
    this._plug = Array.from({ length: SIZE }, (_, i) => i);
    for (const [a, b] of plugboard) {
      const x = letterIndex(a);
      const y = letterIndex(b);
      this._plug[x] = y;
      this._plug[y] = x;
    }

    /** Current window letters as indices [left, middle, right]. */
    this.positions = [...this.config.positions];
  }

  /** Restores the configured start positions. */
  reset() {
    this.positions = [...this.config.positions];
  }

  /**
   * Presses a key: steps the rotors, then encrypts. Mutates the machine state.
   * @param {string} letter a single letter A–Z (either case)
   * @param {{trace?: boolean}} [options] include the full signal path in the result
   */
  press(letter, options = {}) {
    const result = this._run(this.positions, this._indexOrThrow(letter), Boolean(options.trace));
    this.positions = result.after;
    return result;
  }

  /** Same as press() but leaves the machine untouched (a dry run of the next key press). */
  peek(letter, options = {}) {
    return this._run(this.positions, this._indexOrThrow(letter), Boolean(options.trace));
  }

  _indexOrThrow(letter) {
    const idx = letterIndex(letter);
    if (idx < 0) {
      throw new RangeError(`Enigma can only encrypt the letters A–Z (received ${JSON.stringify(letter)}).`);
    }
    return idx;
  }

  _run(startPositions, inputIndex, wantTrace) {
    const rotorIds = this.config.rotors;
    const rings = this.config.rings;
    const stepInfo = stepPositions(startPositions, rotorIds);
    const pos = stepInfo.positions;
    const offset = pos.map((p, i) => mod26(p - rings[i]));

    const trace = wantTrace ? [] : null;
    const record = (entry) => {
      if (trace) trace.push(entry);
    };

    let c = inputIndex;
    record({ kind: 'key', label: 'Keyboard', input: L(c), output: L(c), note: `Key ${L(c)} is pressed` });

    // Plugboard, entry side.
    let next = this._plug[c];
    record({
      kind: 'plugboard',
      direction: 'in',
      label: 'Plugboard',
      input: L(c),
      output: L(next),
      note: next === c ? `${L(c)} is not plugged` : `Cable ${L(c)}↔${L(next)}`,
    });
    c = next;

    // Rotors, right → middle → left (forward), then the reflector.
    for (const slot of [2, 1, 0]) {
      const rotorTable = this._rotors[slot].forward;
      const core = mod26(c + offset[slot]);
      const coreOut = rotorTable[core];
      next = mod26(coreOut - offset[slot]);
      record({
        kind: 'rotor',
        direction: 'forward',
        slot,
        label: `${SLOT_NAMES[slot][0].toUpperCase()}${SLOT_NAMES[slot].slice(1)} rotor ${rotorIds[slot]}`,
        input: L(c),
        output: L(next),
        note: `window ${L(pos[slot])}, ring ${ringLabel(rings[slot])}, offset +${offset[slot]}`,
        core: `${L(core)}→${L(coreOut)}`,
      });
      c = next;
    }

    next = this._reflector[c];
    record({
      kind: 'reflector',
      label: `Reflector ${this.config.reflector}`,
      input: L(c),
      output: L(next),
      note: `${L(c)} is wired to ${L(next)} and sent back`,
    });
    c = next;

    // Rotors, left → middle → right (return path, through the inverse wiring).
    for (const slot of [0, 1, 2]) {
      const rotorTable = this._rotors[slot].inverse;
      const core = mod26(c + offset[slot]);
      const coreOut = rotorTable[core];
      next = mod26(coreOut - offset[slot]);
      record({
        kind: 'rotor',
        direction: 'return',
        slot,
        label: `${SLOT_NAMES[slot][0].toUpperCase()}${SLOT_NAMES[slot].slice(1)} rotor ${rotorIds[slot]}`,
        input: L(c),
        output: L(next),
        note: `window ${L(pos[slot])}, ring ${ringLabel(rings[slot])}, offset +${offset[slot]}`,
        core: `${L(core)}→${L(coreOut)}`,
      });
      c = next;
    }

    // Plugboard, exit side, then the lamp.
    next = this._plug[c];
    record({
      kind: 'plugboard',
      direction: 'out',
      label: 'Plugboard',
      input: L(c),
      output: L(next),
      note: next === c ? `${L(c)} is not plugged` : `Cable ${L(c)}↔${L(next)}`,
    });
    c = next;
    record({ kind: 'lamp', label: 'Lampboard', input: L(c), output: L(c), note: `Lamp ${L(c)} lights` });

    return {
      input: L(inputIndex),
      output: L(c),
      before: [...startPositions],
      after: pos,
      step: stepInfo,
      trace,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Key space                                                           */
/* ------------------------------------------------------------------ */

const factorial = (n) => (n <= 1n ? 1n : n * factorial(n - 1n));

/**
 * Number of distinct keys for the machine as simulated, as BigInt factors.
 * The left ring setting is redundant (it only shifts the left rotor's start
 * offset), so only 26 × 26 ring settings are distinct.
 */
export function keySpace(maxPlugs = MAX_PLUGS) {
  const k = BigInt(maxPlugs);
  const rotorOrders = 5n * 4n * 3n;
  const startPositions = 26n ** 3n;
  const ringSettings = 26n ** 2n;
  const plugboard = factorial(26n) / (factorial(26n - 2n * k) * factorial(k) * 2n ** k);
  return {
    rotorOrders,
    startPositions,
    ringSettings,
    plugboard,
    total: rotorOrders * startPositions * ringSettings * plugboard,
  };
}
