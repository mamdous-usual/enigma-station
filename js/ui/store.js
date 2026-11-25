/**
 * Application state shared by all views. Views subscribe and re-render;
 * only the store mutates the machine.
 *
 * Rule: changing the configuration always starts a new message (the tape is
 * cleared and the machine returns to the configured start positions), because
 * a tape recorded under different settings would no longer be reproducible.
 */

import { ConfigError, Enigma, cloneConfig, createConfig } from '../core/enigma.js';
import { lettersOnly } from '../core/text.js';

export class Store {
  constructor(config) {
    this.listeners = new Set();
    this.message = '';
    this.guide = null; // { letters: 'AAAA' } while an example message is being walked through
    this._install(config);
  }

  _install(config) {
    this.config = createConfig(config);
    this.machine = new Enigma(this.config);
    this.tape = []; // [{ input, output }]
    this.lastPress = null; // result of the most recent key press, with trace
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason) {
    for (const fn of [...this.listeners]) fn(this, reason);
  }

  /** Replaces the configuration (validated). Throws ConfigError; the state is untouched if it does. */
  setConfig(config, { guide = null, message } = {}) {
    this._install(config);
    this.guide = guide;
    if (message !== undefined) this.message = message;
    this.emit('config');
  }

  /**
   * Edits a copy of the current configuration. Never throws:
   * returns { ok: true } or { ok: false, problems: [...] }.
   */
  update(edit) {
    const draft = cloneConfig(this.config);
    try {
      edit(draft);
      this.setConfig(draft, { guide: this.guide });
      return { ok: true };
    } catch (err) {
      if (err instanceof ConfigError) return { ok: false, problems: err.problems };
      throw err;
    }
  }

  loadExample(example) {
    this.setConfig(example.config, {
      guide: { letters: lettersOnly(example.message) },
      message: example.message,
    });
  }

  setMessage(text) {
    this.message = String(text ?? '');
    this.emit('message');
  }

  press(letter) {
    const result = this.machine.press(letter, { trace: true });
    this.tape.push({ input: result.input, output: result.output });
    this.lastPress = result;
    this.emit('press');
    return result;
  }

  /** Presses several keys, notifying listeners once. */
  pressMany(letters) {
    const list = [...letters];
    if (list.length === 0) return;
    for (const [i, letter] of list.entries()) {
      const last = i === list.length - 1;
      const result = this.machine.press(letter, { trace: last });
      this.tape.push({ input: result.input, output: result.output });
      if (last) this.lastPress = result;
    }
    this.emit('press');
  }

  /** Removes the last letter by replaying the tape from the start positions. */
  undo() {
    if (this.tape.length === 0) return false;
    const kept = this.tape.slice(0, -1);
    this.machine = new Enigma(this.config);
    this.tape = [];
    this.lastPress = null;
    kept.forEach((entry, i) => {
      const last = i === kept.length - 1;
      const result = this.machine.press(entry.input, { trace: last });
      this.tape.push({ input: result.input, output: result.output });
      if (last) this.lastPress = result;
    });
    this.emit('undo');
    return true;
  }

  /** Back to the start positions with an empty tape. */
  resetMachine() {
    this.machine.reset();
    this.tape = [];
    this.lastPress = null;
    this.emit('reset');
  }

  /** The next letter of the guided example, if the tape still follows it exactly. */
  guideNext() {
    if (!this.guide) return null;
    const { letters } = this.guide;
    if (this.tape.length >= letters.length) return null;
    const onTrack = this.tape.every((entry, i) => entry.input === letters[i]);
    return onTrack ? letters[this.tape.length] : null;
  }
}
