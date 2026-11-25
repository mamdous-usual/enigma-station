/**
 * Message mode: encrypt or decrypt a whole text at once, from the configured start letters.
 */

import { encryptText, formatOutput } from '../core/text.js';
import { copyText } from '../utils/clipboard.js';
import { el } from './dom.js';

export function createMessageView(store, { notify }) {
  let format = 'preserve';

  const input = el('textarea', {
    id: 'message-input',
    rows: '6',
    spellcheck: 'false',
    placeholder: 'Type or paste a message. Enigma encrypts and decrypts with the same settings.',
    'aria-describedby': 'message-rules',
    oninput: () => store.setMessage(input.value),
  });
  const output = el('output', { id: 'message-output', class: 'message-output', for: 'message-input' });
  const stats = el('p', { class: 'muted small', 'aria-live': 'polite' });

  const formatSelect = el(
    'select',
    {
      id: 'message-format',
      onchange: () => {
        format = formatSelect.value;
        render();
      },
    },
    el('option', { value: 'preserve' }, 'Keep spaces and punctuation'),
    el('option', { value: 'groups' }, 'Letters only, groups of five'),
  );

  const currentOutput = () => formatOutput(encryptText(store.config, store.message).output, format);

  const root = el(
    'div',
    { class: 'message' },
    el(
      'p',
      { id: 'message-rules', class: 'hint' },
      'The letters A–Z (either case) are encrypted and come out in capitals. Everything else (spaces, digits, punctuation, accented letters, emoji) passes through unchanged and does not turn the rotors. Enigma has no digits or umlauts, so operators spelled them out.',
    ),
    el('label', { for: 'message-input' }, 'Input'),
    input,
    el('div', { class: 'row-between' }, el('label', { for: 'message-format' }, 'Output format'), formatSelect),
    el('label', { for: 'message-output' }, 'Output'),
    output,
    stats,
    el(
      'div',
      { class: 'btn-row' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: async () => {
            const text = currentOutput();
            if (text === '') {
              notify('There is nothing to copy yet.', 'warn');
              return;
            }
            notify((await copyText(text)) ? 'Output copied.' : 'Copying was blocked by the browser. Select the text and copy it.', 'info');
          },
        },
        'Copy output',
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            const text = currentOutput();
            input.value = text;
            store.setMessage(text);
            notify('Output moved to the input. With the same settings it decrypts back to the original.', 'info');
          },
        },
        'Use output as input',
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            input.value = '';
            store.setMessage('');
          },
        },
        'Clear',
      ),
    ),
  );

  function render() {
    const result = encryptText(store.config, store.message);
    output.textContent = formatOutput(result.output, format);
    stats.textContent =
      store.message === ''
        ? ''
        : `${result.letters} letter${result.letters === 1 ? '' : 's'} processed, ${result.preserved} other character${result.preserved === 1 ? '' : 's'} passed through. Rotors went from ${result.startPositions} to ${result.endPositions}.`;
  }

  store.subscribe((_, reason) => {
    if (reason === 'press' || reason === 'undo' || reason === 'reset') return;
    if (input.value !== store.message) input.value = store.message;
    render();
  });
  render();

  return { element: root };
}
