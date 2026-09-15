/* Affiche la forme reelle des reponses, pour coder contre le contrat et non contre une supposition. */
'use strict';
const axios = require('axios');
const app = require('../src/server.js');
const USER = process.argv[2], PASS = process.argv[3];

const short = (o, n = 1400) => JSON.stringify(o, null, 1).slice(0, n);

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const api = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, timeout: 60000, validateStatus: () => true });
  const lr = await api.post('/api/auth/login', { username: USER, password: PASS });
  const H = { headers: { Authorization: `Bearer ${lr.data.token}` } };

  console.log('=== A. login -> user ===');
  console.log(short(lr.data.user, 700));

  console.log('\n=== B. feed : un element de chaque type ===');
  const f = await api.get('/api/feed?limit=40', H);
  const seen = new Set();
  for (const it of f.data.results || []) {
    if (seen.has(it.type)) continue;
    seen.add(it.type);
    console.log(`\n--- type=${it.type} ---`);
    console.log(short(it, 900));
  }
  console.log('\ntypes vus:', [...seen].join(', '));

  console.log('\n=== C. catalogue e-services ===');
  const c = await api.get('/api/eservices/catalog', H);
  console.log(short(c.data, 3000));

  console.log('\n=== D. mes demandes ===');
  const d = await api.get('/api/eservices/requests?limit=2', H);
  console.log(short(d.data, 1200));

  console.log('\n=== E. detail contenu (post) ===');
  const p = (f.data.results || []).find(x => x.type === 'post');
  if (p) console.log(short((await api.get(`/api/content/${p.id}`, H)).data, 1200));

  console.log('\n=== F. commentaires ===');
  if (p) console.log(short((await api.get(`/api/comments/content/${p.id}`, H)).data, 800));

  console.log('\n=== G. pages d un espace ===');
  console.log(short((await api.get('/api/spaces/46/pages', H)).data, 800));

  console.log('\n=== H. espace (detail) ===');
  console.log(short((await api.get('/api/spaces/24', H)).data, 900));

  server.close(); process.exit(0);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
