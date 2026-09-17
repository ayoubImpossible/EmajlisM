import api from './client';

export const getSpaces = async (page = 1, limit = 50, signal = null) => {
  const { data } = await api.get('/spaces', { params: { page, limit }, signal });
  return data;
};

export const getSpace = async (id, signal = null) => {
  const { data } = await api.get(`/spaces/${id}`, { signal });
  return data;
};

/** Fil de l'espace. `containerId` = contentcontainer_id. */
export const getSpaceFeed = async (containerId, page = 1, limit = 20, signal = null) => {
  const { data } = await api.get(`/spaces/${containerId}/feed`, {
    params: { page, limit },
    signal,
  });
  return data;
};

/** Membres réels de l'espace. */
export const getSpaceMembers = async (spaceId, page = 1, limit = 50, signal = null) => {
  const { data } = await api.get(`/spaces/${spaceId}/members`, {
    params: { page, limit },
    signal,
  });
  return data;
};

/** Modules du menu de l'espace. */
export const getSpaceModules = async (containerId, signal = null) => {
  const { data } = await api.get(`/spaces/${containerId}/modules`, { signal });
  return data;
};

/** Pages personnalisées du menu. */
export const getSpacePages = async (containerId, signal = null) => {
  const { data } = await api.get(`/spaces/${containerId}/pages`, { signal });
  return data;
};
