/* Mesure le temps de chaque sondage de module + explore le Drive jusqu'a trouver un fichier.
   Script temporaire. */
'use strict';
const axios = require('axios');
const app = require('../src/server.js');

const USER = process.argv[2], PASS = process.argv[3];
const CID = Number(process.argv[4] || 46);

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const api = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, timeout: 60000, validateStatus: () => true });

  const r = await api.post('/api/auth/login', { username: USER, password: PASS });
  const H = { headers: { Authorization: `Bearer ${r.data.token}` } };

  console.log('=== A. Temps de chaque sondage (via HumHub direct) ===');
  const { http, asUser } = require('../src/services/humhub');
  const probes = [
    ['drive-manager', `/emajlis/drive/container/${CID}`],
    ['calendar', `/calendar/container/${CID}`],
    ['cfiles', `/cfiles/files/container/${CID}`],
    ['tasks', `/tasks/container/${CID}`],
    ['polls', `/polls/container/${CID}`],
    ['custom_pages', `/custom-pages/container/${CID}`],
  ];
  for (const [id, p] of probes) {
    const t0 = Date.now();
    let code;
    try { const x = await http.get(p, asUser(r.data.token)); code = x.status; }
    catch (e) { code = e.response?.status || e.code || e.message; }
    console.log(`  ${id.padEnd(15)} ${String(code).padEnd(6)} ${Date.now() - t0} ms`);
  }

  console.log('\n=== B. Exploration du Drive jusqu a un fichier (container 37) ===');
  let found = null;
  const queue = [{ id: null, path: '' }];
  let visited = 0;
  while (queue.length && !found && visited < 25) {
    const node = queue.shift(); visited++;
    const url = node.id ? `/api/drive/container/37?folderId=${node.id}` : '/api/drive/container/37';
    const d = await api.get(url, H);
    if (d.status !== 200) { console.log('  ', url, '-> HTTP', d.status); continue; }
    const files = d.data.files || [], folders = d.data.folders || [];
    console.log(`  ${(node.path || '/').padEnd(50).slice(0,50)} dossiers=${folders.length} fichiers=${files.length}`);
    if (files.length) { found = { file: files[0], path: node.path }; break; }
    for (const f of folders) queue.push({ id: f.id, path: `${node.path}/${f.name}` });
  }

  if (!found) { console.log('  AUCUN fichier trouve apres', visited, 'dossiers explores'); }
  else {
    const f = found.file;
    console.log('  fichier:', String(f.title).slice(0, 50), '|', f.human_size, '| mime=', f.mime_type);
    console.log('  chemin de telechargement:', f.api_download_url);
    const t0 = Date.now();
    const dl = await api.get(f.api_download_url, { ...H, responseType: 'arraybuffer' });
    console.log('  TELECHARGEMENT -> HTTP', dl.status, dl.data.length, 'octets,',
      'type=', dl.headers['content-type'], ', disposition=', String(dl.headers['content-disposition']).slice(0, 60),
      ',', Date.now() - t0, 'ms');
    const noAuth = await api.get(f.api_download_url);
    console.log('  sans jeton ->', noAuth.status, '(401 attendu)');
  }

  server.close(); process.exit(0);
})().catch(e => { console.error('ERREUR', e.message); process.exit(1); });
