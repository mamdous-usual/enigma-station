/**
 * The interactive machine: rotor windows, lampboard, keyboard, guided example and tape.
 */

import { KEYBOARD_ROWS, ROTORS, SLOT_NAMES } from '../core/data.js';
import { indexLetter, isNotch, mod26, ringLabel } from '../core/enigma.js';
import { groupLetters } from '../core/text.js';
import { copyText } from '../utils/clipboard.js';
import { el, isEditable } from './dom.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function createMachineView(store, { notify, announce, isActive }) {
  let held = null; // letter of the physical or pointer key currently down
  let lit = null; // letter whose lamp is on

  /* ---------- static parts ---------- */

  const reflectorPlate = el('div', { class: 'reflector-plate' });
  const windows = el('div', { class: 'rotor-windows', role: 'group', 'aria-label': 'Rotor windows' });

  const lamps = new Map();
  const lampboard = el(
    'div',
    { class: 'lampboard', 'aria-hidden': 'true' },
    KEYBOARD_ROWS.map((row) =>
      el(
        'div',
        { class: 'board-row' },
        [...row].map((letter) => {
          const lamp = el('div', { class: 'lamp' }, letter);
          lamps.set(letter, lamp);
          return lamp;
        }),
      ),
    ),
  );

  const keys = new Map();
  const keyboard = el(
    'div',
    { class: 'keyboard', role: 'group', 'aria-label': 'Keyboard. Press a key to encrypt a letter.' },
    KEYBOARD_ROWS.map((row) =>
      el(
        'div',
        { class: 'board-row' },
        [...row].map((letter) => {
          const key = el(
            'button',
            { type: 'button', class: 'key', 'aria-label': `Key ${letter}`, 'data-letter': letter },
            letter,
          );
          keys.set(letter, key);
          return key;
        }),
      ),
    ),
  );

  const guideBox = el('div', { class: 'guide', hidden: true });
  const inputRow = el('div', { class: 'tape-text', 'aria-label': 'Letters typed' });
  const outputRow = el('div', { class: 'tape-text out', 'aria-label': 'Letters lit' });
  const tapeCount = el('span', { class: 'muted' });

  const undoButton = el('button', { type: 'button', class: 'btn', onclick: () => undo() }, 'Undo last letter');
  const resetButton = el(
    'button',
    { type: 'button', class: 'btn', onclick: () => reset() },
    'Reset rotors & clear tape',
  );
  const copyButton = el('button', { type: 'button', class: 'btn', onclick: () => copyOutput() }, 'Copy output');

  const tape = el(
    'section',
    { class: 'tape', 'aria-label': 'Tape' },
    el('div', { class: 'tape-head' }, el('h3', {}, 'Tape'), tapeCount),
    el('div', { class: 'tape-line' }, el('span', { class: 'tape-tag' }, 'IN'), inputRow),
    el('div', { class: 'tape-line' }, el('span', { class: 'tape-tag' }, 'OUT'), outputRow),
    el('div', { class: 'btn-row' }, undoButton, resetButton, copyButton),
  );

  const root = el(
    'div',
    { class: 'machine' },
    el('p', { class: 'hint' }, 'Type on your keyboard or click the keys. Backspace undoes the last letter.'),
    el('div', { class: 'front-panel' }, reflectorPlate, windows, lampboard, keyboard),
    guideBox,
    tape,
  );

  /* ---------- actions ---------- */

  function setLamp(letter) {
    lit = letter;
    for (const [l, lamp] of lamps) lamp.classList.toggle('lit', l === letter);
  }

  function startPress(letter, { sticky = false } = {}) {
    if (held) return;
    const result = store.press(letter);
    setLamp(result.output);
    announce(`${result.input} pressed. Lamp ${result.output} lights.`);
    if (!sticky) {
      held = letter;
      keys.get(letter)?.classList.add('down');
    }
  }

  function endPress() {
    if (held) keys.get(held)?.classList.remove('down');
    held = null;
    if (lit !== null) setLamp(null);
  }

  function undo() {
    endPress();
    if (store.undo()) announce('Last letter removed.');
  }

  function reset() {
    endPress();
    store.resetMachine();
    announce('Rotors returned to the start position and the tape cleared.');
  }

  async function copyOutput() {
    const text = groupLetters(store.tape.map((t) => t.output).join(''));
    if (text === '') {
      notify('There is nothing to copy yet.', 'warn');
      return;
    }
    notify((await copyText(text)) ? 'Output copied.' : 'Copying was blocked by the browser. Select the text and copy it.', 'info');
  }

  function nudge(slot, direction) {
    endPress();
    // The window letters become the new start position, so this begins a new message.
    const result = store.update((draft) => {
      draft.positions = [...store.machine.positions];
      draft.positions[slot] = mod26(draft.positions[slot] + direction);
    });
    if (!result.ok) notify(result.problems.join(' '), 'error');
  }

  /* ---------- rendering ---------- */

  function renderPlate() {
    reflectorPlate.textContent = `Reflector ${store.config.reflector}`;
  }

  function renderWindows() {
    const { config, machine, lastPress } = store;
    windows.replaceChildren(
      ...[0, 1, 2].map((slot) => {
        const id = config.rotors[slot];
        const letter = indexLetter(machine.positions[slot]);
        const name = cap(SLOT_NAMES[slot]);
        const moved = lastPress?.step.stepped[slot];
        const atNotch = isNotch(id, machine.positions[slot]);
        return el(
          'div',
          { class: `rotor${moved ? ' moved' : ''}` },
          el(
            'button',
            {
              type: 'button',
              class: 'nudge',
              'aria-label': `Turn the ${SLOT_NAMES[slot]} rotor forward one letter`,
              onclick: () => nudge(slot, 1),
            },
            '▲',
          ),
          el('div', { class: 'window', role: 'img', 'aria-label': `${name} rotor ${id} shows ${letter}` }, letter),
          el(
            'button',
            {
              type: 'button',
              class: 'nudge',
              'aria-label': `Turn the ${SLOT_NAMES[slot]} rotor back one letter`,
              onclick: () => nudge(slot, -1),
            },
            '▼',
          ),
          el('div', { class: 'rotor-name' }, `${name} · ${id}`),
          el('div', { class: 'rotor-meta' }, `Ring ${ringLabel(config.rings[slot])}`),
          el(
            'div',
            { class: `notch${atNotch ? ' on' : ''}` },
            atNotch ? `At notch ${ROTORS[id].notches}` : `Notch ${ROTORS[id].notches}`,
          ),
        );
      }),
    );
  }

  function renderGuide() {
    const guide = store.guide;
    if (!guide) {
      guideBox.hidden = true;
      guideBox.replaceChildren();
      return;
    }
    const next = store.guideNext();
    const done = store.tape.length >= guide.letters.length;
    const onTrack = next !== null || done;
    const letters = [...guide.letters].map((letter, i) => {
      const cls = i < store.tape.length && onTrack ? 'done' : i === store.tape.length && next ? 'next' : '';
      return el('span', { class: `g ${cls}` }, letter);
    });
    const visible = letters.length > 60 ? letters.slice(Math.max(0, store.tape.length - 10), store.tape.length + 40) : letters;
    guideBox.hidden = false;
    guideBox.replaceChildren(
      el('div', { class: 'guide-head' }, el('h3', {}, 'Example message'), el('span', { class: 'muted' }, `${guide.letters.length} letters`)),
      el(
        'div',
        { class: 'guide-letters', 'aria-label': 'Example message letters' },
        visible,
        letters.length > visible.length ? '…' : '',
      ),
      el(
        'p',
        { class: 'muted small' },
        done
          ? 'Example finished. Reset the rotors to run it again.'
          : onTrack
            ? `Next letter: ${next}`
            : 'The tape no longer follows the example. Reset the rotors to start it over.',
      ),
      el(
        'div',
        { class: 'btn-row' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            disabled: next === null,
            onclick: () => next && startPress(next, { sticky: true }),
          },
          'Press next letter',
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            disabled: next === null,
            onclick: () => {
              if (next === null) return;
              endPress();
              store.pressMany(guide.letters.slice(store.tape.length));
              announce('Example message typed.');
            },
          },
          'Press all',
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: () => {
              store.guide = null;
              renderGuide();
            },
          },
          'Dismiss',
        ),
      ),
    );
  }

  function renderTape() {
    const inputs = store.tape.map((t) => t.input).join('');
    const outputs = store.tape.map((t) => t.output).join('');
    inputRow.textContent = groupLetters(inputs) || '—';
    outputRow.textContent = groupLetters(outputs) || '—';
    tapeCount.textContent = `${store.tape.length} letter${store.tape.length === 1 ? '' : 's'}`;
    undoButton.disabled = store.tape.length === 0;
    copyButton.disabled = store.tape.length === 0;
    resetButton.disabled = store.tape.length === 0 && store.machine.positions.join() === store.config.positions.join();
  }

  function render() {
    renderPlate();
    renderWindows();
    renderGuide();
    renderTape();
  }

  store.subscribe((_, reason) => {
    if (reason === 'config' || reason === 'reset' || reason === 'undo') {
      held = null;
      for (const key of keys.values()) key.classList.remove('down');
      setLamp(null);
    }
    if (reason !== 'message') render();
  });
  render();

  /* ---------- input ---------- */

  for (const [letter, key] of keys) {
    key.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      startPress(letter);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) key.addEventListener(type, endPress);
    // Activation from the keyboard (Enter/Space on a focused key) arrives as a click with detail 0.
    key.addEventListener('click', (event) => {
      if (event.detail !== 0) return;
      startPress(letter);
      endPress();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (!isActive() || event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      undo();
      return;
    }
    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      if (!event.repeat) startPress(event.key.toUpperCase());
    }
  });
  document.addEventListener('keyup', (event) => {
    if (held && event.key.toUpperCase() === held) endPress();
  });
  window.addEventListener('blur', endPress);

  return { element: root };
}
