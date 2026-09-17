/**
 * Espaces.
 *
 * Corrigé le 10/09/2026 :
 *   - `getSpaceMembers` appelait /api/membres, l'annuaire général de la
 *     plateforme : l'écran « membres de l'espace » affichait donc les mêmes
 *     personnes dans tous les espaces. La vraie composition est à
 *     /api/spaces/:id/members ;
 *   - ajout de `getSpaceModules` et `getSpacePages`, dont le menu d'espace a
 *     besoin pour être construit à partir de l'espace lui-même — jamais à
 *     partir de son nom.
 */

import api from './client';

export const getSpaces = async (page = 1, limit = 50) => {
  const { data } = await api.get('/spaces', { params: { page, limit } });
  return data;
};

export const getSpace = async (id) => {
  const { data } = await api.get(`/spaces/${id}`);
  return data;
};

/** Fil de l'espace. `containerId` = contentcontainer_id. */
export const getSpaceFeed = async (containerId, page = 1, limit = 20) => {
  const { data } = await api.get(`/spaces/${containerId}/feed`, { params: { page, limit } });
  return data;
};

/** Membres réels de l'espace. `spaceId` = identifiant d'espace, pas le conteneur. */
export const getSpaceMembers = async (spaceId, page = 1, limit = 50) => {
  const { data } = await api.get(`/spaces/${spaceId}/members`, { params: { page, limit } });
  return data;
};

/**
 * Modules à proposer dans le menu de l'espace.
 *
 * Le serveur renvoie `menu` (liste d'identifiants) et `modules` (le détail, avec
 * `basis` qui dit sur quoi repose l'information). HumHub n'expose pas la liste
 * des modules activés : `menu` est une mesure, pas une vérité — voir BG-13.
 * Le menu se construit à partir de cette réponse, jamais d'un test sur le nom
 * de l'espace.
 */
export const getSpaceModules = async (containerId) => {
  const { data } = await api.get(`/spaces/${containerId}/modules`);
  return data;
};

/**
 * Pages personnalisées du menu. La plupart ne sont pas des pages : ce sont des
 * raccourcis, déjà résolus par le serveur dans `shortcut`
 * ({kind: 'drive'|'cfiles'|'search'|'internal'|'external'}).
 */
export const getSpacePages = async (containerId) => {
  const { data } = await api.get(`/spaces/${containerId}/pages`);
  return data;
};
