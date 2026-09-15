// Enhanced request logging middleware
function logNotificationRequests(req, res, next) {
  if (req.path.includes('notification')) {
    console.log('\n=== NOTIFICATION REQUEST ===');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Query:', req.query);
    console.log('Headers:', {
      authorization: req.headers.authorization ? 'Bearer [TOKEN_PRESENT]' : 'NO_AUTH',
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    });
    console.log('IP:', req.ip || req.connection.remoteAddress);
    
    // Log response
    const originalSend = res.send;
    res.send = function(data) {
      console.log('Response Status:', res.statusCode);
      if (res.statusCode >= 400) {
        console.log('Error Response:', data);
      } else {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        console.log('Success Response:', {
          resultsCount: parsed?.results?.length || 0,
          total: parsed?.total,
          page: parsed?.page,
          hasError: !!parsed?.error
        });
      }
      console.log('=== END REQUEST ===\n');
      return originalSend.call(this, data);
    };
  }
  next();
}

module.exports = { logNotificationRequests };
