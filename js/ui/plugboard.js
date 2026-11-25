/**
 * Plugboard (Steckerbrett) editor.
 * Click a letter, then a second letter, to connect them with a cable.
 * Click a cabled letter (with nothing selected) to remove its cable.
 */

import { KEYBOARD_ROWS, MAX_PLUGS } from '../core/data.js';
import { el } from './dom.js';

const cableColor = (index) => `hsl(${(index * 137.5) % 360} 62% 58%)`;

export function createPlugboardView(store, { notify }) {
  let pending = null;

  const root = el('section', { class: 'card plugboard', 'aria-labelledby': 'plug-title' });

  const cableIndexOf = (letter) => store.config.plugboard.findIndex((pair) => pair.includes(letter));
  const partnerOf = (letter) => {
    const pair = store.config.plugboard[cableIndexOf(letter)];
    return pair ? pair.find((l) => l !== letter) : null;
  };

  function apply(edit, okMessage) {
    const result = store.update(edit);
    if (!result.ok) notify(result.problems.join(' '), 'error');
    else if (okMessage) notify(okMessage, 'info');
  }

  function removeCable(letter) {
    const partner = partnerOf(letter);
    apply((draft) => {
      draft.plugboard = draft.plugboard.filter((pair) => !pair.includes(letter));
    }, `Removed cable ${letter}–${partner}. The rotors are back at the start position.`);
  }

  function onLetter(letter) {
    const cable = cableIndexOf(letter);
    if (pending === null) {
      if (cable >= 0) {
        removeCable(letter);
        return;
      }
      if (store.config.plugboard.length >= MAX_PLUGS) {
        notify(`All ${MAX_PLUGS} cables are in use. Click a cabled letter to remove its cable first.`, 'warn');
        return;
      }
      pending = letter;
      render();
      return;
    }
    if (pending === letter) {
      pending = null;
      render();
      return;
    }
    if (cable >= 0) {
      notify(`${letter} is already cabled to ${partnerOf(letter)}. Remove that cable first.`, 'warn');
      return;
    }
    const first = pending;
    pending = null;
    apply((draft) => {
      draft.plugboard.push([first, letter]);
    }, `Connected ${first}–${letter}. The rotors are back at the start position.`);
    render();
  }

  function render() {
    const { plugboard } = store.config;
    const hint =
      pending === null
        ? 'Click a letter, then a second letter, to connect them with a cable. Click a cabled letter to remove its cable.'
        : `Now click the letter to connect ${pending} to (or ${pending} again to cancel).`;

    const grid = el(
      'div',
      { class: 'plug-grid' },
      KEYBOARD_ROWS.map((row) =>
        el(
          'div',
          { class: 'board-row' },
          [...row].map((letter) => {
            const cable = cableIndexOf(letter);
            const partner = cable >= 0 ? partnerOf(letter) : null;
            const classes = ['plug', cable >= 0 ? 'plugged' : '', pending === letter ? 'pending' : ''];
            return el(
              'button',
              {
                type: 'button',
                class: classes.filter(Boolean).join(' '),
                style: cable >= 0 ? `--cable:${cableColor(cable)}` : null,
                'aria-pressed': pending === letter ? 'true' : 'false',
                'aria-label': partner ? `Plug ${letter}, cabled to ${partner}` : `Plug ${letter}, not connected`,
                onclick: () => onLetter(letter),
              },
              letter,
            );
          }),
        ),
      ),
    );

    const cables = el(
      'ul',
      { class: 'cable-list', 'aria-label': 'Connected cables' },
      plugboard.length === 0
        ? el('li', { class: 'muted' }, 'No cables connected.')
        : plugboard.map((pair, i) =>
            el(
              'li',
              {},
              el(
                'button',
                {
                  type: 'button',
                  class: 'chip',
                  style: `--cable:${cableColor(i)}`,
                  'aria-label': `Remove cable ${pair[0]} to ${pair[1]}`,
                  onclick: () => removeCable(pair[0]),
                },
                `${pair[0]}–${pair[1]} `,
                el('span', { 'aria-hidden': 'true' }, '×'),
              ),
            ),
          ),
    );

    root.replaceChildren(
      el('div', { class: 'card-head' }, el('h2', { id: 'plug-title' }, 'Plugboard'), el('span', { class: 'muted' }, `${plugboard.length} / ${MAX_PLUGS} cables`)),
      el('p', { class: 'hint', 'aria-live': 'polite' }, hint),
      grid,
      cables,
      el(
        'div',
        { class: 'btn-row' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            disabled: plugboard.length === 0,
            onclick: () => {
              pending = null;
              apply((draft) => {
                draft.plugboard = [];
              }, 'All cables removed.');
            },
          },
          'Remove all cables',
        ),
      ),
    );
  }

  store.subscribe((_, reason) => {
    if (reason === 'config') pending = null;
    if (reason === 'config') render();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pending !== null) {
      pending = null;
      render();
    }
  });
  render();

  return { element: root };
}
