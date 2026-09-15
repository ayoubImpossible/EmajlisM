/**
 * Téléchargement de fichiers.
 *
 * Le problème corrigé : DriveScreen lisait le jeton, puis appelait
 * `Linking.openURL(url)` sans s'en servir. Le navigateur du téléphone n'a pas la
 * session de l'application, donc le serveur répondait 401 et l'utilisateur
 * voyait une page d'erreur — ou, sur un fichier public, un téléchargement qui
 * marchait « parfois », ce qui est pire.
 *
 * Ici, le fichier est récupéré par l'application, avec son en-tête
 * d'autorisation, puis remis au système (feuille de partage / ouvrir avec).
 */

import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { API_URL } from '../config/env';
import { authHeaders } from '../api/client';

// expo-file-system a changé d'API en SDK 54. L'ancienne, qui accepte des
// en-têtes sur le téléchargement, reste disponible sous /legacy.
let FS;
try {
  // eslint-disable-next-line global-require
  FS = require('expo-file-system/legacy');
} catch (_) {
  // eslint-disable-next-line global-require
  FS = require('expo-file-system');
}

/** Retire d'un nom de fichier tout ce qui gênerait le système de fichiers. */
function safeName(name, fallback = 'document') {
  const cleaned = String(name || '')
    .replace(/[/\\?%*:|"<>\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

/** Extension déduite du type MIME, quand le nom n'en porte pas. */
const EXT_BY_MIME = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

/**
 * Télécharge un fichier protégé et le propose à l'utilisateur.
 *
 * @param {object}   file        élément renvoyé par l'API Drive
 * @param {string}   file.api_download_url  chemin relatif fourni par le serveur
 * @param {string}   file.title  nom affiché
 * @param {string}   file.mime_type
 * @param {function} [onProgress] reçoit un nombre entre 0 et 1
 * @returns {Promise<{ok: boolean, uri?: string, reason?: string}>}
 */
export async function downloadAuthenticatedFile(file, onProgress) {
  const relative = file?.api_download_url || (file?.id ? `/drive/file/${file.id}/download` : null);
  if (!relative) return { ok: false, reason: 'Aucune adresse de téléchargement pour ce fichier.' };

  const url = /^https?:\/\//i.test(relative) ? relative : `${API_URL}${relative}`;
  const headers = await authHeaders();
  if (!headers.Authorization) return { ok: false, reason: 'Session expirée. Reconnectez-vous.' };

  let name = safeName(file.title || file.file_name || 'document');
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    const ext = EXT_BY_MIME[file.mime_type];
    if (ext) name = `${name}.${ext}`;
  }

  const target = `${FS.cacheDirectory}${Date.now()}-${encodeURIComponent(name)}`;

  try {
    const task = FS.createDownloadResumable(
      url,
      target,
      { headers },
      onProgress
        ? (p) => {
            const total = p.totalBytesExpectedToWrite;
            if (total > 0) onProgress(p.totalBytesWritten / total);
          }
        : undefined,
    );

    const result = await task.downloadAsync();
    if (!result) return { ok: false, reason: 'Téléchargement interrompu.' };

    if (result.status === 401) return { ok: false, reason: 'Session expirée. Reconnectez-vous.' };
    if (result.status === 403) return { ok: false, reason: "Vous n'avez pas accès à ce fichier." };
    if (result.status === 404) return { ok: false, reason: 'Fichier introuvable sur le serveur.' };
    if (result.status >= 400) return { ok: false, reason: `Le serveur a refusé le téléchargement (${result.status}).` };

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        mimeType: file.mime_type || undefined,
        dialogTitle: name,
        UTI: file.mime_type === 'application/pdf' ? 'com.adobe.pdf' : undefined,
      });
      return { ok: true, uri: result.uri };
    }

    // Pas de feuille de partage (web) : on ouvre le fichier local.
    await WebBrowser.openBrowserAsync(result.uri);
    return { ok: true, uri: result.uri };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Le téléchargement a échoué.' };
  }
}

/** « 1.18 Mo » — le serveur envoie déjà `human_size`, ceci n'est qu'un repli. */
export function humanSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
