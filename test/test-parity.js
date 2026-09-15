/* Test d'intégration — lance l'API en mémoire et l'interroge.
   Script temporaire : supprimé après exécution. */
'use strict';
process.env.NODE_ENV = 'development';
const axios = require('axios');
const app = require('../src/server.js');

const USER = process.argv[2], PASS = process.argv[3];
let base, server, token;
const pad = (s, n) => String(s).padEnd(n);

async function main() {
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const api = axios.create({ baseURL: base, timeout: 60000, validateStatus: () => true });

  console.log('=== 1. SANTE ===');
  let r = await api.get('/health');
  console.log('  HTTP', r.status, JSON.stringify(r.data));

  console.log('\n=== 2. CONNEXION ===');
  r = await api.post('/api/auth/login', { username: USER, password: PASS });
  console.log('  HTTP', r.status, r.status === 200 ? 'jeton recu' : JSON.stringify(r.data).slice(0, 200));
  if (r.status !== 200) throw new Error('login KO');
  token = r.data.token;
  const H = { headers: { Authorization: `Bearer ${token}` } };

  console.log('\n=== 3. FIL — les titres sont-ils reels ? ===');
  r = await api.get('/api/feed?limit=6', H);
  console.log('  HTTP', r.status, ' total=', r.data.total);
  let urlTitles = 0, emptyTitles = 0, needsServer = 0;
  for (const it of r.data.results || []) {
    if (!it.title) emptyTitles++;
    if (it.title && (it.title.startsWith('/') || it.title.startsWith('http'))) urlTitles++;
    if (it.needsServerSupport) needsServer++;
    console.log(`  ${pad(it.type,13)} ${pad(String(it.title).slice(0,52),52)} | ${it.author?.name || '-'}`);
  }
  console.log(`  --> titres vides: ${emptyTitles} | titres qui sont des URL: ${urlTitles} | sans support serveur: ${needsServer}`);

  console.log('\n=== 4. FIL filtre sur les evenements ===');
  r = await api.get('/api/feed?limit=3&contentType=' + encodeURIComponent('humhub\\modules\\calendar\\models\\CalendarEntry'), H);
  for (const it of r.data.results || []) {
    console.log(`  ${pad(it.title.slice(0,44),44)} | debut=${it.extra?.startDatetime || '-'} | lieu=${it.extra?.location || '-'}`);
  }

  console.log('\n=== 5. DRIVE (container 37) ===');
  r = await api.get('/api/drive/container/37', H);
  console.log('  HTTP', r.status, ' counts=', JSON.stringify(r.data.counts), ' permissions=', JSON.stringify(r.data.permissions));
  const firstFolder = (r.data.folders || [])[0];
  if (firstFolder) {
    console.log('  dossier:', firstFolder.name, '(id', firstFolder.id + ')');
    const sub = await api.get(`/api/drive/container/37?folderId=${firstFolder.id}`, H);
    console.log('  dans ce dossier -> counts=', JSON.stringify(sub.data.counts), ' fil d Ariane=', (sub.data.breadcrumb||[]).map(b=>b.name).join(' > '));
    const f = (sub.data.files || [])[0];
    if (f) {
      console.log('  fichier:', String(f.title).slice(0,40), '|', f.human_size, '| chemin=', f.api_download_url);
      const dl = await api.get(f.api_download_url, { ...H, responseType: 'arraybuffer' });
      console.log('  TELECHARGEMENT -> HTTP', dl.status, dl.data.length, 'octets, type=', dl.headers['content-type']);
    }
  }

  console.log('\n=== 6. TYPES DE RECHERCHE ===');
  r = await api.get('/api/feed/search/types', H);
  console.log('  HTTP', r.status, ' nombre de types=', (r.data.results || []).length, '(l app en codait 2 en dur)');

  console.log('\n=== 7. RECHERCHE ===');
  r = await api.get('/api/feed/search?keyword=conseil&limit=3', H);
  console.log('  HTTP', r.status, ' total=', r.data.total);
  for (const it of r.data.results || []) console.log(`  ${pad(it.type,12)} ${String(it.title).slice(0,50)}`);

  console.log('\n=== 8. CATALOGUE E-SERVICES (statuts reels ?) ===');
  r = await api.get('/api/eservices/catalog', H);
  const st = (r.data.statuses || []).map(s => s.value);
  console.log('  HTTP', r.status, ' statuts=', JSON.stringify(st));
  console.log('  types=', JSON.stringify((r.data.types || []).map(t => t.value)));
  console.log('  is_manager=', r.data.is_manager);
  console.log('  --> attendu: in_progress + approved (et non processing/completed)');

  console.log('\n=== 9. ESPACES : modules, pages, membres ===');
  r = await api.get('/api/spaces?limit=3', H);
  const sp = (r.data.results || [])[0];
  console.log('  espaces HTTP', r.status, ' premier=', sp?.name, ' id=', sp?.id, ' cc_id=', sp?.contentcontainer_id);
  if (sp) {
    const mods = await api.get(`/api/spaces/${sp.contentcontainer_id}/modules`, H);
    console.log('  modules actives =', JSON.stringify(mods.data.modules));
    const pages = await api.get(`/api/spaces/${sp.contentcontainer_id}/pages`, H);
    console.log('  pages HTTP', pages.status, ' nombre=', pages.data.total);
    for (const p of (pages.data.results || []).slice(0, 4)) {
      console.log(`    ${pad(p.title.slice(0,26),26)} -> ${p.shortcut ? JSON.stringify(p.shortcut) : 'page reelle'}`);
    }
    const mem = await api.get(`/api/spaces/${sp.id}/members`, H);
    console.log('  membres HTTP', mem.status, ' total=', mem.data.total ?? '-');
  }

  console.log('\n=== 10. DETAIL D UN CONTENU ===');
  r = await api.get('/api/feed?limit=10&contentType=' + encodeURIComponent('humhub\\modules\\post\\models\\Post'), H);
  const post = (r.data.results || [])[0];
  if (post) {
    const d = await api.get(`/api/content/${post.id}`, H);
    console.log('  HTTP', d.status, ' type=', d.data.type, ' titre=', String(d.data.title).slice(0, 50));
    console.log('  corps: ', d.data.body ? `${d.data.body.length} caracteres, format=${d.data.bodyFormat}` : 'VIDE');
    console.log('  --> l ancien backend tronquait a 200 caracteres et retirait le HTML');
  }

  console.log('\n=== 11. LIKES ===');
  if (post) {
    const model = 'humhub\\modules\\post\\models\\Post';
    const s = await api.get(`/api/likes/status?model=${encodeURIComponent(model)}&pk=${post.objectId}`, H);
    console.log('  status HTTP', s.status, JSON.stringify(s.data));
  }

  console.log('\n=== 12. NON-REGRESSION ===');
  for (const u of ['/api/feed/notifications/unseen', '/api/feed/calendar?limit=3']) {
    const x = await api.get(u, H);
    console.log(' ', pad(u, 40), '-> HTTP', x.status);
  }
  const noAuth = await api.get('/api/feed');
  console.log('  /api/feed sans jeton -> HTTP', noAuth.status, '(401 attendu)');
  const proxy = await api.get('/api/proxy-html?url=https://example.com');
  console.log('  /api/proxy-html sans jeton -> HTTP', proxy.status, '(401 attendu)');
  const proxy2 = await api.get('/api/proxy-html?url=https://evil.example.com', H);
  console.log('  /api/proxy-html domaine non autorise -> HTTP', proxy2.status, '(403 attendu)');
}

main()
  .then(() => { console.log('\n=== FIN ==='); server && server.close(); process.exit(0); })
  .catch(e => { console.error('\nERREUR:', e.message); server && server.close(); process.exit(1); });
