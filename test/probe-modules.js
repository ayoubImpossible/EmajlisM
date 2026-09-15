/* Verifie si le sondage des modules distingue vraiment les espaces. Temporaire. */
'use strict';
const axios = require('axios');
const app = require('../src/server.js');
const { http, asUser } = require('../src/services/humhub');

const USER = process.argv[2], PASS = process.argv[3];

const PROBES = [
  ['drive-manager', (c) => `/emajlis/drive/container/${c}`],
  ['calendar', (c) => `/calendar/container/${c}`],
  ['cfiles', (c) => `/cfiles/files/container/${c}`],
  ['tasks', (c) => `/tasks/container/${c}`],
  ['polls', (c) => `/polls/container/${c}`],
  ['custom_pages', (c) => `/custom-pages/container/${c}`],
];

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const api = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, timeout: 60000, validateStatus: () => true });
  const lr = await api.post('/api/auth/login', { username: USER, password: PASS });
  const token = lr.data.token;
  const H = { headers: { Authorization: `Bearer ${token}` } };

  const sp = await api.get('/api/spaces?limit=30', H);
  const spaces = sp.data.results || [];
  console.log('espaces =', spaces.length);
  console.log('');
  console.log('cc_id  ' + PROBES.map(p => p[0].slice(0, 6).padEnd(7)).join('') + ' nom');
  const signatures = new Map();

  for (const s of spaces) {
    const cid = s.contentcontainer_id;
    const cells = [];
    const sig = [];
    for (const [id, path] of PROBES) {
      let code, n = '';
      try {
        const x = await http.get(path(cid), asUser(token));
        code = x.status;
        const d = x.data;
        n = Array.isArray(d?.results) ? d.results.length
          : Array.isArray(d?.folders) || Array.isArray(d?.files) ? `${(d.folders||[]).length}+${(d.files||[]).length}`
          : (d?.total ?? '');
      } catch (e) { code = e.response?.status || 'ERR'; }
      cells.push(`${code}:${n}`.padEnd(7));
      sig.push(`${id}=${code}`);
    }
    const key = sig.join(',');
    signatures.set(key, (signatures.get(key) || 0) + 1);
    console.log(String(cid).padEnd(7) + cells.join('') + ' ' + String(s.name).slice(0, 34));
  }

  console.log('\nSignatures distinctes :', signatures.size);
  for (const [k, v] of signatures) console.log(`  x${v}  ${k}`);
  console.log('\n--> si une seule signature, le sondage ne distingue rien : il ne mesure pas');
  console.log('    l activation du module mais la simple presence du controleur REST.');
  server.close(); process.exit(0);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
