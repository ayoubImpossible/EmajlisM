/* Verifie le bloc social de bout en bout, puis REMET L ETAT D ORIGINE.
   Ecritures reelles : un like et un commentaire, tous deux retires ensuite. */
'use strict';
const axios = require('axios');
const app = require('../src/server.js');
const USER = process.argv[2], PASS = process.argv[3];

const ok = (c) => (c ? 'OK ' : 'ECHEC');

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const api = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, timeout: 60000, validateStatus: () => true });
  const lr = await api.post('/api/auth/login', { username: USER, password: PASS });
  const H = { headers: { Authorization: `Bearer ${lr.data.token}` } };

  const f = await api.get('/api/feed?limit=20&contentType=' + encodeURIComponent('humhub\\modules\\post\\models\\Post'), H);
  const post = (f.data.results || [])[0];
  if (!post) { console.log('aucun post trouve'); server.close(); process.exit(1); }
  console.log(`cible : #${post.id} "${String(post.title).slice(0, 40)}" model=${post.objectModel} pk=${post.objectId}`);

  // --- LIKES ---
  const s0 = await api.get(`/api/likes/status?model=${encodeURIComponent(post.objectModel)}&pk=${post.objectId}`, H);
  console.log(`\n1. etat initial      HTTP ${s0.status} ${JSON.stringify(s0.data)}`);
  const wasLiked = !!s0.data.currentUserLiked;
  const count0 = s0.data.counter;

  const l1 = wasLiked
    ? await api.delete('/api/likes', { ...H, data: { model: post.objectModel, pk: post.objectId } })
    : await api.post('/api/likes', { model: post.objectModel, pk: post.objectId }, H);
  console.log(`2. bascule           HTTP ${l1.status} ${JSON.stringify(l1.data).slice(0, 120)}`);

  const s1 = await api.get(`/api/likes/status?model=${encodeURIComponent(post.objectModel)}&pk=${post.objectId}`, H);
  console.log(`3. etat apres        HTTP ${s1.status} ${JSON.stringify(s1.data)}  -> ${ok(!!s1.data.currentUserLiked !== wasLiked)} (l etat a bien change)`);

  // remise en etat
  const l2 = wasLiked
    ? await api.post('/api/likes', { model: post.objectModel, pk: post.objectId }, H)
    : await api.delete('/api/likes', { ...H, data: { model: post.objectModel, pk: post.objectId } });
  const s2 = await api.get(`/api/likes/status?model=${encodeURIComponent(post.objectModel)}&pk=${post.objectId}`, H);
  console.log(`4. remise en etat    HTTP ${l2.status} -> ${JSON.stringify(s2.data)}  ${ok(!!s2.data.currentUserLiked === wasLiked && s2.data.counter === count0)}`);

  // --- COMMENTAIRES ---
  const c0 = await api.get(`/api/comments/content/${post.id}`, H);
  console.log(`\n5. commentaires      HTTP ${c0.status} total=${c0.data.total}`);
  const total0 = c0.data.total;

  const marker = `[test automatique ${Date.now()}] a supprimer`;
  const c1 = await api.post('/api/comments', { model: post.objectModel, pk: post.objectId, message: marker }, H);
  console.log(`6. publication       HTTP ${c1.status} id=${c1.data?.id ?? JSON.stringify(c1.data).slice(0, 150)}`);

  const c2 = await api.get(`/api/comments/content/${post.id}`, H);
  const mine = (c2.data.results || []).find(x => String(x.message).includes(marker));
  console.log(`7. relecture         total=${c2.data.total} ${ok(!!mine)} (le commentaire est bien present)`);

  if (mine) {
    const c3 = await api.delete(`/api/comments/${mine.id}`, H);
    const c4 = await api.get(`/api/comments/content/${post.id}`, H);
    console.log(`8. suppression       HTTP ${c3.status} -> total=${c4.data.total} ${ok(c4.data.total === total0)} (etat d origine retabli)`);
  } else {
    console.log('8. suppression       IMPOSSIBLE — le commentaire n a pas ete retrouve, verification manuelle requise');
  }

  server.close(); process.exit(0);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
