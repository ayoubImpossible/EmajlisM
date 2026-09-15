/**
 * Adresse du serveur — source unique.
 *
 * Avant : trois définitions concurrentes.
 *   - src/api/client.js      : HUMHUB_API en dur + EXPRESS_API = http://192.168.7.61:3000
 *   - src/config/api.js      : BASE_URL déduit de l'IP du poste de développement
 *   - src/context/AuthContext.js : https://emajlis-dev.csefrs.ma écrit en clair
 * Résultat : l'adresse d'Express était figée sur une IP de poste. Sur un
 * téléphone, sur un autre réseau ou en production, la moitié de l'application
 * appelait une machine qui n'existe pas.
 *
 * Désormais : EXPO_PUBLIC_BASE_URL décide. Elle est lue au moment du bundle par
 * Expo (tout ce qui commence par EXPO_PUBLIC_ est injecté dans le code).
 *
 *   .env à la racine de emajlis-app :
 *     EXPO_PUBLIC_BASE_URL=https://api.emajlis.csefrs.ma
 *
 * Si elle n'est pas définie, on retombe en développement sur l'hôte qui sert
 * Metro — c'est-à-dire le poste du développeur — port 3000. Ce repli n'existe
 * qu'en développement : en production, une adresse absente est une erreur, et
 * elle est signalée comme telle plutôt que silencieusement remplacée.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const FALLBACK_PORT = 3000;

/** Hôte qui sert le bundle Metro — utilisé uniquement comme repli en dev. */
function metroHost() {
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    '';

  if (!hostUri) return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';

  // Un tunnel ne transporte que le port de Metro : l'API n'est pas joignable
  // par cette adresse. On le dit, au lieu de laisser une erreur réseau opaque.
  if (hostUri.includes('ngrok') || hostUri.includes('exp.direct')) {
    console.warn(
      '[env] Expo est en mode tunnel : le serveur Express n\'est pas accessible par ce canal. ' +
      'Définissez EXPO_PUBLIC_BASE_URL avec une adresse joignable depuis le téléphone.',
    );
    return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  }

  return hostUri.replace(/^https?:\/\//, '').replace(/^exp:\/\//, '').split(':')[0];
}

function resolveBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_BASE_URL;
  if (configured) return String(configured).replace(/\/+$/, '');

  if (__DEV__) {
    const url = `http://${metroHost()}:${FALLBACK_PORT}`;
    console.warn(`[env] EXPO_PUBLIC_BASE_URL non définie — repli de développement sur ${url}`);
    return url;
  }

  console.error(
    '[env] EXPO_PUBLIC_BASE_URL est absente de cette version. ' +
    'Aucun appel réseau ne peut aboutir. Définissez-la avant de construire l\'application.',
  );
  return '';
}

export const BASE_URL = resolveBaseUrl();
export const API_URL = BASE_URL ? `${BASE_URL}/api` : '';

/** Vrai si l'application parle à son serveur en clair. */
export const IS_INSECURE_TRANSPORT = /^http:\/\//i.test(BASE_URL);

if (IS_INSECURE_TRANSPORT && !__DEV__) {
  console.error(
    '[env] Le serveur est appelé en HTTP simple. Le jeton d\'authentification ' +
    'circule alors en clair sur le réseau. Utilisez HTTPS en production.',
  );
}

/** Clés de stockage sécurisé — un seul endroit les nomme. */
export const TOKEN_KEY = 'emajlis_token';
export const USER_KEY = 'emajlis_user';

export default { BASE_URL, API_URL, TOKEN_KEY, USER_KEY, IS_INSECURE_TRANSPORT };
