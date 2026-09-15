const axios = require('axios');

async function simulateMobileApp() {
  const baseURL = 'http://192.168.1.25:3000';
  
  console.log('Simulating mobile app behavior...');
  
  try {
    // Test login with demo credentials (replace with real ones if you know them)
    console.log('1. Attempting login...');
    
    const loginData = {
      username: 'admin',  // Try common test credentials
      password: 'admin'
    };
    
    try {
      const loginResponse = await axios.post(`${baseURL}/api/auth/login`, loginData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log('✓ Login successful!');
      console.log('Token received:', loginResponse.data.token ? 'YES' : 'NO');
      console.log('User data:', !!loginResponse.data.user);
      
      // Now test notifications with the real token
      console.log('\n2. Testing notifications with real token...');
      const notifResponse = await axios.get(`${baseURL}/api/feed/notifications?page=1&limit=25`, {
        headers: { Authorization: `Bearer ${loginResponse.data.token}` },
        timeout: 15000
      });
      
      console.log('✓ Notifications response:');
      console.log('  Results:', notifResponse.data.results?.length || 0);
      console.log('  Total:', notifResponse.data.total);
      console.log('  Error:', notifResponse.data.error || 'none');
      
      if (notifResponse.data.results?.length > 0) {
        console.log('  Sample notification:', notifResponse.data.results[0]);
      }
      
    } catch (loginErr) {
      console.log('✗ Login failed:', loginErr.response?.status, loginErr.response?.data?.error || loginErr.message);
      console.log('  This might be why notifications dont work - authentication issue');
      
      // Try with common alternative credentials
      const altCredentials = [
        { username: 'test', password: 'test' },
        { username: 'demo', password: 'demo' },
        { username: 'user', password: 'user' }
      ];
      
      for (const creds of altCredentials) {
        try {
          console.log(`Trying ${creds.username}/${creds.password}...`);
          await axios.post(`${baseURL}/api/auth/login`, creds);
          console.log(`✓ ${creds.username} works!`);
          break;
        } catch (err) {
          console.log(`✗ ${creds.username} failed`);
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

simulateMobileApp();
