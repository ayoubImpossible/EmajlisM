'use strict';

/**
 * Graceful shutdown handler for the API server.
 * Closes all connections and cleans up resources on SIGTERM/SIGINT.
 */

let httpServer = null;
let httpAgent = null;

function registerServer(server, agent) {
  httpServer = server;
  httpAgent = agent;
}

function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  
  if (httpServer) {
    httpServer.close(() => {
      console.log('HTTP server closed');
      
      if (httpAgent && typeof httpAgent.destroy === 'function') {
        httpAgent.destroy();
        console.log('Connection pool destroyed');
      }
      
      process.exit(0);
    });
    
    // Force exit after 10s if graceful shutdown fails
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

function setupShutdownHandlers() {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { registerServer, setupShutdownHandlers };
