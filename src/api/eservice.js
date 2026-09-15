/**
 * E-Services.
 *
 * Modifié le 11/09/2026 : passe par le client unique (`api/client.js`), donc
 * adresse unique, jeton depuis SecureStore, et erreurs déjà interprétées
 * (`err.isNetwork`, `err.userMessage`).
 *
 * Les statuts réels sont `pending`, `in_progress`, `approved`, `rejected` —
 * l'application attendait `processing` et `completed`, qui n'existent pas.
 * La liste ne doit pas être écrite dans l'application : elle vient du catalogue.
 */

import api from './client';

export const getCatalog = async () => {
  const { data } = await api.get('/eservices/catalog');
  return data;
};

export const getMyRequests = async (params = {}) => {
  const { data } = await api.get('/eservices/requests', { params });
  return data;
};

export const getAdminRequests = async (params = {}) => {
  const { data } = await api.get('/eservices/admin', { params });
  return data;
};

export const getRequest = async (id) => {
  const { data } = await api.get(`/eservices/request/${id}`);
  return data;
};

export const createRequest = async (payload) => {
  const { data } = await api.post('/eservices/request', payload);
  return data;
};

export const changeStatus = async (id, status, comment) => {
  const { data } = await api.post(`/eservices/request/${id}/status`, { status, comment });
  return data;
};
