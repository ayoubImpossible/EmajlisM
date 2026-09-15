/* Formes des reponses encore inconnues : membres d un espace, annuaire,
   notifications, agenda, espaces. Pour coder contre le contrat, pas contre une idee. */
'use strict';
const axios = require('axios');
const app = require('../src/server.js');
const U = process.argv[2], P = process.argv[3];
const cut = (o, n = 800) => JSON.stringify(o, null, 1).slice(0, n);

(async () => {
  const s = app.listen(0);
  await new Promise(r => s.once('listening', r));
  const api = axios.create({ baseURL: `http://127.0.0.1:${s.address().port}`, timeout: 60000, validateStatus: () => true });
  const lr = await api.post('/api/auth/login', { username: U, password: P });
  const H = { headers: { Authorization: `Bearer ${lr.data.token}` } };

  const show = async (label, url) => {
    const r = await api.get(url, H);
    console.log(`\n=== ${label}  (HTTP ${r.status}) ${url} ===`);
    console.log(cut(r.data));
  };

  await show('MEMBRES ESPACE', '/api/spaces/24/members?limit=2');
  await show('ANNUAIRE', '/api/membres?per_page=2');
  await show('NOTIFICATIONS', '/api/feed/notifications?limit=3');
  await show('NON LUES', '/api/feed/notifications/unseen');
  await show('AGENDA', '/api/feed/calendar?limit=2');
  await show('ESPACES', '/api/spaces?limit=2');

  s.close(); process.exit(0);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
