'use strict';

/**
 * Annuaire général des utilisateurs.
 *
 * ATTENTION : ce contrôleur répond l'annuaire COMPLET de la plateforme. Il ne
 * doit pas servir à afficher les membres d'un espace — c'est
 * /api/spaces/:id/members qui le fait (voir docs/EMajlis-Mobile-Audit.md, P0-05 :
 * l'écran « membres de l'espace » appelait cet endpoint-ci).
 *
 * Modification du 10/09/2026 : passe par le client unique services/humhub.js.
 * Le mappage n'a pas été touché.
 */

const { http, asUser } = require('../services/humhub');

/** Convertit un utilisateur HumHub vers la forme attendue par l'application. */
function mapUser(u) {
  const account = u.account || {};
  const profile = u.profile || {};
  const tags = account.tags || [];
  return {
    id:          u.id,
    guid:        u.guid,
    display_name: u.display_name,
    username:    account.username,
    email:       account.email,
    prenom_fr:   profile.firstname,
    nom_fr:      profile.lastname,
    titre:       profile.title,
    about:       profile.about,
    phone_work:  profile.phone_work,
    mobile:      profile.mobile,
    image_url:   profile.image_url || null,
    banner_url:  profile.banner_url || null,
    tags,
    // Déduction à partir des étiquettes : HumHub ne renvoie pas de commission.
    commission_fr: tags.find((t) => t.startsWith('CP')) || null,
    categorie_fr:  null,
    last_login:  account.last_login,
  };
}


/**
 * Mesuré le 11/09/2026 : `/user` et `/user/{id}` répondent **401 à un membre
 * ordinaire**. HumHub réserve l'annuaire global de l'API REST aux
 * administrateurs. Ce n'est pas un défaut de configuration de cette couche :
 * c'est la règle d'accès de HumHub.
 *
 * Conséquence pour le mobile : il n'existe pas d'annuaire général. Les membres
 * se consultent espace par espace, via `/api/spaces/:id/members`, qui repose sur
 * `/space/{id}/membership` — accessible, lui, à tout membre de l'espace.
 *
 * On le dit franchement au client plutôt que de relayer un « 401 » nu, pour que
 * l'application affiche une explication et non un échec inexpliqué.
 * Voir docs/EMajlis-Mobile-Backend-Gaps.md, BG-14.
 */
function directoryForbidden(res) {
  return res.status(403).json({
    error: "L'annuaire général n'est pas ouvert par l'API : HumHub le réserve aux administrateurs.",
    reason: 'humhub_admin_only',
    alternative: '/api/spaces/:id/members',
  });
}

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 15, 100);
    const params = { page, limit: perPage };
    if (req.query.search) params.search = req.query.search;

    const { data } = await http.get('/user', {
      params,
      ...(req.humhubToken ? asUser(req.humhubToken) : {}),
      timeout: 10000,
    });

    const results = (data.results || []).map(mapUser);

    res.json({
      data:      results,
      total:     data.total || results.length,
      page,
      per_page:  perPage,
      last_page: data.total ? Math.ceil(data.total / perPage) : 1,
    });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) return directoryForbidden(res);
    next(err);
  }
};

exports.show = async (req, res, next) => {
  try {
    const { data } = await http.get(`/user/${req.params.id}`, {
      ...(req.humhubToken ? asUser(req.humhubToken) : {}),
      timeout: 8000,
    });
    res.json({ data: mapUser(data) });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) return directoryForbidden(res);
    if (err.response?.status === 404) return res.status(404).json({ error: 'Membre introuvable' });
    next(err);
  }
};

exports.getGroupes = async (req, res, next) => {
  try {
    const { data } = await http.get('/user/group', {
      ...(req.humhubToken ? asUser(req.humhubToken) : {}),
      timeout: 8000,
    });
    const groups = (data.results || []).map((g) => ({ id: g.id, name: g.name, description: g.description }));
    // `categories` reste vide : rien dans HumHub ne correspond à cette notion.
    res.json({ data: { categories: [], commissions: groups.map((g) => g.name), groups } });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) return directoryForbidden(res);
    next(err);
  }
};

exports.create  = (req, res) => res.status(501).json({ error: 'Non implémenté' });
exports.update  = (req, res) => res.status(501).json({ error: 'Non implémenté' });
exports.destroy = (req, res) => res.status(501).json({ error: 'Non implémenté' });
