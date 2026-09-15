/**
 * Notifications.
 * `unseen` renvoie la liste des non lues ; son `total` sert de pastille.
 */

import api from './client';

export const getNotifications = async (page = 1, limit = 25) => {
  const { data } = await api.get('/feed/notifications', { params: { page, limit } });
  return data;
};

export const getUnseenCount = async () => {
  const { data } = await api.get('/feed/notifications/unseen');
  // Le serveur renvoie une liste paginée : c'est `total` qui compte.
  return { count: data?.total ?? (data?.results || []).length, results: data?.results || [] };
};

export const markSeen = async () => {
  const { data } = await api.patch('/feed/notifications/seen', {});
  return data;
};
