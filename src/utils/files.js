/**
 * Téléchargement et ouverture de fichiers.
 *
 * Deux actions distinctes :
 *
 *  openFileInApp(file, onProgress)
 *    → Télécharge le fichier avec authentification, puis l'ouvre DANS l'application.
 *      PDF     : expo-web-browser (visionneuse intégrée iOS/Android).
 *      Images  : expo-web-browser.
 *      Autres  : feuille de partage système (« Ouvrir avec »).
 *
 *  downloadAuthenticatedFile(file, onProgress)
 *    → Télécharge le fichier avec authentification, puis propose à l'utilisateur
 *      de l'enregistrer / partager via la feuille de partage système.
 *      C'est l'action du bouton « Télécharger ».
 */

import * as Sharing from 'expo-sharing';
import { API_URL, BASE_URL } from '../config/env';
import { authHeaders } from '../api/client';

// expo-file-system — utilisé uniquement pour cacheDirectory, writeAsStringAsync
// et EncodingType. On n'utilise plus createDownloadResumable : son gestionnaire
// de téléchargement natif (NSURLSession / DownloadManager) supprime silencieusement
// les en-têtes HTTP personnalisés sur certaines versions du SDK, ce qui fait
// échouer toute requête authentifiée sans réponse HTTP. On télécharge désormais
// via fetch() (moteur JS, en-têtes toujours honorés) et on écrit le corps en
// base64 avec writeAsStringAsync.
let FS;
try {
  FS = require('expo-file-system/legacy');
} catch (_) {
  FS = require('expo-file-system');
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Retire d'un nom de fichier tout ce qui gênerait le système de fichiers. */
function safeName(name, fallback = 'document') {
  const cleaned = String(name || '')
    .replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/** Extension déduite du type MIME quand le nom n'en porte pas. */
const EXT_BY_MIME = {
  'application/pdf':                                                              'pdf',
  'application/msword':                                                           'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':     'docx',
  'application/vnd.ms-excel':                                                     'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':           'xlsx',
  'application/vnd.ms-powerpoint':                                                'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':   'pptx',
  'image/jpeg':  'jpg',
  'image/png':   'png',
  'image/gif':   'gif',
  'image/webp':  'webp',
  'text/plain':  'txt',
  'application/zip': 'zip',
};

/** UTI iOS pour guider la visionneuse native lors de shareAsync. */
function mimeToUTI(mimeType) {
  const map = {
    'application/pdf': 'com.adobe.pdf',
    'image/jpeg': 'public.jpeg',
    'image/png': 'public.png',
    'image/gif': 'com.compuserve.gif',
    'image/webp': 'public.webp',
    'application/msword': 'com.microsoft.word.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'org.openxmlformats.wordprocessingml.document',
    'application/vnd.ms-excel': 'com.microsoft.excel.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'org.openxmlformats.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint': 'com.microsoft.powerpoint.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'org.openxmlformats.presentationml.presentation',
    'text/plain': 'public.plain-text',
  };
  return map[mimeType] || undefined;
}

/** Types MIME qui peuvent s'ouvrir directement dans expo-web-browser. */
const VIEWABLE_MIME = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'text/html',
]);

function isViewable(mimeType) {
  return VIEWABLE_MIME.has(mimeType) || /^image\//i.test(mimeType || '');
}

// ─── core download ──────────────────────────────────────────────────────────

/**
 * Télécharge un fichier protégé dans le cache de l'application.
 * @returns {Promise<{ok: boolean, uri?: string, status?: number, reason?: string}>}
 */
async function fetchToCache(file, onProgress) {
  const relative = file?.api_download_url || (file?.id ? `/api/drive/file/${file.id}/download` : null);
  if (!relative) return { ok: false, reason: 'Aucune adresse de téléchargement pour ce fichier.' };

  // api_download_url commence déjà par /api/... → on colle sur BASE_URL (sans /api).
  // Un chemin relatif sans /api (repli interne) → on colle sur API_URL.
  const url = /^https?:\/\//i.test(relative)
    ? relative
    : relative.startsWith('/api/')
      ? `${BASE_URL}${relative}`
      : `${API_URL}${relative}`;
  const headers = await authHeaders();
  if (!headers.Authorization) return { ok: false, reason: 'Session expirée. Reconnectez-vous.' };

  let name = safeName(file.title || file.file_name || 'document');
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    const ext = EXT_BY_MIME[file.mime_type];
    if (ext) name = `${name}.${ext}`;
  }

  const target = `${FS.cacheDirectory}${Date.now()}-${encodeURIComponent(name)}`;

  try {
    // fetch() utilise le moteur JS — les en-têtes Authorization sont toujours
    // transmis, contrairement au gestionnaire natif de createDownloadResumable.
    const response = await fetch(url, { headers });

    if (response.status === 401) return { ok: false, reason: 'Session expirée. Reconnectez-vous.' };
    if (response.status === 403) return { ok: false, reason: "Vous n'avez pas accès à ce fichier." };
    if (response.status === 404) return { ok: false, reason: 'Fichier introuvable sur le serveur.' };
    if (response.status >= 400) return { ok: false, reason: `Le serveur a refusé le téléchargement (${response.status}).` };
    if (!response.ok) return { ok: false, reason: 'Téléchargement interrompu.' };

    // Lecture du corps en base64 puis écriture dans le cache de l'application.
    const blob = await response.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result = "data:<mime>;base64,<data>" — on garde uniquement <data>
        const result = reader.result;
        const comma = result.indexOf(',');
        resolve(comma !== -1 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await FS.writeAsStringAsync(target, base64, {
      encoding: FS.EncodingType.Base64,
    });

    if (onProgress) onProgress(1);
    return { ok: true, uri: target, name };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Serveur injoignable. Vérifiez votre connexion.' };
  }
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Retourne l'URL absolue et les headers d'auth pour ouvrir un fichier
 * directement dans la WebView (sans passer par le cache local).
 * Appelé quand l'utilisateur tape sur l'icône œil.
 */
export async function openFileInApp(file) {
  const relative = file?.api_download_url || (file?.id ? `/api/drive/file/${file.id}/download` : null);
  if (!relative) return { ok: false, reason: 'Aucune adresse de téléchargement pour ce fichier.' };

  const url = /^https?:\/\//i.test(relative)
    ? relative
    : relative.startsWith('/api/')
      ? `${BASE_URL}${relative}`
      : `${API_URL}${relative}`;

  const headers = await authHeaders();
  if (!headers.Authorization) return { ok: false, reason: 'Session expirée. Reconnectez-vous.' };

  // On ajoute ?inline=1 pour que le serveur envoie Content-Disposition: inline
  // (affichage dans la WebView plutôt que téléchargement).
  const viewUrl = url.includes('?') ? `${url}&inline=1` : `${url}?inline=1`;

  return { ok: true, url: viewUrl, headers };
}

/**
 * Télécharge un fichier et propose à l'utilisateur de l'enregistrer / partager.
 * C'est l'action du bouton « Télécharger » (icône nuage).
 *
 * Appelé quand l'utilisateur tape sur l'icône de téléchargement.
 */
export async function downloadAuthenticatedFile(file, onProgress) {
  const fetched = await fetchToCache(file, onProgress);
  if (!fetched.ok) return fetched;

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fetched.uri, {
        mimeType: file.mime_type || undefined,
        dialogTitle: fetched.name,
        UTI: mimeToUTI(file.mime_type),
      });
      return { ok: true, uri: fetched.uri };
    }
    return { ok: false, reason: 'Le partage de fichiers n\'est pas disponible sur cet appareil.' };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Le téléchargement a échoué.' };
  }
}

/** « 1.18 Mo » — repli si le serveur ne renvoie pas human_size. */
export function humanSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
