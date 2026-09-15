/**
 * Détail d'un contenu, quel que soit son type.
 *
 * L'application n'avait aucun moyen d'obtenir le corps complet d'un élément :
 * elle réutilisait l'extrait du fil, tronqué à 200 caractères et vidé de son
 * HTML. Le serveur renvoie maintenant le corps intact, avec `bodyFormat`
 * ('html' ou 'markdown') pour que l'affichage sache quoi en faire.
 */

import api from './client';

export const getContent = async (contentId) => {
  const { data } = await api.get(`/content/${contentId}`);
  return data;
};
