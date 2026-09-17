'use strict';

const axios = require('axios');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.HUMHUB_BASE_URL || 'https://emajlis-dev.csefrs.ma').replace(/\/+$/, '');
const API = `${BASE}/api/v1`;

const INSECURE = process.env.HUMHUB_INSECURE_TLS === '1';
const IS_PROD = process.env.NODE_ENV === 'production';

if (INSECURE && IS_PROD) {
  throw new Error(
    'HUMHUB_INSECURE_TLS=1 est refusé en production. ' +
    'Complétez la chaîne du certificat plutôt que de désactiver la vérification.',
  );
}
if (INSECURE) {
  console.warn(
    '\n⚠️  Vérification TLS DÉSACTIVÉE pour les appels HumHub (HUMHUB_INSECURE_TLS=1).\n' +
    '   À n\'utiliser qu\'en développement local, jamais en production.\n',
  );
}

// ── Certificats intermédiaires fournis par l'application ─────────────────────
const CA_DIR = path.resolve(__dirname, '..', '..', 'certs');

function loadExtraCas() {
  const files = [];
  const explicit = process.env.HUMHUB_CA_FILE;

  if (explicit) {
    files.push(path.resolve(explicit));
  } else if (fs.existsSync(CA_DIR)) {
    for (const name of fs.readdirSync(CA_DIR).sort()) {
      if (/\.(pem|crt|cer)$/i.test(name)) files.push(path.join(CA_DIR, name));
    }
  }

  const pems = [];
  const loaded = [];
  for (const file of files) {
    try {
      const pem = fs.readFileSync(file, 'utf8');
      if (!/-----BEGIN CERTIFICATE-----/.test(pem)) {
        console.warn(`[tls] ${path.basename(file)} ignoré : ce n'est pas un certificat PEM.`);
        continue;
      }
      pems.push(pem);
      loaded.push(path.basename(file));
    } catch (err) {
      console.warn(`[tls] lecture impossible de ${file} : ${err.message}`);
    }
  }
  return { pems, loaded };
}

const extraCas = INSECURE ? { pems: [], loaded: [] } : loadExtraCas();

if (!INSECURE && extraCas.loaded.length) {
  console.log(`[tls] chaîne complétée avec : ${extraCas.loaded.join(', ')}`);
}

const httpsAgent = INSECURE
  ? new https.Agent({ 
      rejectUnauthorized: false, 
      keepAlive: true, 
      maxSockets: 20, 
      maxFreeSockets: 5,
      timeout: 30000, // 30s connection timeout
      keepAliveMsecs: 1000, // Send keep-alive probes every 1s
    })
  : new https.Agent({
      keepAlive: true,
      maxSockets: 20,
      maxFreeSockets: 5,
      timeout: 30000, // 30s connection timeout
      keepAliveMsecs: 1000, // Send keep-alive probes every 1s
      // Les racines de Node RESTENT dans la liste : on ajoute, on ne remplace pas.
      ...(extraCas.pems.length ? { ca: [...tls.rootCertificates, ...extraCas.pems] } : {}),
    });

const http = axios.create({
  baseURL: API,
  timeout: Number(process.env.HUMHUB_TIMEOUT_MS) || 30000,  // 30 seconds per request
  httpsAgent,
  headers: { Accept: 'application/json' },
  // Ensure sockets are destroyed on errors to prevent connection leaks
  decompress: true,
  maxRedirects: 5,
  maxContentLength: 50 * 1024 * 1024, // 50MB
});

/**
 * HumHub renvoie 404 lorsqu'une URL se termine par un slash
 * (le normaliseur d'URL de Yii n'est pas activé sur cette installation).
 */
http.interceptors.request.use((config) => {
  if (config.url && config.url.length > 1) {
    config.url = config.url.replace(/\/+$/, '');
  }
  return config;
});

/** Log les timeouts réseau pour faciliter le diagnostic. */
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.warn('[humhub] request timed out:', error.config?.url);
    }
    return Promise.reject(error);
  },
);

/** En-tête d'autorisation pour le jeton d'un utilisateur. */
const asUser = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

/**
 * GET qui ne lève pas : renvoie null sur 404 / 403 / erreur réseau.
 * Utile pour l'enrichissement, où l'absence d'un élément ne doit jamais faire
 * échouer la page entière.
 */
async function tryGet(url, token, params) {
  try {
    const { data } = await http.get(url, { ...asUser(token), ...(params ? { params } : {}) });
    return data;
  } catch (err) {
    // Log non-404 errors for debugging
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
      console.warn(`[tryGet] ${url} - connection issue: ${err.code}`);
    } else if (err.response && ![404, 403].includes(err.response.status)) {
      console.warn(`[tryGet] ${url} - HTTP ${err.response.status}`);
    }
    return null;
  }
}

/** État TLS, pour /health : jamais le contenu des certificats. */
const tlsStatus = () => ({
  verification: INSECURE ? 'DESACTIVEE' : 'active',
  extraChainFiles: extraCas.loaded,
});

module.exports = { http, API, BASE, asUser, tryGet, INSECURE, httpsAgent, tlsStatus };
