/* Inspecte la chaine TLS presentee par HumHub. Lecture seule : aucune modification serveur. */
'use strict';
const tls = require('tls');
const host = process.argv[2] || 'emajlis-dev.csefrs.ma';

const sock = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
  let cert = sock.getPeerCertificate(true);
  const seen = new Set();
  let depth = 0;
  console.log('Chaine presentee par le serveur :');
  while (cert && !seen.has(cert.fingerprint256)) {
    seen.add(cert.fingerprint256);
    console.log(`  [${depth}] sujet   : ${cert.subject?.CN || JSON.stringify(cert.subject)}`);
    console.log(`      emetteur: ${cert.issuer?.CN || JSON.stringify(cert.issuer)}`);
    console.log(`      validite: ${cert.valid_from} -> ${cert.valid_to}`);
    if (cert.subjectaltname) console.log(`      SAN     : ${String(cert.subjectaltname).slice(0, 160)}`);
    if (cert.infoAccess) console.log(`      AIA     : ${JSON.stringify(cert.infoAccess)}`);
    const next = cert.issuerCertificate;
    if (!next || next === cert) break;
    cert = next; depth++;
  }
  console.log(`\nNombre de certificats envoyes : ${seen.size}`);
  console.log(`Verification standard : ${sock.authorized ? 'OK' : 'ECHEC — ' + sock.authorizationError}`);
  sock.end(); process.exit(0);
});
sock.on('error', (e) => { console.error('ERREUR', e.message); process.exit(1); });
