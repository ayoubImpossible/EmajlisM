/**
 * Puce de filtre, et la rangée défilante qui va avec.
 * Les filtres de l'accueil, de la recherche et des demandes utilisaient trois
 * rendus différents pour la même chose.
 */

import React from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';

export default function Chip({ label, active, onPress, icon, color, count }) {
  const { colors, radius } = useTheme();
  const accent = color || colors.primary;
  const textColor = active ? colors.onPrimary : colors.textSecondary;

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
        <Ionicons name={icon} size={13} color={textColor} />
      ) : null}
      <Text numberOfLines={1} style={[styles.text, { color: textColor }]}>
        {label}
      </Text>
      {/* Count badge inside chip — e.g. "Tout 14" */}
      {count != null && count > 0 ? (
        <View style={[
          styles.countBadge,
          { backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${accent}22` },
        ]}>
          <Text style={[styles.countText, { color: active ? '#fff' : accent }]}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
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
  countBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: { fontSize: 10, fontWeight: '800' },
});
