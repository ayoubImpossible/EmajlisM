/**
 * Bouton. Trois variantes seulement : principale, secondaire, discrète.
 * La cible tactile ne descend jamais sous 44 points de haut.
 */

import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',   // 'primary' | 'secondary' | 'ghost' | 'danger'
  icon,
  loading = false,
  disabled = false,
  full = true,
  style,
}) {
  const { colors, radius, type } = useTheme();

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: 'transparent', fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' },
    danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  }[variant] || {};

  const off = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      style={[
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.sm,
          opacity: off ? 0.6 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={17} color={palette.fg} /> : null}
          <Text style={[type.button, { color: palette.fg }]} numberOfLines={1}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 46,
    paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
