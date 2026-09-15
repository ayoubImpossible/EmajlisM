/**
 * Drive Manager.
 *
 * Corrigé le 10/09/2026 :
 *   - l'application appelait /api/feed/drive/:cid, qui relayait vers `cfiles` —
 *     un autre module, aux dossiers différents. Le vrai module est
 *     `drive-manager`, exposé par /api/drive/container/:cid ;
 *   - l'URL de téléchargement était construite à la main vers
 *     /api/v1/file/download/{id} et ouverte par Linking : le navigateur du
 *     téléphone ne porte pas le jeton, donc le serveur répondait 401 sur tout
 *     fichier non public. Le téléchargement passe maintenant par
 *     utils/files.js, qui envoie l'en-tête d'autorisation.
 */

import api from './client';

/** Contenu d'un dossier. `containerId` est le contentcontainer_id de l'espace. */
export async function browse(containerId, folderId = null) {
  const { data } = await api.get(`/drive/container/${containerId}`, {
    params: folderId ? { folderId } : {},
  });
  return data;
}

/** Métadonnées d'un fichier. */
export async function getFile(fileId) {
  const { data } = await api.get(`/drive/file/${fileId}`);
  return data;
}

/**
 * Chemin de téléchargement, relatif à l'API.
 * Le serveur le donne déjà dans `file.api_download_url` : préférez ce champ.
 */
export function downloadPath(fileId) {
  return `/drive/file/${fileId}/download`;
}
