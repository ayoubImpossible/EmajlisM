const { http, asUser } = require('./src/services/humhub');
async function test() {
  try {
    const res = await http.get('/emajlis/search/types', { timeout: 8000 });
    console.log('Search types:', JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.log('Error:', e.response?.status, JSON.stringify(e.response?.data));
    // Try without auth
    try {
      const res2 = await http.get('/emajlis/feed', { timeout: 8000 });
      console.log('Feed keys:', Object.keys(res2.data || {}));
      if (res2.data?.results?.[0]) {
        console.log('First item type:', res2.data.results[0].contentclassname || res2.data.results[0].type || res2.data.results[0].class);
        console.log('First item keys:', Object.keys(res2.data.results[0]));
      }
    } catch(e2) {
      console.log('Feed error:', e2.response?.status);
    }
  }
}
test();
