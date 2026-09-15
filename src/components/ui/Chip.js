/**
 * Puce de filtre, et la rangée défilante qui va avec.
 * Les filtres de l'accueil, de la recherche et des demandes utilisaient trois
 * rendus différents pour la même chose.
 */

import React from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';

export default function Chip({ label, active, onPress, icon, color }) {
  const { colors, radius } = useTheme();
  const accent = color || colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[
        styles.chip,
        {
          borderRadius: radius.full,
          borderColor: active ? accent : colors.border,
          backgroundColor: active ? accent : colors.bgCard,
        },
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={13} color={active ? colors.onPrimary : colors.textSecondary} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.text, { color: active ? colors.onPrimary : colors.textSecondary }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ChipRow({ children, style }) {
  const { spacing, colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
        style,
      ]}
      style={{ flexGrow: 0, flexShrink: 0, minHeight: 52, backgroundColor: colors.bgHeader }}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontWeight: '700', maxWidth: 170 },
});
