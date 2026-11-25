/**
 * Tiny DOM helpers. Text is always inserted as text nodes (never as HTML),
 * so nothing a user types can be interpreted as markup.
 */

/**
 * el('button', { class: 'x', type: 'button', onclick: fn, disabled: true }, 'Label', childNode)
 * Props with `false`, `null` or `undefined` are skipped; `true` sets a bare attribute.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

/** Builds a <select> with the given [value, label] options and a selected value. */
export function selectEl({ id, label, options, value, onChange, className = '' }) {
  const select = el(
    'select',
    { id, class: className, 'aria-label': label },
    options.map(([v, text]) => el('option', { value: String(v) }, text)),
  );
  select.value = String(value);
  if (onChange) select.addEventListener('change', () => onChange(select.value));
  return select;
}

/** True when keyboard focus is somewhere the user is typing text or choosing from a list. */
export function isEditable(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}
