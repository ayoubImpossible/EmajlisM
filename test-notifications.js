const axios = require('axios');

async function testNotifications() {
  try {
    console.log('Testing notifications endpoint...');
    
    // Test without auth first (should get 401)
    try {
      const response = await axios.get('http://192.168.1.25:3000/api/feed/notifications?page=1&limit=25');
      console.log('Unexpected success without auth:', response.status);
    } catch (err) {
      console.log('Expected auth error:', err.response?.status, err.response?.data?.error);
    }
    
    // Now test with mock data to see if the server processes correctly
    console.log('\nTesting server processing...');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testNotifications();
