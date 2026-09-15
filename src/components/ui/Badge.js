/** Petite étiquette colorée : type de contenu, statut d'une demande. */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';

export default function Badge({ label, color, icon, soft = true }) {
  const { colors, radius } = useTheme();
  const accent = color || colors.primary;
  return (
    <View
      style={[
        styles.badge,
        {
          borderRadius: radius.full,
          backgroundColor: soft ? `${accent}22` : accent,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={soft ? accent : colors.onPrimary} /> : null}
      <Text style={[styles.text, { color: soft ? accent : colors.onPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 10.5, fontWeight: '700' },
});
