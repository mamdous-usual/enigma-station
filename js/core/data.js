/**
 * Historical data for the simulated machine: the Wehrmacht Enigma I.
 *
 * Wirings are given in the usual notation: the string at index i is the letter
 * that the contact at position i is wired to when the rotor sits at its
 * "A" position with ring setting 01 (A).
 *
 * Only the rotors and reflectors that were fitted to the Enigma I are included.
 * The Kriegsmarine M3/M4 rotors (VI–VIII, Beta, Gamma) are deliberately left out.
 */

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Maximum number of plugboard cables in this simulator. */
export const MAX_PLUGS = 10;

/** Rotor slots, in the order used everywhere in the code: index 0 is the left (slowest) rotor. */
export const SLOT_NAMES = Object.freeze(['left', 'middle', 'right']);

export const MODEL = Object.freeze({
  name: 'Enigma I',
  description: 'German Army (Heer) and Air Force (Luftwaffe) three-rotor machine',
});

const rotor = (id, wiring, notches, turnover) =>
  Object.freeze({ id, wiring, notches, turnover });

/**
 * `notches` lists the window letters at which the rotor carries the next rotor
 * with it. A rotor "at its notch" shows that letter in the window *before* the
 * key press; the next key press then also steps the rotor to its left.
 * (Rotor I: window shows Q, the following step moves Q→R and carries.)
 */
export const ROTORS = Object.freeze({
  I: rotor('I', 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'Q', 'Q→R'),
  II: rotor('II', 'AJDKSIRUXBLHWTMCQGZNPYFVOE', 'E', 'E→F'),
  III: rotor('III', 'BDFHJLCPRTXVZNYEIWGAKMUSQO', 'V', 'V→W'),
  IV: rotor('IV', 'ESOVPZJAYQUIRHXLNFTGKDCMWB', 'J', 'J→K'),
  V: rotor('V', 'VZBRGITYUPSDNHLXAWMJQOFECK', 'Z', 'Z→A'),
});

export const ROTOR_IDS = Object.freeze(Object.keys(ROTORS));

const reflector = (id, wiring, note) => Object.freeze({ id, wiring, note });

export const REFLECTORS = Object.freeze({
  A: reflector('A', 'EJMZALYXVBWFCRQUONTSPIKHGD', 'An early reflector, superseded by UKW-B.'),
  B: reflector('B', 'YRUHQSLDPXNGOKMIEBFZCWVJAT', 'The standard Wehrmacht reflector for most of the war.'),
  C: reflector('C', 'FVPJIAOYEDRZXWGCTKUQSBNMHL', 'An alternative reflector that saw far less use.'),
});

export const REFLECTOR_IDS = Object.freeze(Object.keys(REFLECTORS));

/** Keyboard, lampboard and plugboard share the QWERTZ layout of the Enigma I. */
export const KEYBOARD_ROWS = Object.freeze(['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML']);
