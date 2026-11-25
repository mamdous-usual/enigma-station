/**
 * Signal-path inspector: shows how the last key press travelled through the machine.
 */

import { ROTORS, SLOT_NAMES } from '../core/data.js';
import { indexLetter, positionsToString } from '../core/enigma.js';
import { el } from './dom.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Plain-language account of which rotors moved and why. */
export function describeStepping(press, rotorIds) {
  const { stepped, rightAtNotch, middleAtNotch } = press.step;
  const before = press.before;
  const lines = [`The right rotor always steps first (${indexLetter(before[2])} → ${indexLetter(press.after[2])}).`];
  if (middleAtNotch && !rightAtNotch) {
    lines.push(
      `Double step: the middle rotor ${rotorIds[1]} was sitting on its notch (${ROTORS[rotorIds[1]].notches}), so it stepped (${indexLetter(before[1])} → ${indexLetter(press.after[1])}) and pushed the left rotor with it (${indexLetter(before[0])} → ${indexLetter(press.after[0])}).`,
    );
  } else if (middleAtNotch && rightAtNotch) {
    lines.push(
      `Both notches were engaged: the middle rotor stepped once (${indexLetter(before[1])} → ${indexLetter(press.after[1])}) and the left rotor stepped (${indexLetter(before[0])} → ${indexLetter(press.after[0])}).`,
    );
  } else if (rightAtNotch) {
    lines.push(
      `The right rotor ${rotorIds[2]} was on its notch (${ROTORS[rotorIds[2]].notches}), so it carried the middle rotor (${indexLetter(before[1])} → ${indexLetter(press.after[1])}).`,
    );
  }
  if (!stepped[1] && !stepped[0]) lines.push('Only the right rotor moved this time.');
  return lines;
}

export function createInspectorView(store) {
  const root = el('section', { class: 'card inspector', 'aria-labelledby': 'inspector-title' });

  function render() {
    const press = store.lastPress;
    const title = el('h2', { id: 'inspector-title' }, 'Signal path');

    if (!press) {
      root.replaceChildren(
        el('div', { class: 'card-head' }, title),
        el('p', { class: 'hint' }, 'Press a key to see how the current travelled through the plugboard, the three rotors, the reflector and back.'),
      );
      return;
    }

    const rotorIds = store.config.rotors;
    const stages = press.trace.map((stage, i) =>
      el(
        'li',
        { class: `stage stage-${stage.kind}` },
        el('span', { class: 'stage-no', 'aria-hidden': 'true' }, String(i + 1)),
        el(
          'span',
          { class: 'stage-body' },
          el('span', { class: 'stage-label' }, stage.label, stage.direction ? el('span', { class: 'dir' }, stage.direction === 'forward' ? ' →' : stage.direction === 'return' ? ' ←' : '') : ''),
          el('span', { class: 'stage-note' }, stage.note, stage.core ? ` · core ${stage.core}` : ''),
        ),
        el(
          'span',
          { class: 'stage-io', 'aria-label': `${stage.input} becomes ${stage.output}` },
          stage.input,
          el('span', { 'aria-hidden': 'true' }, ' → '),
          stage.output,
        ),
      ),
    );

    root.replaceChildren(
      el('div', { class: 'card-head' }, title, el('span', { class: 'result' }, `${press.input} → ${press.output}`)),
      el(
        'p',
        { class: 'muted small' },
        `Windows ${positionsToString(press.before)} → ${positionsToString(press.after)} (rotors turn before the current flows).`,
      ),
      el('ul', { class: 'step-notes' }, describeStepping(press, rotorIds).map((line) => el('li', {}, line))),
      el('ol', { class: 'stages' }, stages),
      el(
        'p',
        { class: 'muted small' },
        `Rotor stages show the letter entering and leaving each rotor at the contacts. "Core" is the position inside the wiring after the ring and window offset. Slots: ${SLOT_NAMES.map((s, i) => `${cap(s)} ${rotorIds[i]}`).join(', ')}.`,
      ),
    );
  }

  store.subscribe(render);
  render();
  return { element: root };
}
