/**
 * Settings panel: rotor order, reflector, ring settings, start letters,
 * settings text, share link, examples and a random key.
 */

import { ALPHABET, REFLECTORS, REFLECTOR_IDS, ROTOR_IDS, SLOT_NAMES } from '../core/data.js';
import { ConfigError } from '../core/enigma.js';
import {
  DEFAULT_CONFIG,
  configToHash,
  configToString,
  parseConfigString,
  randomConfig,
} from '../core/config.js';
import { EXAMPLES, findExample } from '../core/examples.js';
import { copyText } from '../utils/clipboard.js';
import { el, selectEl } from './dom.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const letterOptions = [...ALPHABET].map((l, i) => [i, l]);
const ringOptions = [...ALPHABET].map((l, i) => [i, `${String(i + 1).padStart(2, '0')} (${l})`]);

export function createSettingsView(store, { notify }) {
  const rotorSelects = [];
  const ringSelects = [];
  const startSelects = [];

  const apply = (edit) => {
    const result = store.update(edit);
    if (!result.ok) notify(result.problems.join(' '), 'error');
    sync();
  };

  const field = (labelText, control, forId) =>
    el('div', { class: 'field' }, el('label', { for: forId }, labelText), control);

  /* ----- rotors, reflector, rings, start ----- */

  const rotorRow = el('div', { class: 'triple' });
  const ringRow = el('div', { class: 'triple' });
  const startRow = el('div', { class: 'triple' });

  for (let slot = 0; slot < 3; slot += 1) {
    const name = cap(SLOT_NAMES[slot]);

    const rotor = selectEl({
      id: `rotor-${slot}`,
      label: `${name} rotor`,
      options: ROTOR_IDS.map((id) => [id, id]),
      value: store.config.rotors[slot],
      onChange: (value) =>
        apply((draft) => {
          const other = draft.rotors.indexOf(value);
          // Choosing a rotor that sits in another slot swaps the two, so the choice is always valid.
          if (other >= 0 && other !== slot) draft.rotors[other] = draft.rotors[slot];
          draft.rotors[slot] = value;
        }),
    });
    rotorSelects.push(rotor);
    rotorRow.append(field(name, rotor, `rotor-${slot}`));

    const ring = selectEl({
      id: `ring-${slot}`,
      label: `${name} ring setting`,
      options: ringOptions,
      value: store.config.rings[slot],
      onChange: (value) =>
        apply((draft) => {
          draft.rings[slot] = Number(value);
        }),
    });
    ringSelects.push(ring);
    ringRow.append(field(name, ring, `ring-${slot}`));

    const start = selectEl({
      id: `start-${slot}`,
      label: `${name} start letter`,
      options: letterOptions,
      value: store.config.positions[slot],
      onChange: (value) =>
        apply((draft) => {
          draft.positions[slot] = Number(value);
        }),
    });
    startSelects.push(start);
    startRow.append(field(name, start, `start-${slot}`));
  }

  const reflectorSelect = selectEl({
    id: 'reflector',
    label: 'Reflector',
    options: REFLECTOR_IDS.map((id) => [id, `UKW-${id}`]),
    value: store.config.reflector,
    onChange: (value) =>
      apply((draft) => {
        draft.reflector = value;
      }),
  });
  const reflectorNote = el('p', { class: 'muted small' });

  /* ----- settings text, copy, link ----- */

  const textInput = el('input', {
    id: 'settings-text',
    type: 'text',
    spellcheck: 'false',
    autocomplete: 'off',
    autocapitalize: 'off',
    'aria-describedby': 'settings-error',
  });
  const textError = el('p', { id: 'settings-error', class: 'error', role: 'alert', hidden: true });

  const showTextError = (problems) => {
    textError.hidden = problems.length === 0;
    textError.textContent = problems.join(' ');
    textInput.setAttribute('aria-invalid', problems.length === 0 ? 'false' : 'true');
  };

  const textForm = el(
    'form',
    {
      class: 'text-form',
      onsubmit: (event) => {
        event.preventDefault();
        try {
          store.setConfig(parseConfigString(textInput.value), { guide: store.guide });
          showTextError([]);
          notify('Settings applied.', 'info');
        } catch (err) {
          if (!(err instanceof ConfigError)) throw err;
          showTextError(err.problems);
        }
      },
    },
    el('label', { for: 'settings-text' }, 'Settings text'),
    el('div', { class: 'inline' }, textInput, el('button', { type: 'submit', class: 'btn' }, 'Apply')),
    textError,
  );

  const copySettings = async () =>
    notify((await copyText(configToString(store.config))) ? 'Settings copied.' : 'Copying was blocked by the browser.', 'info');
  const copyLink = async () => {
    const url = window.location.href.split('#')[0] + configToHash(store.config);
    notify(
      (await copyText(url))
        ? 'Link copied. Anyone who opens it gets these settings (they travel in the part of the link after the #, which is never sent to a server).'
        : 'Copying was blocked by the browser.',
      'info',
    );
  };

  /* ----- examples ----- */

  const exampleSelect = selectEl({
    id: 'example',
    label: 'Example',
    options: EXAMPLES.map((e) => [e.id, e.title]),
    value: EXAMPLES[0].id,
    onChange: () => renderExampleNote(),
  });
  const exampleNote = el('p', { class: 'muted small' });
  const renderExampleNote = () => {
    exampleNote.textContent = findExample(exampleSelect.value).description;
  };

  /* ----- assemble ----- */

  const root = el(
    'section',
    { class: 'card settings', 'aria-labelledby': 'settings-title' },
    el('div', { class: 'card-head' }, el('h2', { id: 'settings-title' }, 'Machine settings')),
    el('p', { class: 'hint' }, 'Changing any setting starts a new message: the rotors return to the start letters and the tape is cleared.'),
    el('fieldset', {}, el('legend', {}, 'Rotors (left to right)'), rotorRow),
    el('fieldset', {}, el('legend', {}, 'Reflector'), reflectorSelect, reflectorNote),
    el('fieldset', {}, el('legend', {}, 'Ring settings (Ringstellung)'), ringRow),
    el('fieldset', {}, el('legend', {}, 'Start letters (Grundstellung)'), startRow),
    textForm,
    el(
      'div',
      { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn', onclick: copySettings }, 'Copy settings'),
      el('button', { type: 'button', class: 'btn', onclick: copyLink }, 'Copy share link'),
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            store.setConfig(randomConfig(), { guide: store.guide });
            notify('Random settings applied.', 'info');
          },
        },
        'Random key',
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            store.setConfig(DEFAULT_CONFIG);
            notify('Default settings restored.', 'info');
          },
        },
        'Default settings',
      ),
    ),
    el(
      'fieldset',
      {},
      el('legend', {}, 'Examples'),
      exampleSelect,
      exampleNote,
      el(
        'div',
        { class: 'btn-row' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            onclick: () => {
              const example = findExample(exampleSelect.value);
              store.loadExample(example);
              notify(`Loaded: ${example.title}`, 'info');
            },
          },
          'Load example',
        ),
      ),
    ),
  );

  /** Pushes the store's configuration into every control. */
  function sync() {
    const { config } = store;
    config.rotors.forEach((id, i) => {
      rotorSelects[i].value = id;
    });
    config.rings.forEach((v, i) => {
      ringSelects[i].value = String(v);
    });
    config.positions.forEach((v, i) => {
      startSelects[i].value = String(v);
    });
    reflectorSelect.value = config.reflector;
    reflectorNote.textContent = REFLECTORS[config.reflector].note;
    textInput.value = configToString(config);
    showTextError([]);
  }

  store.subscribe((_, reason) => {
    if (reason === 'config') sync();
  });
  sync();
  renderExampleNote();

  return { element: root };
}
