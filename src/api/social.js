/**
 * Commentaires et mentions « j'aime ».
 * Bloc social absent de l'application : chaque contenu du web en a un.
 *
 * Attention aux identifiants : HumHub distingue
 *   - `contentId`  — l'entrée de contenu (ce que renvoie `item.id`) ;
 *   - `model`/`pk` — la classe et la clé de l'objet sous-jacent
 *     (`item.objectModel` / `item.objectId`).
 * Les commentaires se lisent par `contentId` mais s'écrivent par `model`/`pk`.
 * C'est le contrat de l'API REST de HumHub, pas un choix de cette couche.
 */

import api from './client';

export const getComments = async (contentId, page = 1, limit = 25) => {
  const { data } = await api.get(`/comments/content/${contentId}`, { params: { page, limit } });
  return data;
};

export const addComment = async (model, pk, message) => {
  const { data } = await api.post('/comments', { model, pk, message });
  return data;
};

export const deleteComment = async (id) => {
  const { data } = await api.delete(`/comments/${id}`);
  return data;
};

export const getLikeStatus = async (model, pk) => {
  const { data } = await api.get('/likes/status', { params: { model, pk } });
  return data;
};

export const like = async (model, pk) => {
  const { data } = await api.post('/likes', { model, pk });
  return data;
};

export const unlike = async (model, pk) => {
  const { data } = await api.delete('/likes', { data: { model, pk } });
  return data;
};
