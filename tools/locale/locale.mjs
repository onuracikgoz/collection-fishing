#!/usr/bin/env node
// Locale files of the Unity client (docs/araclar/dil-destegi.md).
//
//   node tools/locale/locale.mjs sync    every language file gets every key of tr.json (empty
//                                        text for new keys, translations kept, old keys dropped),
//                                        in tr.json's order
//   node tools/locale/locale.mjs check   keys used in the client exist in tr.json and en.json,
//                                        placeholders match tr.json, how much each language has
//
// Files: client/Assets/Resources/Locales/<code>.json (flat "key": "text"), languages.json (list).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(root, 'client/Assets/Resources/Locales');
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const write = (f, obj) => fs.writeFileSync(path.join(dir, f), JSON.stringify(obj, null, 2) + '\n');
const holes = (s) => new Set([...String(s).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]));
const sameHoles = (a, b) => {
  const x = holes(a), y = holes(b);
  return x.size === y.size && [...x].every((h) => y.has(h));
};

const languages = read('languages.json');
const base = read('tr.json');
const keys = Object.keys(base);

function sync() {
  for (const { code } of languages) {
    if (code === 'tr') continue;
    const file = `${code}.json`;
    const old = fs.existsSync(path.join(dir, file)) ? read(file) : {};
    const out = {};
    for (const k of keys) out[k] = typeof old[k] === 'string' ? old[k] : '';
    const dropped = Object.keys(old).filter((k) => !(k in base));
    write(file, out);
    const done = keys.filter((k) => out[k] !== '').length;
    console.log(`${file}: ${done}/${keys.length} translated${dropped.length ? `, dropped ${dropped.length} old keys` : ''}`);
  }
}

/** Keys the client names in code: Loc.T("..."), Loc.Has("..."), L("...") and key-looking strings on those lines. */
function usedKeys() {
  const used = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.cs')) {
        fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (!/Loc\.(T|Has)\(|\bL\("/.test(line) || /^\s*\/\//.test(line)) return;
          for (const m of line.matchAll(/"([a-z][a-z0-9_]*(?:\.[A-Za-z0-9_]+)+)"/g)) {
            if (m[1].startsWith('ui.')) continue; // icon names (ItemIcons), not texts
            if (!used.has(m[1])) used.set(m[1], `${path.relative(root, p)}:${i + 1}`);
          }
        });
      }
    }
  };
  walk(path.join(root, 'client/Assets/Scripts'));
  walk(path.join(root, 'client/Assets/Editor'));
  return used;
}

function check() {
  let bad = 0;
  for (const [k, where] of usedKeys()) {
    if (!(k in base)) {
      console.log(`missing in tr.json: ${k} (${where})`);
      bad++;
    }
  }
  for (const { code, enabled } of languages) {
    if (code === 'tr') continue;
    const file = path.join(dir, `${code}.json`);
    if (!fs.existsSync(file)) {
      console.log(`${code}.json missing (run sync)`);
      bad++;
      continue;
    }
    const t = read(`${code}.json`);
    let done = 0;
    for (const k of keys) {
      if (!(k in t)) {
        console.log(`${code}.json: no key ${k} (run sync)`);
        bad++;
      } else if (t[k] !== '') {
        done++;
        if (!sameHoles(base[k], t[k])) {
          console.log(`${code}.json: ${k} placeholders differ from tr.json`);
          bad++;
        }
      }
    }
    if (enabled && done < keys.length) {
      console.log(`${code}.json is selectable but has ${keys.length - done} empty texts`);
      bad++;
    }
    console.log(`${code}: ${done}/${keys.length}${enabled ? '' : ' (greyed out in Ayarlar)'}`);
  }
  if (bad) {
    console.log(`${bad} problem(s)`);
    process.exit(1);
  }
  console.log('ok');
}

const cmd = process.argv[2];
if (cmd === 'sync') sync();
else if (cmd === 'check') check();
else {
  console.log('usage: node tools/locale/locale.mjs sync|check');
  process.exit(2);
}
