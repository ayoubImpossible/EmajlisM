/**
 * Barre de titre.
 *
 * Une seule définition pour toute l'application : hauteur, position du retour,
 * sens de lecture (l'icône de retour pointe à droite en arabe), et actions
 * alignées. Les écrans dessinaient chacun la leur, avec des hauteurs
 * différentes et des encoches parfois oubliées.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';
import { useLang } from '../../context/LangContext';

export default function AppBar({
  title,
  subtitle,
  onBack,
  actions = [],       // [{ icon, onPress, badge, label }]
  color,              // fond coloré (en-tête d'espace, par exemple)
  large = false,      // titre de premier niveau, sans retour
}) {
  const { colors, spacing, type } = useTheme();
  const { backIcon, t } = useLang();

  const onColor = !!color;
  const fg = onColor ? '#FFFFFF' : colors.textPrimary;
  const bg = color || colors.bgHeader;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: bg,
          paddingHorizontal: spacing.md,
          borderBottomColor: onColor ? 'transparent' : colors.borderLight,
        },
      ]}
    >
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={[styles.iconBtn, onColor && styles.iconBtnOnColor]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('Retour', 'رجوع')}
        >
          <Ionicons name={backIcon} size={20} color={fg} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.titleWrap}>
        <Text
          style={[large ? type.h1 : type.h3, { color: fg }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.caption, { color: onColor ? 'rgba(255,255,255,0.85)' : colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions.map((a, i) => (
        <TouchableOpacity
          key={a.key || a.icon || i}
          onPress={a.onPress}
          style={[styles.iconBtn, onColor && styles.iconBtnOnColor]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={a.label}
        >
          <Ionicons name={a.icon} size={20} color={fg} />
          {a.badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={styles.badgeText}>{a.badge > 99 ? '99+' : a.badge}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleWrap: { flex: 1, justifyContent: 'center' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  iconBtnOnColor: { backgroundColor: 'rgba(255,255,255,0.18)' },
  badge: {
    position: 'absolute', top: 4, right: 3,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
