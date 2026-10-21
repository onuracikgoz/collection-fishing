// Small DOM helpers. No framework: each tab re-renders its own area.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === undefined || c === null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

let toastBox;
export function toast(msg, kind = 'info') {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts' });
    document.body.appendChild(toastBox);
  }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), kind === 'error' ? 7000 : 3500);
}

/** Runs an async action with a toast on failure; returns its result or undefined. */
export async function act(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok');
    return r;
  } catch (e) {
    console.error(e);
    toast(e.message || String(e), 'error');
    return undefined;
  }
}

export function button(label, onclick, cls = '') {
  return h('button', { class: cls, onclick }, label);
}

export function card(title, ...body) {
  return h('section', { class: 'card' }, title ? h('h3', null, title) : null, ...body);
}

export function row(...children) {
  return h('div', { class: 'row' }, ...children);
}

export function field(label, input) {
  return h('label', { class: 'field' }, h('span', null, label), input);
}

export function input(attrs) {
  return h('input', attrs);
}

export function select(options, value, onchange, attrs = {}) {
  const s = h(
    'select',
    { ...attrs, onchange: onchange ? (e) => onchange(e.target.value) : undefined },
    options.map((o) => {
      const [v, label] = Array.isArray(o) ? o : [o, o];
      return h('option', { value: v, selected: String(v) === String(value) ? true : undefined }, label);
    }),
  );
  return s;
}

/** Collapsible pretty JSON. */
export function jsonView(value, open = false) {
  const text = JSON.stringify(value, null, 2);
  return h('details', { class: 'json', open: open || undefined }, h('summary', null, summarize(value)), h('pre', null, text));
}

function summarize(v) {
  if (Array.isArray(v)) return `[${v.length}]`;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    return `{ ${keys.slice(0, 6).join(', ')}${keys.length > 6 ? ', …' : ''} }`;
  }
  return String(v);
}

export function table(headers, rows) {
  return h(
    'table',
    null,
    h('thead', null, h('tr', null, headers.map((x) => h('th', null, x)))),
    h('tbody', null, rows.map((r) => h('tr', r.attrs || null, (r.cells || r).map((c) => h('td', null, c))))),
  );
}

export function badge(text, kind = '') {
  return h('span', { class: `badge ${kind}` }, text);
}

export const TIER_COLORS = {
  common: '#9aa0a6',
  rare: '#4f8ef7',
  epic: '#a55eea',
  legendary: '#f7b731',
  mythic: '#eb3b5a',
};

export function tierBadge(tier) {
  if (!tier) return badge('yığın', 'muted');
  return h('span', { class: 'badge tier', style: { background: TIER_COLORS[tier] } }, tier);
}

export function fmtFloat(f) {
  return typeof f === 'number' ? f.toFixed(4) : '';
}

export function fmtTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString();
}

export function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem('cgdev.' + key) || 'null');
    localStorage.setItem('cgdev.' + key, JSON.stringify(value));
  } catch (_e) {
    // private window: settings are not remembered
  }
  return value;
}
