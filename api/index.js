'use strict';

// Vercel entry point — loads the full Express app from src/server.js
// The TLS cert loading in services/humhub.js is now graceful (silent if certs/ missing)
module.exports = require('../src/server.js');
