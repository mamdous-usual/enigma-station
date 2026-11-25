/**
 * Enigma Station entry point: builds the interface and wires the views to the store.
 */

import { DEFAULT_CONFIG, configFromHash, configToString, parseConfigString } from './core/config.js';
import { ConfigError } from './core/enigma.js';
import { el } from './ui/dom.js';
import { createInspectorView } from './ui/inspector.js';
import { createLearnView } from './ui/learn.js';
import { createMachineView } from './ui/machine.js';
import { createMessageView } from './ui/message.js';
import { createPlugboardView } from './ui/plugboard.js';
import { createSettingsView } from './ui/settings.js';
import { Store } from './ui/store.js';
import { loadPref, savePref } from './utils/storage.js';

const app = document.getElementById('app');
const store = new Store(DEFAULT_CONFIG);

/* ---------- notices ---------- */

const status = el('div', { id: 'status', class: 'status', role: 'status', 'aria-live': 'polite' });
const liveRegion = el('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
let statusTimer = null;

function notify(message, kind = 'info') {
  clearTimeout(statusTimer);
  status.className = `status ${kind}`;
  status.textContent = message;
  statusTimer = setTimeout(() => {
    status.className = 'status';
    status.textContent = '';
  }, kind === 'error' ? 12000 : 6000);
}

const announce = (text) => {
  liveRegion.textContent = text;
};

/* ---------- tabs ---------- */

const TABS = [
  { id: 'machine', label: 'Machine' },
  { id: 'message', label: 'Message' },
  { id: 'learn', label: 'How it works' },
];
let activeTab = 'machine';
const isActive = () => activeTab === 'machine';

const machine = createMachineView(store, { notify, announce, isActive });
const message = createMessageView(store, { notify });
const inspector = createInspectorView(store);
const learn = createLearnView();
const settings = createSettingsView(store, { notify });
const plugboard = createPlugboardView(store, { notify });

const panels = {
  machine: el('div', { class: 'stack' }, machine.element, inspector.element),
  message: el('div', { class: 'stack' }, el('section', { class: 'card' }, message.element)),
  learn: learn.element,
};

const tabButtons = new Map();
const tabList = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Views' });
const panelHost = el('div', { class: 'panel-host' });

function selectTab(id, { focus = false } = {}) {
  activeTab = id;
  for (const [tabId, button] of tabButtons) {
    const on = tabId === id;
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
    if (on && focus) button.focus();
  }
  panelHost.replaceChildren(panels[id]);
  panelHost.setAttribute('aria-labelledby', `tab-${id}`);
  // Settings and plugboard matter for the first two views only.
  aside.hidden = id === 'learn';
  layout.classList.toggle('wide', id === 'learn');
}

for (const [index, tab] of TABS.entries()) {
  const button = el(
    'button',
    {
      type: 'button',
      role: 'tab',
      id: `tab-${tab.id}`,
      class: 'tab',
      'aria-controls': 'panel',
      onclick: () => selectTab(tab.id),
      onkeydown: (event) => {
        const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (move) {
          event.preventDefault();
          selectTab(TABS[(index + move + TABS.length) % TABS.length].id, { focus: true });
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          selectTab(TABS[event.key === 'Home' ? 0 : TABS.length - 1].id, { focus: true });
        }
      },
    },
    tab.label,
  );
  tabButtons.set(tab.id, button);
  tabList.append(button);
}
panelHost.id = 'panel';
panelHost.setAttribute('role', 'tabpanel');

const aside = el('aside', { class: 'side', 'aria-label': 'Machine settings' }, settings.element, plugboard.element);
const layout = el('div', { class: 'layout' }, el('div', { class: 'primary' }, tabList, panelHost), aside);

app.replaceChildren(status, liveRegion, layout);
selectTab('machine');

/* ---------- theme (dark by default, remembered) ---------- */

const themeButton = document.getElementById('theme-toggle');

function applyTheme(theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeButton.textContent = theme === 'light' ? 'Dark theme' : 'Light theme';
  themeButton.setAttribute('aria-pressed', String(theme === 'light'));
}

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  savePref('theme', next);
});

/* ---------- remembered settings ---------- */

// Restore the last used machine settings, if any (a share link, applied below, takes priority).
const savedSettings = loadPref('config');
if (savedSettings) {
  try {
    store.setConfig(parseConfigString(savedSettings));
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err; // unreadable saved text: ignore it and keep the defaults
  }
}
store.subscribe((state, reason) => {
  if (reason === 'config') savePref('config', configToString(state.config));
});

/* ---------- settings from a share link ---------- */

function applyHash() {
  try {
    const config = configFromHash(window.location.hash);
    if (config) {
      store.setConfig(config);
      notify('Settings loaded from the link.', 'info');
    }
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    notify(`The link's settings could not be used: ${err.problems.join(' ')}`, 'error');
  }
}

window.addEventListener('hashchange', applyHash);
applyHash();
