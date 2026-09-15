/**
 * Session : jeton HumHub + profil, conservés dans SecureStore.
 *
 * Corrigé le 10/09/2026 :
 *   - l'adresse du serveur venait de trois endroits différents, dont une IP de
 *     poste écrite en dur et une URL HumHub en clair dans ce fichier. Tout part
 *     désormais de config/env.js ;
 *   - une panne réseau était affichée comme « Identifiants incorrects ». Une
 *     erreur sans réponse HTTP n'est pas un refus d'authentification : elle est
 *     maintenant présentée comme telle. Le serveur applique la même règle et
 *     renvoie 502 quand HumHub est injoignable ;
 *   - le rafraîchissement silencieux du profil appelait HumHub en direct. Il
 *     passe par Express, comme le reste ;
 *   - un 401 survenu n'importe où dans l'application ferme la session ici
 *     (setUnauthorizedHandler), au lieu de laisser un jeton mort en place.
 *
 * Le jeton HumHub n'a pas de date d'expiration (`expired_at: 0` — jwtExpire
 * n'est pas configuré côté serveur). Il n'y a donc rien à rafraîchir, et aucune
 * logique de refresh token à écrire : la session s'arrête sur un 401.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { setUnauthorizedHandler, messageFor } from '../api/client';
import { TOKEN_KEY, USER_KEY } from '../config/env';

const AuthContext = createContext(null);

/** Met en forme l'utilisateur, quel que soit le format reçu. */
function mapUser(u) {
  if (!u) return null;
  const account = u.account || {};
  const profile = u.profile || {};
  const tags = account.tags || u.tags || [];

  return {
    id: u.id,
    guid: u.guid,
    display_name: u.display_name,
    username: account.username || u.username,
    email: account.email || u.email,
    firstname: profile.firstname || u.firstname,
    lastname: profile.lastname || u.lastname,
    title: profile.title || u.title,
    about: profile.about || u.about,
    image_url: profile.image_url || u.image_url || null,
    profileUrl: u.url || null,
    banner_url: profile.banner_url || u.banner_url || null,
    tags,
    // Déduit d'une étiquette, faute d'indicateur d'administration dans l'API.
    // Ne conditionne aucun accès : le serveur décide, l'application n'affiche.
    role: tags.includes('Administration') ? 'admin' : (u.role || 'member'),
    roleIsInferred: true,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const clearSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
    if (mounted.current) { setToken(null); setUser(null); }
  }, []);

  // Un 401 n'importe où dans l'application ferme la session.
  useEffect(() => {
    setUnauthorizedHandler(() => { clearSession(); });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Démarrage : restauration immédiate depuis le stockage, puis rafraîchissement
  // silencieux. L'utilisateur ne regarde pas un écran de chargement pour rien.
  useEffect(() => {
    (async () => {
      try {
        const [tok, userJson] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);

        if (!tok) { setLoading(false); return; }

        setToken(tok);
        if (userJson) {
          try { setUser(JSON.parse(userJson)); } catch (_) {}
        }
        setLoading(false);

        try {
          const { data } = await api.get('/auth/me');
          const fresh = mapUser(data?.data || data);
          if (fresh && mounted.current) {
            setUser(fresh);
            SecureStore.setItemAsync(USER_KEY, JSON.stringify(fresh)).catch(() => {});
          }
        } catch (err) {
          // Un 401 a déjà fermé la session via l'intercepteur. Une panne réseau
          // ne doit rien fermer : le profil en cache reste valable hors ligne.
          if (err?.isNetwork) {
            console.warn('[auth] profil non rafraîchi (serveur injoignable) — cache conservé');
          }
        }
      } catch (_) {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const { data } = await api.post('/auth/login', { username, password }, { timeout: 20000 });
      const newToken = data.token || data.auth_token;
      if (!newToken) {
        return { success: false, error: 'Réponse inattendue du serveur.' };
      }

      const mapped = mapUser(data.user) || null;
      setToken(newToken);
      setUser(mapped);

      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, newToken),
        mapped ? SecureStore.setItemAsync(USER_KEY, JSON.stringify(mapped)) : Promise.resolve(),
      ]);

      return { success: true };
    } catch (err) {
      // messageFor distingue déjà panne réseau, refus d'identifiants et panne
      // serveur. Ne jamais transformer l'une en l'autre.
      return {
        success: false,
        error: messageFor(err, 'La connexion a échoué.'),
        isNetwork: !!err?.isNetwork,
      };
    }
  }, []);

  const logout = useCallback(async () => { await clearSession(); }, [clearSession]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      const fresh = mapUser(data?.data || data);
      if (fresh) {
        setUser(fresh);
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(fresh)).catch(() => {});
      }
      return fresh;
    } catch (_) { return null; }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!token,
        // Indicatif : n'ouvre aucun accès par lui-même, le serveur tranche.
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
