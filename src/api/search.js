/**
 * Recherche.
 *
 * Corrigé le 10/09/2026 : `searchTypes` renvoyait deux types écrits en dur
 * (Post et CalendarEntry). Le serveur en expose onze — mesuré. Les filtres
 * doivent venir du serveur, sinon l'utilisateur ne peut chercher que dans deux
 * types sur onze sans jamais savoir que les autres existent.
 */

import api from './client';

export const search = async (keyword, page = 1, params = {}) => {
  const { data } = await api.get('/feed/search', { params: { keyword, page, ...params } });
  return data;
};

export const searchTypes = async () => {
  const { data } = await api.get('/feed/search/types');
  // API wraps in { results: [...] }. Each item has:
  //   key  → try class, value, id, type, name (field varies by HumHub version)
  //   label → try label, title, name, fr (same)
  const raw = data?.results || data?.items || (Array.isArray(data) ? data : []);
  return raw;
};
