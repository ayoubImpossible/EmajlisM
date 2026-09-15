const axios = require('axios');

async function compareEndpoints() {
  console.log('🔍 Analyzing notification endpoint differences...');
  
  // Test our API endpoint structure
  console.log('\n1. Testing our API responses...');
  
  try {
    // Test working endpoint (feed)
    console.log('Testing /api/feed (should work)...');
    const feedResponse = await axios.get('http://192.168.1.25:3000/api/feed', {
      headers: { Authorization: 'Bearer test-token' }
    });
  } catch (err) {
    console.log('Feed response status:', err.response?.status);
    if (err.response?.status === 401) {
      console.log('✓ Feed requires auth (normal)');
    } else {
      console.log('Feed response:', err.response?.data);
    }
  }
  
  try {
    // Test notifications endpoint
    console.log('Testing /api/feed/notifications...');
    const notifResponse = await axios.get('http://192.168.1.25:3000/api/feed/notifications', {
      headers: { Authorization: 'Bearer test-token' }
    });
  } catch (err) {
    console.log('Notifications response status:', err.response?.status);
    if (err.response?.status === 401) {
      console.log('✓ Notifications requires auth (normal)');
    } else {
      console.log('Notifications response:', err.response?.data);
    }
  }
  
  // Test mock endpoint to see the expected format
  console.log('\n2. Testing mock notifications format...');
  try {
    const mockResponse = await axios.get('http://192.168.1.25:3000/api/feed/test/notifications');
    console.log('✓ Mock notifications format:');
    console.log('  Results count:', mockResponse.data.results?.length);
    console.log('  Sample result:', JSON.stringify(mockResponse.data.results?.[0], null, 2));
    console.log('  Full structure:', Object.keys(mockResponse.data));
  } catch (err) {
    console.log('❌ Mock failed:', err.message);
  }
  
  console.log('\n3. Checking HumHub API endpoint paths...');
  
  // Let me check if there are alternate notification endpoints
  const possiblePaths = [
    '/notification',
    '/notifications', 
    '/user/notifications',
    '/emajlis/notifications',
    '/notification/list'
  ];
  
  for (const path of possiblePaths) {
    try {
      console.log(`Testing HumHub: https://emajlis-dev.csefrs.ma/api/v1${path}`);
      await axios.get(`https://emajlis-dev.csefrs.ma/api/v1${path}`, { timeout: 3000 });
      console.log(`✓ ${path} exists`);
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(`✓ ${path} exists (auth required)`);
      } else if (err.response?.status === 404) {
        console.log(`✗ ${path} not found`);
      } else {
        console.log(`? ${path} status: ${err.response?.status}`);
      }
    }
  }
}

compareEndpoints();
