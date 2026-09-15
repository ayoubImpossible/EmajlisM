const axios = require('axios');

async function testCompleteFlow() {
  const baseURL = 'http://192.168.1.25:3000';
  
  console.log('=== eMajlis API Notification Flow Test ===');
  
  // 1. Test health
  try {
    const health = await axios.get(`${baseURL}/health`);
    console.log('✓ 1. Health check:', health.data.status);
  } catch (err) {
    console.log('✗ 1. Health check failed:', err.message);
    return;
  }
  
  // 2. Test public mock notifications
  try {
    const mock = await axios.get(`${baseURL}/api/feed/test/notifications`);
    console.log(`✓ 2. Mock notifications: ${mock.data.results.length} items`);
  } catch (err) {
    console.log('✗ 2. Mock notifications failed:', err.message);
  }
  
  // 3. Test auth requirement
  try {
    await axios.get(`${baseURL}/api/feed/notifications`);
    console.log('✗ 3. Should require auth but didnt');
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('✓ 3. Auth required correctly:', err.response.data.error);
    } else {
      console.log('✗ 3. Unexpected error:', err.response?.status, err.response?.data);
    }
  }
  
  // 4. Test with invalid token
  try {
    await axios.get(`${baseURL}/api/feed/notifications`, {
      headers: { Authorization: 'Bearer invalid-token-123' }
    });
    console.log('✗ 4. Invalid token should fail');
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('✓ 4. Invalid token rejected:', err.response.data.error);
    } else {
      console.log('? 4. Unexpected response:', err.response?.status, err.response?.data?.error);
    }
  }
  
  console.log('\n=== API Ready for Mobile App ===');
  console.log('The mobile app should:');
  console.log('1. Login via POST /api/auth/login with valid HumHub credentials');
  console.log('2. Use the returned token for GET /api/feed/notifications');
  console.log('3. Handle 401 errors by redirecting to login');
  console.log('4. The notifications will now be processed correctly');
}

testCompleteFlow().catch(console.error);
