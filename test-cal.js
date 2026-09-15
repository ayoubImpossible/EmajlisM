const { http } = require('./src/services/humhub');

async function probe() {
  const tests = [
    { url: '/calendar', params: {}, auth: false },
    { url: '/calendar?page=1', params: {}, auth: false },
    { url: '/calendar', params: { page: 1, limit: 10 }, auth: false },
    { url: '/calendar', params: { page: 1, limit: 100 }, auth: false },
  ];

  for (const t of tests) {
    try {
      const cfg = { params: t.params, timeout: 5000 };
      if (!t.auth) cfg.headers = { Authorization: 'Bearer fake-token' };
      const res = await http.get(t.url, cfg);
      console.log(`✅ ${t.url} ${JSON.stringify(t.params)} → 200`);
    } catch(e) {
      console.log(`${e.response?.status} ${t.url} ${JSON.stringify(t.params)} → ${JSON.stringify(e.response?.data || {}).substring(0,100)}`);
    }
  }
}
probe();
