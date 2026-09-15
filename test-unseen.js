const { http, asUser } = require('./src/services/humhub');

async function probeUnseen(token) {
  const tests = [
    '/notification/unseen',
    '/notification/count-unseen',
    '/notification?seen=0',
    '/notification/count',
  ];
  for (const url of tests) {
    try {
      const res = await http.get(url, { ...asUser(token), timeout: 6000 });
      console.log(`SUCCESS ${url}:`, JSON.stringify(res.data).substring(0, 200));
    } catch(e) {
      console.log(`FAIL ${url}: ${e.response?.status} ${JSON.stringify(e.response?.data || {}).substring(0,100)}`);
    }
  }
}

const token = process.argv[2];
if (!token) {
  console.log('Need token: node test-unseen.js <token>');
  // Try without token to see what 401 says
  probeUnseen('fake');
} else {
  probeUnseen(token);
}
