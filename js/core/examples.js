/**
 * Ready-to-load example configurations (with a sample message each).
 * Every entry goes through createConfig(), so an invalid example fails loudly at load time.
 */

import { createConfig } from './enigma.js';

const pos = (letters) => [...letters].map((ch) => ch.charCodeAt(0) - 65);
const pairs = (text) => text.split(' ').map((p) => [p[0], p[1]]);

export const EXAMPLES = Object.freeze([
  {
    id: 'quickstart',
    title: 'Quick start: rotors I·II·III, no plugboard',
    description:
      'Reflector B, ring settings 01-01-01, start AAA, no cables. Five As come out as B D Z G O, a widely used check for any Enigma I simulation. Notice that A never lights lamp A.',
    config: createConfig({
      rotors: ['I', 'II', 'III'],
      reflector: 'B',
      rings: [0, 0, 0],
      positions: pos('AAA'),
      plugboard: [],
    }),
    message: 'AAAAA',
  },
  {
    id: 'doublestep',
    title: 'Double step: watch the middle rotor move twice',
    description:
      'Start ADU on rotors I·II·III: the middle rotor sits one step before its notch (E) and the right rotor one step before its notch (V). Press four keys and the windows read ADV, AEW, BFX, BFY. The middle rotor moves on two key presses in a row, and the left rotor moves with it.',
    config: createConfig({
      rotors: ['I', 'II', 'III'],
      reflector: 'B',
      rings: [0, 0, 0],
      positions: pos('ADU'),
      plugboard: [],
    }),
    message: 'AAAA',
  },
  {
    id: 'rings',
    title: 'Ring settings: same windows, different letters',
    description:
      'Identical to the quick start except for ring settings 02-02-02. The rotors, reflector and start letters are the same, yet the output is completely different: the ring setting shifts the wiring relative to the lettered ring.',
    config: createConfig({
      rotors: ['I', 'II', 'III'],
      reflector: 'B',
      rings: [1, 1, 1],
      positions: pos('AAA'),
      plugboard: [],
    }),
    message: 'AAAAA',
  },
  {
    id: 'plugboard',
    title: 'Plugboard: ten cables swap twenty letters',
    description:
      'Rotors I·II·III with ten cables. Each cable swaps two letters before the signal enters the rotors and again as it leaves them, so the plugboard multiplies the number of possible keys enormously.',
    config: createConfig({
      rotors: ['I', 'II', 'III'],
      reflector: 'B',
      rings: [0, 0, 0],
      positions: pos('AAA'),
      plugboard: pairs('PO ML IU KJ NH YT GB VF RE DC'),
    }),
    message: 'HELLO WORLD',
  },
  {
    id: 'barbarossa',
    title: 'The "Barbarossa message" (decrypts to German)',
    description:
      'Often called the Barbarossa message: a well-known German Army Enigma I message from the 1941 invasion of the Soviet Union, widely used to test simulators. Settings: rotors II·IV·V, reflector B, rings 02-21-12, start BLA, ten cables. The input is the ciphertext; the output should read as German.',
    config: createConfig({
      rotors: ['II', 'IV', 'V'],
      reflector: 'B',
      rings: [1, 20, 11],
      positions: pos('BLA'),
      plugboard: pairs('AV BS CG DL FU HZ IN KM OW RX'),
    }),
    message:
      'EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK',
  },
]);

export const findExample = (id) => EXAMPLES.find((example) => example.id === id);
