/* Fichiers jamais atteints depuis le point d entree.
   Parcours du graphe d imports a partir de App.js : un fichier absent du
   parcours n est charge par rien. Aucune suppression ici — seulement la liste. */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.resolve(process.argv[2] || '.');
const ENTRY = path.join(APP, 'App.js');

function resolve(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, base + '.js', base + '.jsx', path.join(base, 'index.js')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function importsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const re of [
    /import\s+[^'"]*?from\s*['"](\.[^'"]+)['"]/g,
    /import\s*['"](\.[^'"]+)['"]/g,
    /require\(\s*['"](\.[^'"]+)['"]\s*\)/g,
    // Les barils (`export { default as X } from './X'`) chargent aussi leurs
    // cibles : les oublier ferait passer pour mort tout ce qu'ils exportent.
    /export\s+[^'"]*?from\s*['"](\.[^'"]+)['"]/g,
  ]) {
    for (const m of src.matchAll(re)) out.push(m[1]);
  }
  return out;
}

const reached = new Set();
(function walk(file) {
  if (!file || reached.has(file)) return;
  reached.add(file);
  for (const spec of importsOf(file)) walk(resolve(file, spec));
})(ENTRY);

function all(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) all(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const every = all(path.join(APP, 'src'));
const dead = every.filter((f) => !reached.has(f)).sort();

console.log(`Atteints depuis App.js : ${reached.size}`);
console.log(`Fichiers sous src/     : ${every.length}`);
console.log(`\nJamais atteints (${dead.length}) :`);
for (const f of dead) console.log('  ' + f.replace(APP + path.sep, '').replace(/\\/g, '/'));

// Qui, parmi les morts, est encore importe par un autre mort ? Utile pour
// verifier qu on peut tout retirer d un bloc.
console.log('\nReferences croisees entre fichiers morts :');
const deadSet = new Set(dead);
let cross = 0;
for (const f of dead) {
  for (const spec of importsOf(f)) {
    const target = resolve(f, spec);
    if (target && deadSet.has(target)) {
      console.log(`  ${path.basename(f)} -> ${path.basename(target)}`);
      cross++;
    }
  }
}
if (!cross) console.log('  aucune');
