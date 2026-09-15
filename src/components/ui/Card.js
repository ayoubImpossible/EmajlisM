/**
 * Carte.
 *
 * En thème clair, la profondeur vient d'une ombre discrète ; en sombre, une
 * ombre noire ne se voit pas, donc la profondeur vient d'un fond plus clair et
 * d'une bordure — c'est la convention du web, reprise telle quelle.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../config/theme';

export default function Card({ children, onPress, style, padded = true, elevated = true, ...rest }) {
  const { colors, radius, spacing, shadow, isDark } = useTheme();

  const base = [
    {
      backgroundColor: isDark && elevated ? colors.bgElevated : colors.bgCard,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    padded && { padding: spacing.md },
    elevated && shadow.sm,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={base} onPress={onPress} activeOpacity={0.85} {...rest}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={base} {...rest}>{children}</View>;
}
