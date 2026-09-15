/* objectModel/objectId sont les bons noms : le serveur resout l objet et repond
   400 « le commentaire ne doit pas etre vide ». Reste a trouver le nom du champ. */
'use strict';
const axios = require('axios');
const { http, asUser } = require('../src/services/humhub');
const app = require('../src/server.js');
const USER = process.argv[2], PASS = process.argv[3];

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const api = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, timeout: 60000, validateStatus: () => true });
  const lr = await api.post('/api/auth/login', { username: USER, password: PASS });
  const token = lr.data.token;
  const H = { headers: { Authorization: `Bearer ${token}` } };

  const f = await api.get('/api/feed?limit=20&contentType=' + encodeURIComponent('humhub\\modules\\post\\models\\Post'), H);
  const post = (f.data.results || [])[0];
  const CID = post.id, MODEL = post.objectModel, PK = post.objectId;
  const P = { objectModel: MODEL, objectId: PK };
  console.log(`cible content=${CID} model=${MODEL} pk=${PK}\n`);

  const created = [];
  const M = () => `[sonde ${Date.now()}]`;
  const form = (obj) => new URLSearchParams(obj).toString();
  const FH = () => ({ ...asUser(token), params: P, headers: { ...asUser(token).headers, 'Content-Type': 'application/x-www-form-urlencoded' } });

  const tries = [
    ['{Comment:{message}}',        () => http.post('/comment', { Comment: { message: M() } }, { ...asUser(token), params: P })],
    ['{comment:{message}}',        () => http.post('/comment', { comment: { message: M() } }, { ...asUser(token), params: P })],
    ['{text}',                     () => http.post('/comment', { text: M() }, { ...asUser(token), params: P })],
    ['{content}',                  () => http.post('/comment', { content: M() }, { ...asUser(token), params: P })],
    ['formulaire message=',        () => http.post('/comment', form({ message: M() }), FH())],
    ['formulaire Comment[message]', () => http.post('/comment', form({ 'Comment[message]': M() }), FH())],
    ['formulaire data[message]',   () => http.post('/comment', form({ 'data[message]': M() }), FH())],
    ['{data:{Comment:{message}}}', () => http.post('/comment', { data: { Comment: { message: M() } } }, { ...asUser(token), params: P })],
  ];

  for (const [label, fn] of tries) {
    try {
      const r = await fn();
      const id = r.data?.id || r.data?.comment?.id;
      if (id) created.push(id);
      console.log(`${String(r.status).padEnd(4)} ${label}${id ? `  -> CREE #${id}` : `  ${JSON.stringify(r.data).slice(0, 110)}`}`);
    } catch (e) {
      console.log(`${String(e.response?.status || 'ERR').padEnd(4)} ${label}  ${JSON.stringify(e.response?.data).slice(0, 110)}`);
    }
  }

  console.log('\n--- nettoyage ---');
  for (const id of created) {
    try { await http.delete(`/comment/${id}`, asUser(token)); console.log(`  supprime #${id}`); }
    catch (e) { console.log(`  ECHEC #${id} — A SUPPRIMER A LA MAIN`); }
  }
  const after = await api.get(`/api/comments/content/${CID}`, H);
  console.log(`total apres nettoyage : ${after.data.total}`);
  server.close(); process.exit(0);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
