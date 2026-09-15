/**
 * Image servie par HumHub.
 *
 * Les photos de profil, bannières et fichiers du Drive sont derrière
 * l'authentification. `<Image source={{ uri }} />` sans en-tête reçoit un 401 et
 * affiche un carré vide — sans message, sans erreur visible.
 *
 * Ce composant ajoute l'en-tête d'autorisation, montre un repli explicite en cas
 * d'échec, et suit le thème (le fond d'attente ne doit pas être blanc en mode
 * sombre).
 */

import React, { useEffect, useState } from 'react';
import { Image, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getToken } from '../../api/client';
import { API_URL, BASE_URL } from '../../config/env';
import { useTheme } from '../../config/theme';

/** Complète un chemin relatif renvoyé par l'API. */
function absolute(uri) {
  if (!uri) return null;
  if (/^(https?:|data:|file:)/i.test(uri)) return uri;
  if (uri.startsWith('/api/')) return `${BASE_URL}${uri}`;
  if (uri.startsWith('/')) return `${API_URL}${uri}`;
  return `${API_URL}/${uri}`;
}

export default function AuthedImage({
  uri,
  style,
  resizeMode = 'cover',
  fallback = null,
  placeholderLabel = '',
  ...rest
}) {
  const { colors, radius } = useTheme();
  const [headers, setHeaders] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const source = absolute(uri);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setLoading(true);
    getToken().then((token) => {
      if (!alive) return;
      setHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    });
    return () => { alive = false; };
  }, [source]);

  const placeholder = (children) => (
    <View
      style={[
        styles.placeholder,
        { backgroundColor: colors.skeleton, borderRadius: radius.sm },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!source || failed) {
    if (fallback) return fallback;
    return placeholder(
      placeholderLabel
        ? <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>{placeholderLabel}</Text>
        : null,
    );
  }

  if (headers === null) {
    return placeholder(<ActivityIndicator size="small" color={colors.primary} />);
  }

  return (
    <View style={style}>
      <Image
        source={{ uri: source, headers }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
        {...rest}
      />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.loader, { backgroundColor: colors.skeleton }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  loader: { alignItems: 'center', justifyContent: 'center' },
});
