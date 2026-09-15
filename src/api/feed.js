/**
 * Fil unifié.
 * Passe par le client unique : adresse unique, jeton depuis SecureStore,
 * erreurs déjà interprétées (`err.isNetwork`, `err.userMessage`).
 */

import api from './client';

export async function getFeed(page = 1, limit = 20, params = {}) {
  const { data } = await api.get('/feed', { params: { page, limit, ...params } });
  return data;
}

export async function getFeedSince(isoDate, limit = 50) {
  const { data } = await api.get('/feed', { params: { since: isoDate, limit } });
  return data;
}
