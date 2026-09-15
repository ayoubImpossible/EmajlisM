'use strict';

/**
 * Drive Manager — relais fidèle vers /emajlis/drive/*.
 *
 * Comble BG-04. L'ancienne implémentation (/api/feed/drive/:cid) interrogeait
 * le module `cfiles`, qui est un module DIFFÉRENT :
 *     cfiles/files/container/37   ->  0 fichier
 *     emajlis/drive/container/37  ->  arborescence complète
 * Les 3 587 documents du Drive étaient donc invisibles depuis le mobile.
 *
 * Principe : on ne remodèle pas les réponses de HumHub. Elles portent déjà
 * `breadcrumb`, `permissions`, `human_size`, `api_download_url`. Toute
 * transformation ici serait une occasion de diverger.
 */

const { http, asUser } = require('../services/humhub');

/** Réécrit les chemins de téléchargement HumHub vers les routes Express. */
function rewriteDownloadPaths(payload) {
  const fix = (file) => {
    if (file && typeof file === 'object' && file.id != null) {
      file.api_download_url = `/api/drive/file/${file.id}/download`;
    }
    return file;
  };

  if (Array.isArray(payload?.files)) payload.files.forEach(fix);
  if (payload?.file) fix(payload.file);
  return payload;
}

// GET /api/drive/container/:containerId
exports.browse = async (req, res, next) => {
  const params = {};
  for (const key of ['folderId', 'q', 'sort', 'dir']) {
    if (req.query[key]) params[key] = req.query[key];
  }

  try {
    const { data } = await http.get(`/emajlis/drive/container/${req.params.containerId}`, {
      ...asUser(req.humhubToken), params,
    });
    res.json(rewriteDownloadPaths(data));
  } catch (err) { next(err); }
};

// GET /api/drive/folder/:id
exports.folder = async (req, res, next) => {
  try {
    const { data } = await http.get(`/emajlis/drive/folder/${req.params.id}`, asUser(req.humhubToken));
    res.json(data);
  } catch (err) { next(err); }
};

// GET /api/drive/file/:id
exports.file = async (req, res, next) => {
  try {
    const { data } = await http.get(`/emajlis/drive/file/${req.params.id}`, asUser(req.humhubToken));
    res.json(rewriteDownloadPaths(data));
  } catch (err) { next(err); }
};

// GET /api/drive/settings/container/:containerId
exports.settings = async (req, res, next) => {
  try {
    const { data } = await http.get(
      `/emajlis/drive/settings/container/${req.params.containerId}`,
      asUser(req.humhubToken),
    );
    res.json(data);
  } catch (err) { next(err); }
};

/**
 * GET /api/drive/file/:id/download
 *
 * Relais en flux : le fichier n'est jamais chargé en mémoire, et les en-têtes
 * de type et de nom sont conservés. Le mobile envoie son jeton comme sur
 * n'importe quelle autre route — c'est ce qui manquait (P0-07).
 */
exports.download = async (req, res, next) => {
  try {
    const upstream = await http.get(`/emajlis/drive/file/${req.params.id}/download`, {
      ...asUser(req.humhubToken),
      params: req.query.inline ? { inline: 1 } : undefined,
      responseType: 'stream',
    });

    for (const header of ['content-type', 'content-length', 'content-disposition']) {
      const value = upstream.headers[header];
      if (value) res.setHeader(header, value);
    }

    upstream.data.on('error', (err) => {
      if (!res.headersSent) res.status(502).json({ error: 'Téléchargement interrompu.' });
      else res.destroy(err);
    });

    upstream.data.pipe(res);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Fichier introuvable.' });
    if (status === 403) return res.status(403).json({ error: 'Accès refusé à ce fichier.' });
    next(err);
  }
};

// POST /api/drive/container/:containerId/folder
exports.createFolder = async (req, res, next) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Le paramètre "name" est requis.' });

  try {
    const { data } = await http.post(
      `/emajlis/drive/container/${req.params.containerId}/folder`,
      { name, parentId: req.body.parentId || null },
      asUser(req.humhubToken),
    );
    res.status(201).json(data);
  } catch (err) {
    if (err.response?.status === 403) {
      return res.status(403).json({ error: "Vous n'avez pas le droit de créer un dossier ici." });
    }
    next(err);
  }
};
