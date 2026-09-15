/**
 * Avatar : image authentifiée, ou initiales sur fond dérivé du nom.
 * Les images de profil HumHub sont derrière l'authentification : sans en-tête,
 * elles renvoyaient 401 et laissaient un carré vide.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../config/theme';
import AuthedImage from '../common/AuthedImage';

/** Couleur stable pour un nom donné — même personne, même teinte. */
function hueFor(name) {
  const s = String(name || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ uri, name, size = 40, style }) {
  const { colors, isDark } = useTheme();
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <AuthedImage uri={uri} style={[dim, style]} resizeMode="cover" />;
  }

  const h = hueFor(name);
  const bg = `hsl(${h}, ${isDark ? 35 : 45}%, ${isDark ? 30 : 82}%)`;
  const fg = `hsl(${h}, ${isDark ? 70 : 55}%, ${isDark ? 82 : 28}%)`;

  return (
    <View style={[dim, styles.fallback, { backgroundColor: bg }, style]}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: size * 0.38 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
