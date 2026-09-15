/**
 * État vide. Toujours une icône, une phrase, et — quand c'est possible — une
 * action. « Aucun contenu » tout seul ne dit pas à l'utilisateur quoi faire.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';
import Button from './Button';

export default function EmptyState({ icon = 'file-tray-outline', title, description, actionTitle, onAction }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={[styles.wrap, { padding: spacing.xl }]}>
      <Ionicons name={icon} size={44} color={colors.border} />
      <Text style={[type.h3, { color: colors.textSecondary, textAlign: 'center' }]}>{title}</Text>
      {description ? (
        <Text style={[type.caption, { textAlign: 'center', color: colors.textMuted }]}>{description}</Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} variant="secondary" full={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
