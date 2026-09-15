'use strict';

/**
 * E-Services — relais vers le module HumHub `emajlis-api`.
 *
 * CORRECTION DU 10/09 (P0-09) : le catalogue était CODÉ EN DUR, avec ce
 * commentaire — « Static catalog — the HumHub custom eservice module is not
 * installed ». Le module EST installé et /emajlis/eservice/catalog répond 200.
 *
 * Deux valeurs de statut sur quatre étaient fausses :
 *     Express « processing »  ->  HumHub « in_progress »
 *     Express « completed »   ->  HumHub « approved »
 * Un changement de statut depuis le mobile était donc rejeté par HumHub
 * (400 Statut invalide) et un filtre sur « processing » ne renvoyait rien.
 * Le type « indemnite » (Dépôt de documents) manquait également.
 *
 * Le catalogue est désormais lu sur le serveur, seule source de vérité. Une
 * table de correspondance traduit les anciennes valeurs pour ne pas casser les
 * écrans mobiles qui les envoient encore.
 */

const { http, asUser } = require('../services/humhub');

/** Anciennes valeurs de statut du backend -> valeurs réelles de HumHub. */
const LEGACY_STATUS = {
  processing: 'in_progress',
  completed: 'approved',
};

const normalizeStatus = (value) => LEGACY_STATUS[value] || value;

// ── GET /api/eservices/catalog ────────────────────────────────────────────────
exports.getCatalog = async (req, res, next) => {
  // Pas de cache ici : la réponse contient `is_manager`, qui dépend de
  // l'utilisateur. Un cache partagé fuiterait l'habilitation d'un compte à un
  // autre. L'appel est unique et rapide.
  try {
    const { data } = await http.get('/emajlis/eservice/catalog', asUser(req.humhubToken));
    res.json(data);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(503).json({
        error: 'Le module E-Services est indisponible sur le serveur.',
        detail: 'Vérifier Administration > Modules > REST API > Configuration.',
      });
    }
    next(err);
  }
};

// ── GET /api/eservices/requests ───────────────────────────────────────────────
exports.mesDemandes = async (req, res, next) => {
  const params = { ...req.query };
  if (params.status) params.status = normalizeStatus(params.status);

  try {
    const { data } = await http.get('/emajlis/eservice/requests', {
      ...asUser(req.humhubToken), params,
    });
    res.json(data);
  } catch (err) {
    if (err.response?.status === 400) return res.status(400).json(err.response.data);
    next(err);
  }
};

exports.adminList = exports.mesDemandes;

// ── GET /api/eservices/request/:id ────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const { data } = await http.get(`/emajlis/eservice/request/${req.params.id}`, asUser(req.humhubToken));
    res.json(data);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Demande introuvable.' });
    if (status === 403) return res.status(403).json({ error: 'Accès refusé à cette demande.' });
    next(err);
  }
};

// ── POST /api/eservices/request ───────────────────────────────────────────────
exports.createRequest = async (req, res, next) => {
  const payload = { ...(req.body || {}) };
  // Le serveur ignore ces champs, mais autant ne pas les envoyer.
  delete payload.user_id;
  delete payload.status;
  delete payload.admin_comment;

  try {
    const { data } = await http.post('/emajlis/eservice/request', payload, asUser(req.humhubToken));
    res.status(201).json(data);
  } catch (err) {
    if (err.response?.status === 400) return res.status(400).json(err.response.data);
    next(err);
  }
};

// ── POST /api/eservices/request/:id/status ────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  const body = { ...(req.body || {}) };
  if (body.status) body.status = normalizeStatus(body.status);

  try {
    const { data } = await http.post(
      `/emajlis/eservice/request/${req.params.id}/status`,
      body,
      asUser(req.humhubToken),
    );
    res.json(data);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403) {
      return res.status(403).json({ error: 'Seul un gestionnaire E-Services peut changer un statut.' });
    }
    if (status === 400) return res.status(400).json(err.response.data);
    if (status === 404) return res.status(404).json({ error: 'Demande introuvable.' });
    next(err);
  }
};

// ── Formulaires hérités ───────────────────────────────────────────────────────
// Conservés : cinq écrans mobiles les appellent encore. Ils seront retirés
// lorsque le formulaire dynamique construit depuis `fields_by_type` les
// remplacera. Ne pas supprimer avant.
exports.submitHebergement = (req, res, next) => {
  req.body = {
    type: 'hebergement',
    event_name: req.body.type_reunion,
    date_start: req.body.date_arrivee,
    date_end: req.body.date_depart,
    shuttle_arrival: req.body.shuttle_arrival,
    shuttle_departure: req.body.shuttle_departure,
    observations: req.body.observations,
  };
  exports.createRequest(req, res, next);
};

exports.submitBillet = (req, res, next) => {
  req.body = {
    type: 'billet_avion',
    event_name: req.body.destination,
    date_start: req.body.date_depart,
    date_end: req.body.date_retour,
    flight_plan: req.body.classe,
    observations: req.body.observations,
  };
  exports.createRequest(req, res, next);
};

exports.submitDocumentation = (req, res, next) => {
  req.body = { type: 'document', sub_type: req.body.sub_type, observations: req.body.observations };
  exports.createRequest(req, res, next);
};

exports.submitSupport = (req, res, next) => {
  req.body = {
    type: 'support',
    observations: `${req.body.sujet || ''}\n${req.body.description || ''}`.trim(),
  };
  exports.createRequest(req, res, next);
};
