/**
 * Safe wrappers around localStorage. Storage can be missing, full, or blocked
 * (private windows, strict privacy settings), so every call is guarded and the
 * app works the same without it.
 */

const PREFIX = 'enigma-station:';

export function loadPref(key) {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function savePref(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export function clearPref(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // nothing to do
  }
}
