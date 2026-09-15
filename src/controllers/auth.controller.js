'use strict';

/**
 * Authentification — relais vers HumHub.
 *
 * Modifications du 10/09/2026 :
 *  - suppression de l'agent HTTPS local `rejectUnauthorized: false`, actif dès
 *    que NODE_ENV n'était pas « production ». Toutes les requêtes passent
 *    désormais par le client unique `services/humhub.js`, qui vérifie le
 *    certificat et complète la chaîne manquante (voir certs/README.md) ;
 *  - une panne réseau ne se traduit plus par « Identifiants incorrects ». Un
 *    serveur injoignable renvoie 502 et un message qui dit la vérité : c'est la
 *    règle posée dans le cahier des charges mobile, et elle vaut aussi côté
 *    serveur, sinon l'application ne peut pas la respecter ;
 *  - `tags` est relayé tel quel : l'application déduisait le rôle
 *    d'administrateur d'une étiquette, sans que le serveur ne dise jamais si
 *    l'utilisateur est administrateur. Le champ `role` est conservé pour ne
 *    rien casser, mais il est marqué comme une déduction.
 */

const { http, asUser } = require('../services/humhub');

/** Met en forme la réponse de /auth/current pour l'application. */
function shapeUser(data) {
  const account = data.account || {};
  const profile = data.profile || {};
  const tags = Array.isArray(account.tags) ? account.tags : [];

  return {
    id: data.id,
    guid: data.guid,
    username: account.username,
    email: account.email,
    display_name: data.display_name,
    firstname: profile.firstname,
    lastname: profile.lastname,
    image_url: profile.image_url || null,
    tags,
    // Déduction à partir d'une étiquette, faute d'indicateur d'administration
    // dans l'API REST de HumHub. Voir docs/EMajlis-Mobile-Backend-Gaps.md,
    // BG-10 : ne rien autoriser côté mobile sur la seule foi de ce champ.
    role: tags.includes('Administration') ? 'admin' : 'member',
    roleIsInferred: true,
  };
}

/** Une erreur sans réponse HTTP est une panne réseau, pas un refus d'accès. */
function isNetworkFailure(err) {
  return !err.response;
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username et password requis.' });
  }

  let data;
  try {
    ({ data } = await http.post('/auth/login', { username, password }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }));
  } catch (err) {
    if (isNetworkFailure(err)) {
      console.error(`[auth] HumHub injoignable : ${err.message}`);
      return res.status(502).json({
        error: 'Serveur indisponible. Vérifiez votre connexion et réessayez.',
        reason: 'upstream_unreachable',
      });
    }
    const status = err.response.status;
    if (status === 400 || status === 401 || status === 403) {
      return res.status(401).json({ error: 'Identifiants incorrects.', reason: 'bad_credentials' });
    }
    return next(err);
  }

  if (!data || !data.auth_token) {
    return res.status(401).json({ error: 'Identifiants incorrects.', reason: 'bad_credentials' });
  }

  // Le profil est chargé dans la foulée : l'application l'a dès la connexion.
  let userRes;
  try {
    userRes = await http.get('/auth/current', { ...asUser(data.auth_token), timeout: 8000 });
  } catch (err) {
    // Le jeton est valide : on le rend même si le profil n'a pas pu être lu.
    console.warn(`[auth] profil non chargé après connexion : ${err.message}`);
    return res.json({ token: data.auth_token, expired_at: data.expired_at, user: null, degraded: true });
  }

  return res.json({
    token: data.auth_token,
    // HumHub renvoie 0 : ce jeton n'expire pas (jwtExpire n'est pas configuré).
    // L'application ne doit donc pas construire de logique de rafraîchissement.
    expired_at: data.expired_at,
    user: shapeUser(userRes.data),
  });
};

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
// req.user est déjà résolu par le middleware humhubAuth.
exports.me = (req, res) => {
  res.json({ data: req.user });
};

// ── PUT /api/auth/profile ────────────────────────────────────────────────────
/**
 * HumHub n'expose pas d'endpoint « je modifie mon propre profil » : `PUT
 * /user/{id}` est réservé aux administrateurs. Un utilisateur ordinaire reçoit
 * donc 403, et c'est le serveur qui doit le dire clairement — l'application ne
 * peut pas deviner qu'il s'agit d'une limite de l'API et non d'une panne.
 */
exports.updateProfile = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Non authentifié.' });

  const profile = {};
  for (const field of ['firstname', 'lastname', 'about', 'title', 'phone_work', 'mobile']) {
    if (typeof req.body?.[field] === 'string') profile[field] = req.body[field];
  }
  if (!Object.keys(profile).length) {
    return res.status(400).json({ error: 'Aucun champ modifiable fourni.' });
  }

  try {
    await http.put(`/user/${userId}`, { profile }, { ...asUser(req.humhubToken), timeout: 8000 });
  } catch (err) {
    if (isNetworkFailure(err)) {
      return res.status(502).json({ error: 'Serveur indisponible.', reason: 'upstream_unreachable' });
    }
    if (err.response.status === 403) {
      return res.status(403).json({
        error: "La modification du profil n'est pas ouverte par l'API : HumHub réserve cette opération aux administrateurs.",
        reason: 'humhub_admin_only',
        workaround: 'Modification possible depuis le profil web.',
      });
    }
    return next(err);
  }

  try {
    const { data } = await http.get('/auth/current', { ...asUser(req.humhubToken), timeout: 8000 });
    res.json({ data: shapeUser(data) });
  } catch (err) { next(err); }
};

exports.shapeUser = shapeUser;
