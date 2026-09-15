/**
 * Agenda.
 *
 * `/api/feed/calendar` renvoie les événements avec leurs vrais champs
 * (`startDatetime`, `endDatetime`, `allDay`, `location`, `color`) — l'ancien
 * code les cherchait sous d'autres noms et n'affichait ni heure ni lieu.
 *
 * HumHub ne filtre pas par plage de dates sur cet endpoint : on charge la
 * période disponible et l'écran regroupe par jour.
 */

import api from './client';

export const getCalendar = async (params = {}) => {
  const { data } = await api.get('/feed/calendar', { params: { limit: 100, page: 1, ...params } });
  return data;
};

export const getEvent = async (id) => {
  const { data } = await api.get(`/calendar/${id}`);
  return data;
};
