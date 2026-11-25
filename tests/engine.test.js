import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ALPHABET, ROTORS, REFLECTORS, ROTOR_IDS, MAX_PLUGS } from '../js/core/data.js';
import {
  ConfigError,
  Enigma,
  cloneConfig,
  createConfig,
  keySpace,
  letterIndex,
  positionsToString,
  stepPositions,
  validateConfig,
} from '../js/core/enigma.js';
import { encryptText } from '../js/core/text.js';
import { idx, pick, randomConfig, randomLetters, rng } from './helpers.js';

const base = (overrides = {}) => ({
  rotors: ['I', 'II', 'III'],
  reflector: 'B',
  rings: [0, 0, 0],
  positions: [0, 0, 0],
  plugboard: [],
  ...overrides,
});

const run = (config, text) => encryptText(createConfig(config), text).output;

/* ---------------- historical data ---------------- */

test('every rotor wiring is a permutation of A–Z with a single notch letter', () => {
  for (const id of ROTOR_IDS) {
    const { wiring, notches } = ROTORS[id];
    assert.equal(wiring.length, 26, `rotor ${id} length`);
    assert.equal([...wiring].sort().join(''), ALPHABET, `rotor ${id} is a permutation`);
    assert.equal(notches.length, 1);
    assert.ok(ALPHABET.includes(notches));
  }
});

test('rotors I–V carry the documented notches (Royal Flags Wave Kings Above)', () => {
  assert.deepEqual(
    ROTOR_IDS.map((id) => ROTORS[id].notches),
    ['Q', 'E', 'V', 'J', 'Z'],
  );
});

test('every reflector is an involution without fixed points (13 pairs)', () => {
  for (const [id, { wiring }] of Object.entries(REFLECTORS)) {
    assert.equal([...wiring].sort().join(''), ALPHABET, `reflector ${id} is a permutation`);
    let pairs = 0;
    for (let i = 0; i < 26; i += 1) {
      const j = letterIndex(wiring[i]);
      assert.notEqual(i, j, `reflector ${id} maps ${ALPHABET[i]} to itself`);
      assert.equal(letterIndex(wiring[j]), i, `reflector ${id} is not symmetric at ${ALPHABET[i]}`);
      if (i < j) pairs += 1;
    }
    assert.equal(pairs, 13);
  }
});

/* ---------------- known answers ---------------- */

test('Enigma I, rotors I-II-III, UKW-B, all at A: AAAAA → BDZGO', () => {
  assert.equal(run(base(), 'AAAAA'), 'BDZGO');
  assert.equal(run(base(), 'BDZGO'), 'AAAAA');
});

test('first key press is stepped before it is encrypted (hand-computed: A → B)', () => {
  const machine = new Enigma(base());
  const result = machine.press('A');
  assert.equal(result.output, 'B');
  assert.equal(positionsToString(result.before), 'AAA');
  assert.equal(positionsToString(result.after), 'AAB');
});

test('Barbarossa message decrypts to German with the documented settings', () => {
  const config = createConfig({
    rotors: ['II', 'IV', 'V'],
    reflector: 'B',
    rings: [1, 20, 11],
    positions: idx('BLA'),
    plugboard: [
      ['A', 'V'],
      ['B', 'S'],
      ['C', 'G'],
      ['D', 'L'],
      ['F', 'U'],
      ['H', 'Z'],
      ['I', 'N'],
      ['K', 'M'],
      ['O', 'W'],
      ['R', 'X'],
    ],
  });
  const cipher =
    'EDPUDNRGYSZRCXNUYTPOMRMBOFKTBZREZKMLXLVEFGUEYSIOZVEQMIKUBPMMYLKLTTDEISMDICAGYKUACTCDOMOHWXMUUIAUBSTSLRNBZSZWNRFXWFYSSXJZVIJHIDISHPRKLKAYUPADTXQSPINQMATLPIFSVKDASCTACDPBOPVHJK';
  const plain = encryptText(config, cipher).output;
  assert.ok(plain.startsWith('AUFKLXABTEILUNGXVONXKURTINOWAXKURTINOWAXNORDWESTLX'), plain);
  assert.ok(plain.endsWith('ANGRIFFXINFXRGTX'));
});

/* ---------------- stepping ---------------- */

const stepSequence = (config, start, presses) => {
  const machine = new Enigma(base({ ...config, positions: idx(start) }));
  const seen = [positionsToString(machine.positions)];
  for (let i = 0; i < presses; i += 1) {
    machine.press('A');
    seen.push(positionsToString(machine.positions));
  }
  return seen;
};

test('only the right rotor steps in ordinary operation', () => {
  assert.deepEqual(stepSequence({}, 'AAA', 3), ['AAA', 'AAB', 'AAC', 'AAD']);
});

test('the right rotor at its notch carries the middle rotor (rotor III: V→W)', () => {
  assert.deepEqual(stepSequence({}, 'AAU', 3), ['AAU', 'AAV', 'ABW', 'ABX']);
});

test('double step: ADU → ADV → AEW → BFX → BFY on rotors I-II-III', () => {
  assert.deepEqual(stepSequence({}, 'ADU', 4), ['ADU', 'ADV', 'AEW', 'BFX', 'BFY']);
});

test('when both middle and right are at their notches all three rotors step, the middle only once', () => {
  const info = stepPositions(idx('AEV'), ['I', 'II', 'III']);
  assert.deepEqual(info.stepped, [true, true, true]);
  assert.equal(positionsToString(info.positions), 'BFW');
});

test('every rotor carries at its own notch', () => {
  const expectations = { I: 'Q', II: 'E', III: 'V', IV: 'J', V: 'Z' };
  for (const [id, notch] of Object.entries(expectations)) {
    const others = ROTOR_IDS.filter((r) => r !== id).slice(0, 2);
    // Fit the rotor under test in the right slot.
    const rotors = [others[0], others[1], id];
    const atNotch = stepPositions([0, 0, letterIndex(notch)], rotors);
    assert.equal(atNotch.stepped[1], true, `${id} at ${notch} should carry`);
    const before = stepPositions([0, 0, (letterIndex(notch) + 25) % 26], rotors);
    assert.equal(before.stepped[1], false, `${id} one before ${notch} should not carry`);
  }
});

test('rotor V wraps from Z to A while carrying', () => {
  const info = stepPositions(idx('AAZ'), ['I', 'II', 'V']);
  assert.equal(positionsToString(info.positions), 'ABA');
});

test('ring settings never influence stepping', () => {
  const rand = rng(7);
  for (let i = 0; i < 20; i += 1) {
    const rotors = ['I', 'II', 'III'];
    const start = idx(randomLetters(rand, 3));
    const a = new Enigma(base({ rotors, positions: start, rings: [0, 0, 0] }));
    const b = new Enigma(base({ rotors, positions: start, rings: [3, 17, 25] }));
    for (let k = 0; k < 800; k += 1) {
      a.press('A');
      b.press('A');
      assert.deepEqual(a.positions, b.positions);
    }
  }
});

test('stepPositions does not modify its input', () => {
  const input = idx('ADU');
  const copy = [...input];
  stepPositions(input, ['I', 'II', 'III']);
  assert.deepEqual(input, copy);
});

test('the rotor positions repeat every 26 × 25 × 26 = 16,900 key presses', () => {
  const rotorOrders = [
    ['I', 'II', 'III'],
    ['V', 'IV', 'I'],
    ['III', 'V', 'II'],
  ];
  for (const rotors of rotorOrders) {
    let positions = idx('AAA');
    for (let i = 0; i < 20000; i += 1) positions = stepPositions(positions, rotors).positions;
    const anchor = [...positions];
    let period = 0;
    do {
      positions = stepPositions(positions, rotors).positions;
      period += 1;
    } while (positions.join() !== anchor.join() && period < 100000);
    assert.equal(period, 16900, `rotors ${rotors.join('-')}`);
  }
});

/* ---------------- ring settings ---------------- */

test('ring and position offset each other (first press, no carry involved)', () => {
  // Core offset is position − ring, so B/B behaves like A/A for the first key press.
  const a = run(base({ rings: [0, 0, 0], positions: idx('AAA') }), 'A');
  const b = run(base({ rings: [1, 1, 1], positions: idx('BBB') }), 'A');
  assert.equal(a, b);
});

test('the left ring setting is redundant: shifting ring and start together changes nothing', () => {
  const rand = rng(11);
  for (let i = 0; i < 25; i += 1) {
    const cfg = randomConfig(rand);
    const k = 1 + Math.floor(rand() * 25);
    const shifted = cloneConfig(cfg);
    shifted.rings[0] = (cfg.rings[0] + k) % 26;
    shifted.positions[0] = (cfg.positions[0] + k) % 26;
    const text = randomLetters(rand, 600);
    assert.equal(run(shifted, text), run(cfg, text));
  }
});

test('changing a ring setting changes the output', () => {
  assert.notEqual(run(base({ rings: [1, 1, 1] }), 'AAAAA'), run(base(), 'AAAAA'));
});

/* ---------------- plugboard & reflector properties ---------------- */

test('a cable swaps the letter before the rotors and again after them', () => {
  const plain = new Enigma(base());
  const plugged = new Enigma(base({ plugboard: [['A', 'B']] }));
  // Pressing A on the plugged machine feeds B into the rotors; the result is swapped back on exit.
  const viaRotors = plain.peek('B').output;
  const expected = { A: 'B', B: 'A' }[viaRotors] ?? viaRotors;
  assert.equal(plugged.peek('A').output, expected);
});

test('no letter is ever encrypted to itself', () => {
  const rand = rng(1940);
  for (let i = 0; i < 40; i += 1) {
    const config = createConfig(randomConfig(rand));
    const machine = new Enigma(config);
    for (let k = 0; k < 2000; k += 1) {
      const letter = ALPHABET[Math.floor(rand() * 26)];
      assert.notEqual(machine.press(letter).output, letter);
    }
  }
});

test('reciprocal: encrypting twice from the same configuration returns the message', () => {
  const rand = rng(1941);
  for (let i = 0; i < 60; i += 1) {
    const config = randomConfig(rand);
    const message = randomLetters(rand, 1 + Math.floor(rand() * 1500));
    assert.equal(run(config, run(config, message)), message);
  }
});

test('reciprocity also holds for a live machine that is reset between runs', () => {
  const machine = new Enigma(base({ plugboard: [['Q', 'W']], positions: idx('XYZ') }));
  const message = 'THEQUICKBROWNFOX';
  const cipher = [...message].map((ch) => machine.press(ch).output).join('');
  machine.reset();
  const plain = [...cipher].map((ch) => machine.press(ch).output).join('');
  assert.equal(plain, message);
  assert.notEqual(cipher, message);
});

test('reset() restores the configured start positions', () => {
  const machine = new Enigma(base({ positions: idx('KLM') }));
  machine.press('A');
  machine.press('B');
  machine.reset();
  assert.equal(positionsToString(machine.positions), 'KLM');
});

test('long messages round-trip (100,000 letters)', () => {
  const rand = rng(5);
  const config = randomConfig(rand);
  const message = randomLetters(rand, 100000);
  assert.equal(run(config, run(config, message)), message);
});

/* ---------------- tracing ---------------- */

test('a trace has 11 stages, chains input to output, and matches the real output', () => {
  const rand = rng(99);
  for (let i = 0; i < 30; i += 1) {
    const config = randomConfig(rand);
    const machine = new Enigma(config);
    for (let k = 0; k < 50; k += 1) {
      const letter = ALPHABET[Math.floor(rand() * 26)];
      const dry = machine.peek(letter, { trace: true });
      const real = machine.press(letter, { trace: true });
      assert.equal(real.trace.length, 11);
      assert.equal(real.trace[0].input, letter);
      assert.equal(real.trace.at(-1).output, real.output);
      for (let s = 1; s < real.trace.length; s += 1) {
        assert.equal(real.trace[s].input, real.trace[s - 1].output, `stage ${s} input`);
      }
      assert.deepEqual(
        real.trace.map((t) => t.kind),
        ['key', 'plugboard', 'rotor', 'rotor', 'rotor', 'reflector', 'rotor', 'rotor', 'rotor', 'plugboard', 'lamp'],
      );
      assert.equal(dry.output, real.output, 'peek predicts press');
    }
  }
});

test('peek() leaves the machine untouched and press() without trace returns no trace', () => {
  const machine = new Enigma(base());
  machine.peek('A', { trace: true });
  assert.equal(positionsToString(machine.positions), 'AAA');
  assert.equal(machine.press('A').trace, null);
});

test('trace core contacts agree with the documented rotor wirings in both directions', () => {
  const rotors = ['IV', 'II', 'V'];
  const machine = new Enigma(base({ rotors, positions: idx('QEV'), rings: [3, 9, 20] }));
  const { trace } = machine.press('H', { trace: true });
  const rotorStages = trace.filter((t) => t.kind === 'rotor');
  assert.equal(rotorStages.length, 6);
  for (const stage of rotorStages) {
    const [coreIn, coreOut] = [...stage.core].filter((ch) => ALPHABET.includes(ch));
    const { wiring } = ROTORS[rotors[stage.slot]];
    if (stage.direction === 'forward') assert.equal(wiring[letterIndex(coreIn)], coreOut);
    else assert.equal(wiring[letterIndex(coreOut)], coreIn);
  }
});

/* ---------------- validation ---------------- */

test('createConfig accepts lower-case input and sorts each cable', () => {
  const cfg = createConfig(base({ rotors: ['i', 'ii', 'iii'], reflector: 'b', plugboard: [['v', 'a']] }));
  assert.deepEqual(cfg.rotors, ['I', 'II', 'III']);
  assert.equal(cfg.reflector, 'B');
  assert.deepEqual(cfg.plugboard, [['A', 'V']]);
});

test('configurations are frozen', () => {
  const cfg = createConfig(base());
  assert.throws(() => {
    cfg.rotors[0] = 'V';
  }, TypeError);
  assert.throws(() => {
    cfg.plugboard.push(['A', 'B']);
  }, TypeError);
});

test('cloneConfig produces an editable copy', () => {
  const cfg = createConfig(base({ plugboard: [['A', 'B']] }));
  const copy = cloneConfig(cfg);
  copy.rotors[0] = 'V';
  copy.plugboard[0][1] = 'Z';
  assert.equal(cfg.rotors[0], 'I');
  assert.deepEqual(cfg.plugboard, [['A', 'B']]);
});

test('invalid configurations are rejected with clear messages', () => {
  const cases = [
    [base({ rotors: ['I', 'I', 'II'] }), /only once/],
    [base({ rotors: ['I', 'II', 'VI'] }), /Unknown rotor "VI"/],
    [base({ rotors: ['I', 'II'] }), /exactly three rotors/],
    [base({ reflector: 'D' }), /Unknown reflector/],
    [base({ rings: [0, 0, 26] }), /ring setting/],
    [base({ rings: [0, -1, 0] }), /ring setting/],
    [base({ rings: [0, 0.5, 0] }), /ring setting/],
    [base({ rings: [0, 0] }), /three ring settings/],
    [base({ positions: [0, 26, 0] }), /start position/],
    [base({ positions: ['A', 'A', 'A'] }), /start position/],
    [base({ plugboard: [['A', 'A']] }), /to itself/],
    [base({ plugboard: [['A', 'B'], ['B', 'C']] }), /more than one cable/],
    [base({ plugboard: [['A', '1']] }), /two letters/],
    [base({ plugboard: [['A']] }), /two letters/],
    [base({ plugboard: 'AB' }), /list of letter pairs/],
  ];
  for (const [config, pattern] of cases) {
    assert.throws(() => createConfig(config), (err) => err instanceof ConfigError && pattern.test(err.message), JSON.stringify(config));
  }
  assert.throws(() => createConfig(null), ConfigError);
  assert.throws(() => new Enigma(undefined), ConfigError);
});

test('more than ten cables are rejected', () => {
  const letters = [...ALPHABET];
  const plugboard = [];
  for (let i = 0; i < MAX_PLUGS + 1; i += 1) plugboard.push([letters[2 * i], letters[2 * i + 1]]);
  assert.throws(() => createConfig(base({ plugboard })), /At most 10 plugboard cables/);
  assert.deepEqual(validateConfig(base({ plugboard: plugboard.slice(0, 10) })), []);
});

test('all problems in a configuration are reported together', () => {
  try {
    createConfig(base({ rotors: ['I', 'I', 'IX'], reflector: 'Q', rings: [0, 99, 0] }));
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err instanceof ConfigError);
    assert.ok(err.problems.length >= 4, err.problems.join(' | '));
  }
});

test('press() rejects anything but a single letter', () => {
  const machine = new Enigma(base());
  for (const bad of ['ä', '1', ' ', '', 'AB', null, undefined, 5]) {
    assert.throws(() => machine.press(bad), RangeError, String(bad));
  }
  assert.equal(positionsToString(machine.positions), 'AAA', 'a rejected key must not step the rotors');
  assert.equal(machine.press('a').output, 'B', 'lower-case letters are accepted');
});

test('letterIndex', () => {
  assert.equal(letterIndex('A'), 0);
  assert.equal(letterIndex('z'), 25);
  assert.equal(letterIndex('É'), -1);
  assert.equal(letterIndex('ab'), -1);
  assert.equal(letterIndex('K'), -1, 'Kelvin sign is not K');
});

/* ---------------- key space ---------------- */

test('key space: 60 rotor orders × 26³ starts × 26² rings × 150,738,274,937,250 plugboards', () => {
  const k = keySpace();
  assert.equal(k.rotorOrders, 60n);
  assert.equal(k.startPositions, 17576n);
  assert.equal(k.ringSettings, 676n);
  assert.equal(k.plugboard, 150738274937250n);
  assert.equal(k.total, 107458687327250619360000n); // ≈ 1.07 × 10^23
  // Without ring settings this is the classic figure quoted for the army machine.
  assert.equal(k.total / k.ringSettings, 158962555217826360000n); // ≈ 1.59 × 10^20
  assert.equal(keySpace(0).plugboard, 1n);
});

test('every rotor order is distinct and all 60 orders run', () => {
  const rand = rng(3);
  const seen = new Set();
  for (const l of ROTOR_IDS) {
    for (const m of ROTOR_IDS) {
      for (const r of ROTOR_IDS) {
        if (new Set([l, m, r]).size !== 3) continue;
        seen.add([l, m, r].join('-'));
        const machine = new Enigma(base({ rotors: [l, m, r], reflector: pick(rand, ['A', 'B', 'C']) }));
        assert.match(machine.press('A').output, /^[A-Z]$/);
      }
    }
  }
  assert.equal(seen.size, 60);
});
