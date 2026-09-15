const axios = require('axios');

async function testHumHubAPI() {
  const humhubBase = 'https://emajlis-dev.csefrs.ma';
  
  console.log('Testing HumHub API directly...');
  
  try {
    // Test the notification endpoint structure
    console.log('1. Testing HumHub notification endpoint structure...');
    
    // First, let me check what endpoints are available
    const testUrls = [
      '/api/v1/notification',
      '/api/v1/notifications', 
      '/api/v1/user/notifications',
      '/api/v1/auth/current'
    ];
    
    for (const url of testUrls) {
      try {
        console.log(`Testing: ${humhubBase}${url}`);
        await axios.get(`${humhubBase}${url}`, { timeout: 5000 });
        console.log(`✓ ${url} - responds (needs auth)`);
      } catch (err) {
        if (err.response?.status === 401) {
          console.log(`✓ ${url} - exists, requires auth`);
        } else if (err.response?.status === 404) {
          console.log(`✗ ${url} - not found`);
        } else {
          console.log(`? ${url} - status: ${err.response?.status}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testHumHubAPI();
