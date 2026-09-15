/* Verifie que titre, extrait et corps ne sont pas abimes (caracteres de remplacement U+FFFD).
   Ecrit dans un fichier pour ne pas dependre de l encodage de la console. */
'use strict';
const fs = require('fs');
const axios = require('axios');
const app = require('../src/server.js');
const USER = process.argv[2], PASS = process.argv[3];
const OUT = process.argv[4] || 'test/encoding-report.txt';

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const api = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, timeout: 60000, validateStatus: () => true });
  const lr = await api.post('/api/auth/login', { username: USER, password: PASS });
  const H = { headers: { Authorization: `Bearer ${lr.data.token}` } };

  const lines = [];
  const REPL = '�';
  let bad = 0;

  const f = await api.get('/api/feed?limit=30', H);
  for (const it of f.data.results || []) {
    for (const field of ['title', 'excerpt']) {
      const v = it[field] || '';
      if (v.includes(REPL)) { bad++; lines.push(`REMPLACEMENT  feed#${it.id} ${field}: ${JSON.stringify(v.slice(0, 90))}`); }
    }
  }

  const p = (f.data.results || []).find(x => x.type === 'post');
  if (p) {
    const d = await api.get(`/api/content/${p.id}`, H);
    for (const field of ['title', 'excerpt', 'body']) {
      const v = d.data[field] || '';
      if (v.includes(REPL)) { bad++; lines.push(`REMPLACEMENT  content#${p.id} ${field}: ${JSON.stringify(v.slice(0, 120))}`); }
    }
    lines.push(`titre  : ${JSON.stringify(d.data.title)}`);
    lines.push(`extrait: ${JSON.stringify(String(d.data.excerpt).slice(0, 120))}`);
    lines.push(`corps  : ${JSON.stringify(String(d.data.body).slice(0, 120))}`);
  }

  lines.push('');
  lines.push(`${bad} champ(s) contenant U+FFFD.`);
  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`rapport ecrit dans ${OUT} — ${bad} probleme(s)`);
  server.close(); process.exit(0);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
