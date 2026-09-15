/* Verifie que chaque import relatif de emajlis-app/src pointe sur un fichier
   existant, et que chaque symbole importe est bien exporte. Statique, rapide. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || path.resolve(__dirname, '..', '..', 'emajlis-app', 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function resolve(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, base + '.js', base + '.jsx', path.join(base, 'index.js')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/** Noms exportes d'un fichier, par lecture du texte (suffisant ici). */
function exportsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default/.test(src)) names.add('default');
  return names;
}

const files = walk(ROOT);
const cache = new Map();
let missing = 0, badSymbol = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = file.replace(ROOT, '');

  for (const m of src.matchAll(/import\s+([^'"]*?)\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const clause = m[1];
    const spec = m[2];
    const target = resolve(file, spec);
    if (!target) {
      console.log(`MANQUANT  ${rel} -> ${spec}`);
      missing++;
      continue;
    }
    if (!cache.has(target)) cache.set(target, exportsOf(target));
    const available = cache.get(target);

    const named = clause.match(/\{([^}]*)\}/);
    const defaultImport = clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim();

    if (defaultImport && !available.has('default')) {
      console.log(`SANS DEFAUT  ${rel} importe '${defaultImport}' depuis ${spec} qui n'a pas d'export par defaut`);
      badSymbol++;
    }
    if (named) {
      for (const raw of named[1].split(',')) {
        const name = raw.split(/\s+as\s+/)[0].trim();
        if (name && !available.has(name)) {
          console.log(`SYMBOLE  ${rel} importe { ${name} } depuis ${spec} — non exporte`);
          badSymbol++;
        }
      }
    }
  }
}

console.log(`\n${files.length} fichiers analyses — ${missing} import(s) introuvable(s), ${badSymbol} symbole(s) manquant(s).`);
process.exit(missing + badSymbol ? 1 : 0);
