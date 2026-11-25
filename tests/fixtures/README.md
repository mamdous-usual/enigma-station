# Test fixtures

`reference-vectors.json` holds 61 encryption vectors (19,005 letters) generated with
the independent [`py-enigma`](https://pypi.org/project/py-enigma/) package (v1.0.2),
not with this project's code.

Each entry has `rotors` (left→right), `reflector`, `rings` (0-based), `start` (window
letters), `plugs`, `input` and `output`.

What the vectors cover:

- the classic `AAAAA → BDZGO` check (rotors I-II-III, reflector B, all settings at A);
- 40 random machines: any rotor order, reflectors A/B/C, random ring settings, 0–10 cables,
  random start positions, messages of 40, 300 or 900 letters;
- 20 starts placed one step before a double step for every ordered pair of middle/right rotors.

py-enigma has no reflector A, so those vectors were produced by building the reflector from the
wiring string `EJMZALYXVBWFCRQUONTSPIKHGD` with py-enigma's own `Rotor` class. That checks the
machine mechanics with reflector A, while the wiring string itself is checked structurally in
`engine.test.js` (a permutation, symmetric, no fixed points).

To regenerate: build a `EnigmaMachine` per entry, call `set_display(start)`, then
`process_text(input)`. Note that py-enigma takes integer ring settings as 0-based.
