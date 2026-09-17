'use strict';

/**
 * Commentaires et likes — comble BG-06 et BG-07.
 *
 * Ces deux familles d'endpoints existent côté HumHub mais n'étaient pas
 * exposées : le bloc social des écrans de détail ne pouvait donc rien afficher
 * ni envoyer.
 *
 * Note sur les likes : l'API REST standard de HumHub sait lire et supprimer un
 * like mais ne sait PAS en créer. C'est le module custom `emajlis-api` qui
 * fournit la création, sur /emajlis/like. Un repli est prévu si ce module est
 * désactivé.
 *
 * Note d'encodage : le paramètre `model` contient des antislashs
 * (humhub\modules\post\models\Post). axios les encode correctement en query ;
 * en revanche il ne faut PAS les ré-échapper à la main.
 */

const { http, asUser } = require('../services/humhub');

// ── Commentaires ──────────────────────────────────────────────────────────────

// GET /api/comments/content/:contentId
exports.listComments = async (req, res, next) => {
  try {
    const { data } = await http.get(`/comment/content/${req.params.contentId}`, {
      ...asUser(req.humhubToken),
      params: {
        page: Math.max(parseInt(req.query.page, 10) || 1, 1),
        limit: Math.min(parseInt(req.query.limit, 10) || 25, 100),
      },
    });
    res.json(data);
  } catch (err) {
    if (err.response?.status === 404) return res.json({ total: 0, results: [] });
    next(err);
  }
};

/**
 * POST /api/comments   { model, pk, message }
 *
 * Forme exacte attendue par HumHub, trouvée par sondage le 11/09/2026
 * (test/probe-comment3.js) : les identifiants de l'objet passent en paramètres
 * d'URL sous les noms `objectModel` et `objectId`, et le message doit être
 * enveloppé dans `Comment` — le nom de formulaire du modèle Yii.
 *
 * Ce que les autres formes donnent, mesuré :
 *   { model, pk, data: { message } }        -> 500 (objet non résolu)
 *   ?objectModel&objectId + { message }     -> 400 « le commentaire ne doit pas être vide »
 *   ?objectModel&objectId + { Comment: { message } } -> 200  ← la bonne
 *
 * Ce n'est documenté nulle part ; d'où le commentaire, pour que personne n'ait
 * à refaire la recherche.
 */
exports.createComment = async (req, res, next) => {
  const { model, pk, message } = req.body || {};
  if (!model || !pk) return res.status(400).json({ error: 'Les paramètres "model" et "pk" sont requis.' });
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Le commentaire ne peut pas être vide.' });
  }

  try {
    const { data } = await http.post(
      '/comment',
      { Comment: { message: String(message).trim() } },
      { ...asUser(req.humhubToken), params: { objectModel: model, objectId: pk } },
    );
    res.status(201).json(data);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) return res.status(403).json({ error: 'Vous ne pouvez pas commenter ce contenu.' });
    if (status === 400) {
      return res.status(400).json({
        error: 'Commentaire refusé par le serveur.',
        details: err.response.data,
      });
    }
    if (status === 500) {
      // 500 sur cette route = objet introuvable côté HumHub, pas une panne.
      return res.status(404).json({
        error: "Le contenu commenté est introuvable (model ou pk incorrect).",
        model, pk,
      });
    }
    next(err);
  }
};

// DELETE /api/comments/:id
exports.deleteComment = async (req, res, next) => {
  try {
    const { data } = await http.delete(`/comment/${req.params.id}`, asUser(req.humhubToken));
    res.json(data);
  } catch (err) {
    if (err.response?.status === 403) {
      return res.status(403).json({ error: 'Vous ne pouvez pas supprimer ce commentaire.' });
    }
    next(err);
  }
};

// ── Likes ─────────────────────────────────────────────────────────────────────

// GET /api/likes/status?model=&pk=
exports.likeStatus = async (req, res, next) => {
  const { model, pk } = req.query;
  if (!model || !pk) return res.status(400).json({ error: 'Les paramètres "model" et "pk" sont requis.' });

  try {
    const { data } = await http.get('/emajlis/like/status', {
      ...asUser(req.humhubToken),
      params: { model, pk },
    });
    return res.json(data);
  } catch (err) {
    if (err.response?.status !== 404) return next(err);
  }

  // Repli : l'API standard sait lister les likes d'un objet.
  try {
    const { data } = await http.get('/like/find-by-object', {
      ...asUser(req.humhubToken),
      params: { model, pk },
    });
    res.json({ counter: data.total ?? 0, currentUserLiked: null, degraded: true });
  } catch (err) {
    if (err.response?.status === 404) return res.json({ counter: 0, currentUserLiked: false });
    next(err);
  }
};

// POST /api/likes/batch   { items: [{model, pk}, ...] }
// Batch endpoint to fetch multiple like statuses in one request
exports.likeBatchStatus = async (req, res, next) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Parameter "items" must be a non-empty array of {model, pk}' });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 items per batch request' });
  }

  const results = {};
  const token = req.humhubToken;
  
  // Fetch with concurrency limit to avoid overwhelming HumHub
  const { mapLimit } = require('../services/cache');
  await mapLimit(items, 5, async (item) => {
    const { model, pk } = item;
    if (!model || !pk) return;
    
    const key = `${model}:${pk}`;
    try {
      const { data } = await http.get('/emajlis/like/status', {
        ...asUser(token),
        params: { model, pk },
        timeout: 3000, // Faster timeout for batch
      });
      results[key] = data;
    } catch (err) {
      // Return zero counter on error so app doesn't break
      results[key] = { counter: 0, currentUserLiked: false, error: true };
    }
  });

  res.json({ results });
};

// POST /api/likes   { model, pk }
exports.like = async (req, res, next) => {
  const { model, pk } = req.body || {};
  if (!model || !pk) return res.status(400).json({ error: 'Les paramètres "model" et "pk" sont requis.' });

  try {
    const { data } = await http.post('/emajlis/like', { model, pk }, asUser(req.humhubToken));
    res.status(data.code === 201 ? 201 : 200).json(data);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      return res.status(501).json({
        error: "L'ajout de like nécessite le module emajlis-api, actuellement indisponible.",
      });
    }
    if (status === 403) return res.status(403).json({ error: 'Vous ne pouvez pas aimer ce contenu.' });
    if (status === 400) return res.status(400).json({ error: 'Objet invalide.' });
    next(err);
  }
};

// DELETE /api/likes   { model, pk }
exports.unlike = async (req, res, next) => {
  const { model, pk } = req.body || {};
  if (!model || !pk) return res.status(400).json({ error: 'Les paramètres "model" et "pk" sont requis.' });

  try {
    const { data } = await http.delete('/emajlis/like', { ...asUser(req.humhubToken), data: { model, pk } });
    res.json(data);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(501).json({
        error: 'Le retrait de like nécessite le module emajlis-api, actuellement indisponible.',
      });
    }
    next(err);
  }
};
