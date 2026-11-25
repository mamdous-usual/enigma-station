/**
 * "How it works" page: explanations that match what the engine actually does.
 */

import { ROTORS, ROTOR_IDS } from '../core/data.js';
import { indexLetter, isNotch, keySpace, positionsToString, stepPositions } from '../core/enigma.js';
import { el } from './dom.js';
import { describeStepping } from './inspector.js';

const fmt = (big) => big.toLocaleString('en-US');


/** Small interactive demonstration of stepping, using the engine's real stepping function. */
function createStepDemo() {
  const rotors = ['I', 'II', 'III'];
  const startPositions = [0, 3, 20]; // A D U
  const names = ['Left', 'Middle', 'Right'];
  let positions = [...startPositions];
  let last = null; // description of the most recent step
  let moved = [false, false, false];
  const log = [positionsToString(positions)];

  const windows = el('div', { class: 'rotor-windows', role: 'group', 'aria-label': 'Demonstration rotor windows' });
  const note = el('ul', { class: 'step-notes', 'aria-live': 'polite' });
  const history = el('p', { class: 'mono demo-log', 'aria-label': 'Window letters after each step' });
  const stepButton = el('button', { type: 'button', class: 'btn primary', onclick: () => step() }, 'Step (press a key)');
  const resetButton = el('button', { type: 'button', class: 'btn', onclick: () => reset() }, 'Reset to ADU');

  function render() {
    windows.replaceChildren(
      ...[0, 1, 2].map((slot) => {
        const at = isNotch(rotors[slot], positions[slot]);
        return el(
          'div',
          { class: `rotor${moved[slot] ? ' moved' : ''}` },
          el('div', { class: 'window', role: 'img', 'aria-label': `${names[slot]} rotor shows ${indexLetter(positions[slot])}` }, indexLetter(positions[slot])),
          el('div', { class: 'rotor-name' }, `${names[slot]} · ${rotors[slot]}`),
          el('div', { class: `notch${at ? ' on' : ''}` }, at ? `At notch ${ROTORS[rotors[slot]].notches}` : `Notch ${ROTORS[rotors[slot]].notches}`),
        );
      }),
    );
    note.replaceChildren(
      ...(last
        ? last.map((line) => el('li', {}, line))
        : [el('li', {}, 'The middle rotor II is one step before its notch (E) and the right rotor III is one step before its notch (V). Press Step to watch what happens.')]),
    );
    history.textContent = log.slice(-8).join('  →  ');
  }

  function step() {
    const info = stepPositions(positions, rotors);
    last = describeStepping({ step: info, before: positions, after: info.positions }, rotors);
    moved = info.stepped;
    positions = info.positions;
    log.push(positionsToString(positions));
    render();
  }

  function reset() {
    positions = [...startPositions];
    last = null;
    moved = [false, false, false];
    log.length = 0;
    log.push(positionsToString(positions));
    render();
  }

  render();
  return el(
    'div',
    { class: 'demo' },
    el('h3', {}, 'Try it: the double step'),
    windows,
    note,
    history,
    el('div', { class: 'btn-row' }, stepButton, resetButton),
  );
}

export function createLearnView() {
  const keys = keySpace();
  const notchTable = el(
    'table',
    { class: 'notch-table' },
    el('caption', {}, 'Rotors of the Enigma I and where each one carries'),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Rotor'), el('th', { scope: 'col' }, 'Wiring (A→…)'), el('th', { scope: 'col' }, 'Notch'), el('th', { scope: 'col' }, 'Turnover'))),
    el(
      'tbody',
      {},
      ROTOR_IDS.map((id) =>
        el(
          'tr',
          {},
          el('th', { scope: 'row' }, id),
          el('td', { class: 'mono' }, ROTORS[id].wiring),
          el('td', {}, ROTORS[id].notches),
          el('td', {}, ROTORS[id].turnover),
        ),
      ),
    ),
  );

  const section = (title, ...body) => el('section', { class: 'card prose' }, el('h2', {}, title), ...body);

  return {
    element: el(
      'div',
      { class: 'learn' },
      section(
        'What this is',
        el('p', {}, 'Enigma was a family of electromechanical cipher machines used by Germany before and during the Second World War. This page simulates the Enigma I, the three-rotor machine of the German Army and Air Force. You pick three of five rotors, a reflector, ring settings, start letters and up to ten plugboard cables, then type.'),
        el('p', {}, 'Enigma is reciprocal: with identical settings, typing the ciphertext gives back the plaintext. Use the Message tab to see it, and the Example "Barbarossa message" to decrypt a historical-style message into German.'),
      ),
      section(
        'A short history',
        el('p', {}, 'Enigma was invented by the German engineer Arthur Scherbius, who patented a rotor cipher machine in 1918 and sold commercial versions in the 1920s. The German armed forces adopted developed versions in the late 1920s, and the Army and Air Force machine simulated here, the Enigma I with its plugboard, was in wide military use through the Second World War. It was built to protect radio messages: anyone can listen to a radio signal, so the text had to be unreadable to everyone but the intended recipient.'),
        el('p', {}, 'Because the machine is reciprocal, the recipient does not need a special decryption mode. They set up an identical machine and type the ciphertext. That makes the settings, not the machine, the real secret. Operators received printed key sheets listing the rotor order, ring settings and plugboard for each period, and every station on a network had to use exactly the same ones. One wrong rotor or one missing cable and the message came out as nonsense.'),
        el('p', {}, 'That is why sharing configurations mattered, and why it was also the weak point: the key sheets had to be distributed to every unit, so captured sheets, careless operators and repeated habits gave codebreakers openings. Polish mathematicians broke the German Army Enigma in the early 1930s and passed their methods to Britain and France in 1939, and the work at Bletchley Park built on them. The Settings text and share link in this app serve the same purpose, in a safer setting: anyone with the same settings reproduces the same cipher.'),
      ),
      section(
        'The path of the current',
        el('p', {}, 'Each key press first turns the rotors, then sends a current through the machine:'),
        el(
          'ol',
          {},
          el('li', {}, 'Keyboard to the plugboard, which swaps the letter if a cable is plugged in.'),
          el('li', {}, 'Through the right, middle and left rotors, each scrambling the letter with its own wiring.'),
          el('li', {}, 'Into the reflector, which sends the current back along a different path.'),
          el('li', {}, 'Back through the left, middle and right rotors (the same wirings, run in reverse).'),
          el('li', {}, 'Through the plugboard a second time, then to the lamp that lights.'),
        ),
        el('p', {}, 'Because the reflector pairs letters up, a letter can never be encrypted to itself. This was a weakness codebreakers exploited. It also makes the machine reciprocal.'),
      ),
      section(
        'Stepping and the double step',
        el('p', {}, 'The right rotor moves one letter on every key press. A rotor carries the next one with it when the letter showing in its window is its notch letter. The rules the simulator uses, applied before each letter is encrypted:'),
        el(
          'ul',
          {},
          el('li', {}, 'The right rotor always steps.'),
          el('li', {}, 'The middle rotor steps if the right rotor is on its notch, or if the middle rotor itself is on its notch.'),
          el('li', {}, 'The left rotor steps only if the middle rotor is on its notch.'),
        ),
        el('p', {}, 'The second clause of the middle-rotor rule is the double step: a rotor sitting on its notch is pushed along with its left neighbour on the next key press, so the middle rotor moves on two key presses in a row. With rotors I-II-III the windows read ADU, ADV, AEW, BFX, BFY. Load the "Double step" example and press the letters one at a time to watch it.'),
        el('p', {}, 'Notches are cut into the lettered ring, so ring settings never change when rotors step. The notch is therefore tied to the window letter, not to the wiring.'),
        createStepDemo(),
        notchTable,
      ),
      section(
        'Ring settings',
        el('p', {}, 'The ring (Ringstellung) is the lettered band that can be rotated relative to the wiring core. With ring setting 01 (A) the window letter and the core position agree. A ring setting of 02 (B) shifts the wiring one place against the lettering, so the same window letters give a different cipher. Stepping follows the lettering, so the ring setting moves the notch relative to the wiring too.'),
        el('p', {}, 'The left ring setting does not change the cipher on its own, because the left rotor steps too rarely to reveal it (shifting it and the left start letter together gives the same output). The simulator still lets you set it, since key sheets list all three.'),
      ),
      section(
        'The plugboard',
        el('p', {}, 'Each cable swaps two letters, on the way in and again on the way out. Ten cables swap twenty letters and leave six alone. It multiplies the number of keys enormously while adding no mechanical complexity.'),
      ),
      section(
        'How many keys?',
        el(
          'ul',
          {},
          el('li', {}, `Rotor order: 5 × 4 × 3 = ${keys.rotorOrders} ways.`),
          el('li', {}, `Start letters: 26³ = ${fmt(keys.startPositions)}.`),
          el('li', {}, `Ring settings: 26² = ${fmt(keys.ringSettings)} distinct settings (the left one is redundant).`),
          el('li', {}, `Plugboard with ten cables: ${fmt(keys.plugboard)} ways.`),
        ),
        el('p', {}, `Multiplied together that is about ${(Number(keys.total / 10n ** 20n) / 1000).toFixed(2)} × 10²³ keys. Leave out the ring settings and you get the often-quoted 1.59 × 10²⁰. In practice the real security was weaker, because operator habits and the no-self-encryption property gave codebreakers an opening.`),
      ),
      section(
        'What this simulator leaves out',
        el(
          'ul',
          {},
          el('li', {}, 'Only the Enigma I is modelled: rotors I to V and reflectors A, B and C. The naval M3 and M4 machines (rotors VI to VIII, the thin Beta and Gamma rotors) and the Abwehr, commercial and Swiss machines are not included.'),
          el('li', {}, 'Letters only. The real machine had no digits or punctuation, so this tool passes them through unchanged instead of spelling them out.'),
          el('li', {}, 'It is a learning tool, not a way to protect secrets: Enigma has been broken for decades and this code makes no attempt at modern security.'),
        ),
        el('p', {}, 'Correctness is checked against 61 vectors produced by an independent implementation, including stepping edge cases, and against a message that decrypts to German.'),
      ),
    ),
  };
}
