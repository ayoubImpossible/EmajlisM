const { http, asUser } = require('./src/services/humhub');

// We need a real token - let's try to find credentials in the env or test different approaches
async function probeNotificationEndpoint(token) {
  const tests = [
    { url: '/notification', params: {} },
    { url: '/notification', params: { page: 1 } },
    { url: '/notification', params: { page: 1, limit: 5 } },
    { url: '/notification', params: { offset: 0, limit: 5 } },
    { url: '/notification?page=1&limit=5', params: {} },
  ];

  for (const t of tests) {
    try {
      const res = await http.get(t.url, { ...asUser(token), params: t.params, timeout: 8000 });
      console.log(`SUCCESS ${t.url} params=${JSON.stringify(t.params)}`);
      console.log('Response keys:', Object.keys(res.data || {}));
      console.log('Results count:', res.data?.results?.length);
      return;
    } catch (e) {
      console.log(`FAIL ${t.url} params=${JSON.stringify(t.params)} → ${e.response?.status}: ${JSON.stringify(e.response?.data).substring(0,100)}`);
    }
  }
}

// Get token from stdin or use a hardcoded test
const token = process.argv[2];
if (!token) {
  console.log('Usage: node test-notif-direct.js <humhub_token>');
  console.log('Get token from app network logs or by logging in');
} else {
  probeNotificationEndpoint(token);
}
