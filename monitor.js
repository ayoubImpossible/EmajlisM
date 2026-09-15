const axios = require('axios');
const express = require('express');

// Create a simple monitoring server
const app = express();
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  if (req.path.includes('notification')) {
    console.log('\n🔍 NOTIFICATION REQUEST INTERCEPTED');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('Full URL:', req.url);
    console.log('Headers Auth:', req.headers.authorization ? 'Present' : 'Missing');
    console.log('Query:', req.query);
    console.log('Body:', req.body);
  }
  next();
});

// Proxy to real API
app.use('*', async (req, res) => {
  try {
    const targetUrl = `http://192.168.1.25:3000${req.originalUrl}`;
    console.log('Proxying to:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: req.headers,
      data: req.body,
      timeout: 10000
    });
    
    console.log('✅ Response:', {
      status: response.status,
      dataSize: JSON.stringify(response.data).length,
      hasResults: response.data?.results?.length || 0
    });
    
    res.status(response.status).json(response.data);
  } catch (err) {
    console.log('❌ Proxy Error:', {
      status: err.response?.status,
      message: err.message,
      data: err.response?.data
    });
    
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: err.message }
    );
  }
});

app.listen(3001, '0.0.0.0', () => {
  console.log('🚀 API Monitor running on http://192.168.1.25:3001');
  console.log('📱 Change your app to use this URL to monitor requests');
});
