const axios = require('axios');

// Test the full flow
async function testFullNotificationFlow() {
  try {
    // 1. Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await axios.get('http://192.168.1.25:3000/health');
    console.log('✓ Health OK:', health.data.status);
    
    // 2. Test auth endpoint
    console.log('2. Testing auth endpoint...');
    try {
      const authResponse = await axios.get('http://192.168.1.25:3000/api/feed/notifications', {
        timeout: 5000
      });
    } catch (err) {
      if (err.response?.status === 401) {
        console.log('✓ Auth required correctly:', err.response.data.error);
      } else {
        console.log('✗ Unexpected error:', err.response?.status, err.response?.data);
      }
    }
    
    // 3. Test with dummy token (should fail gracefully)
    console.log('3. Testing with dummy token...');
    try {
      const notifResponse = await axios.get('http://192.168.1.25:3000/api/feed/notifications', {
        headers: { Authorization: 'Bearer dummy-token-12345' },
        timeout: 10000
      });
    } catch (err) {
      console.log('Response status:', err.response?.status);
      console.log('Response data:', err.response?.data);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testFullNotificationFlow();
