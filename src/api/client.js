/**
 * Client HTTP unique de l'application.
 *
 * Tout passe par ici :
 *   - une seule adresse de base (src/config/env.js) ;
 *   - le jeton est lu dans SecureStore, jamais dans AsyncStorage ;
 *   - le slash final est retiré (HumHub répond 404 sur /user/ mais 401 sur
 *     /user — Express relaie, la règle vaut donc des deux côtés) ;
 *   - une panne réseau est distinguée d'un refus d'accès : `err.isNetwork`.
 *     Sans cette distinction, l'écran de connexion affichait « Identifiants
 *     incorrects » quand le serveur était simplement injoignable ;
 *   - un 401 purge la session et prévient l'application (onUnauthorized), au
 *     lieu de laisser un jeton mort dans le stockage.
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, TOKEN_KEY } from '../config/env';

/** Conservé pour les modules qui l'importent encore. */
export const EXPRESS_API = API_URL;

let onUnauthorized = null;
/** Branché par AuthContext : ramène l'utilisateur à l'écran de connexion. */
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function getToken() {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch (_) { return null; }
}

/** En-têtes d'authentification, pour les appels qui n'utilisent pas `api`. */
export async function authHeaders() {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 45000,  // Increased to 45s - HumHub can take 30s+
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use(async (config) => {
  if (config.url && config.url.length > 1) {
    config.url = config.url.replace(/\/+$/, '');
  }
  if (!config.headers?.Authorization) {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    // Pas de réponse HTTP : le serveur n'a pas été joint. Ce n'est pas un refus.
    if (!error.response) {
      error.isNetwork = true;
      error.userMessage = "Serveur injoignable. Vérifiez votre connexion, puis réessayez.";
      return Promise.reject(error);
    }

    const { status, data } = error.response;
    error.isNetwork = false;

    if (status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      if (onUnauthorized) { try { onUnauthorized(); } catch (_) {} }
      error.userMessage = 'Session expirée. Reconnectez-vous.';
    } else if (status === 403) {
      error.userMessage = data?.error || "Vous n'avez pas accès à cet élément.";
    } else if (status === 404) {
      error.userMessage = data?.error || 'Élément introuvable.';
    } else if (status === 502 || status === 503) {
      error.userMessage = data?.error || 'Serveur indisponible. Réessayez dans un instant.';
    } else if (status >= 500) {
      error.userMessage = 'Erreur du serveur.';
    } else {
      error.userMessage = data?.error || data?.message || 'La requête a échoué.';
    }

    return Promise.reject(error);
  },
);

/**
 * Message affichable pour une erreur quelconque.
 * À utiliser partout où l'application affiche un échec : elle n'invente jamais
 * une cause qu'elle n'a pas observée.
 */
export function messageFor(err, fallback = 'Une erreur est survenue.') {
  return err?.userMessage || err?.response?.data?.error || err?.message || fallback;
}

export default api;
