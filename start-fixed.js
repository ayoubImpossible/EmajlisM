const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const interfaces = os.networkInterfaces();
let ip = '';

// Try Wi-Fi adapter first — skip link-local (169.254.x.x)
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (
      iface.family === 'IPv4' &&
      !iface.internal &&
      !iface.address.startsWith('169.254.') &&
      !iface.address.startsWith('172.') &&
      (name.toLowerCase().includes('wi-fi') ||
        name.toLowerCase().includes('wlan') ||
        name.toLowerCase().includes('wireless'))
    ) {
      ip = iface.address;
      break;
    }
  }
  if (ip) break;
}

// Fallback to any real non-internal IPv4
if (!ip) {
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('169.254.') &&
        !iface.address.startsWith('172.')
      ) {
        ip = iface.address;
        break;
      }
    }
    if (ip) break;
  }
}

if (!ip) ip = '127.0.0.1';

console.log('====================================================');
console.log('Detected IP: ' + ip);
console.log('====================================================');

// Auto-update app .env with new IP
const appEnvPath = path.join(__dirname, '.env');
if (fs.existsSync(appEnvPath)) {
  let envContent = fs.readFileSync(appEnvPath, 'utf8');
  const portMatch = envContent.match(/EXPO_PUBLIC_BASE_URL=http:\/\/[^:]+:(\d+)/);
  const port = portMatch ? portMatch[1] : '3000';
  const newUrl = 'EXPO_PUBLIC_BASE_URL=http://' + ip + ':' + port;
  envContent = envContent.replace(/EXPO_PUBLIC_BASE_URL=http:\/\/[^\n]+/, newUrl);
  fs.writeFileSync(appEnvPath, envContent, 'utf8');
  console.log('App .env updated: ' + newUrl);
}

// Auto-update API .env CORS with new IP
const apiEnvPath = path.join(__dirname, '..', 'api3', '.env');
if (fs.existsSync(apiEnvPath)) {
  let apiEnv = fs.readFileSync(apiEnvPath, 'utf8');
  apiEnv = apiEnv.replace(/CORS_ORIGINS=[^\n]+/, 'CORS_ORIGINS=http://' + ip + ':8081,exp://' + ip + ':8081,http://' + ip + ':3000');
  fs.writeFileSync(apiEnvPath, apiEnv, 'utf8');
  console.log('API CORS updated for ' + ip);
}

// Kill and restart API on port 3000
const { execSync } = require('child_process');
try {
  execSync('FOR /F "tokens=5" %P IN (\'netstat -ano ^| findstr ":3000.*LISTENING"\') DO taskkill /PID %P /F', { shell: 'cmd', stdio: 'ignore' });
} catch (_) {}

setTimeout(() => {
  const api = spawn('node', ['src/server.js'], {
    cwd: path.join(__dirname, '..', 'api3'),
    stdio: 'ignore',
    detached: true,
    shell: false,
  });
  api.unref();
  console.log('API restarted on port 3000');
}, 2000);

process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.EXPO_NO_AUTH = '1';

console.log('Starting Expo...');
const expo = spawn('npx', ['expo', 'start', '--lan', '-c'], {
  stdio: 'inherit',
  shell: true,
});

expo.on('exit', (code) => {
  process.exit(code);
});
