/**
 * Bandeau d'information ou d'erreur.
 *
 * Les écrans écrivaient leurs échecs dans `console.error`, invisible pour
 * l'utilisateur : une liste vide à cause d'une panne réseau ressemblait à une
 * liste réellement vide. Un bandeau dit ce qui s'est passé et propose de
 * réessayer.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';
import { useLang } from '../../context/LangContext';

const ICONS = { error: 'alert-circle-outline', info: 'information-circle-outline', warning: 'warning-outline', success: 'checkmark-circle-outline' };

export default function Banner({ tone = 'error', message, onRetry, onDismiss }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useLang();
  if (!message) return null;

  const map = {
    error: { bg: colors.dangerSoft, fg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    info: { bg: colors.infoSoft, fg: colors.info },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone] || {};

  return (
    <View style={[styles.bar, { backgroundColor: map.bg, paddingHorizontal: spacing.md, borderRadius: radius.xs }]}>
      <Ionicons name={ICONS[tone]} size={16} color={map.fg} />
      <Text style={[styles.text, { color: map.fg }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} hitSlop={8}>
          <Text style={[styles.action, { color: map.fg }]}>{t('Réessayer', 'إعادة')}</Text>
        </TouchableOpacity>
      ) : null}
      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={map.fg} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  text: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  action: { fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
});
