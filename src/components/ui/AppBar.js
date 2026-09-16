/**
 * Barre de titre.
 *
 * Supports two modes:
 *  - Standard screens: back arrow + title + actions
 *  - Home screen (avatarUri/avatarInitials): user avatar photo or grey fallback + name + actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';
import { useLang } from '../../context/LangContext';
import AuthedImage from '../common/AuthedImage';

export default function AppBar({
  title,
  subtitle,
  onBack,
  actions = [],       // [{ icon, onPress, badge, label }]
  color,              // fond coloré (en-tête d'espace)
  large = false,      // titre de premier niveau, sans retour
  // Home-screen avatar mode
  avatarUri,          // real profile image URL — shown with auth header
  avatarInitials,     // fallback initials (unused visually now, kept for compat)
  avatarColor,        // unused visually now, kept for compat
  avatarOnline,       // boolean — green dot indicator
}) {
  const { colors, spacing, type } = useTheme();
  const { backIcon, t } = useLang();

  const onColor = !!color;
  const fg = onColor ? '#FFFFFF' : colors.textPrimary;
  const bg = color || colors.bgHeader;

  const showAvatar = !!(avatarUri || avatarInitials);

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
      {/* Left: avatar OR back button */}
      {showAvatar ? (
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <AuthedImage
              uri={avatarUri}
              style={styles.avatarCircle}
              resizeMode="cover"
              fallback={<GreyAvatar colors={colors} />}
            />
          ) : (
            <GreyAvatar colors={colors} />
          )}
          {avatarOnline ? (
            <View style={[styles.onlineDot, { borderColor: bg }]} />
          ) : null}
        </View>
      ) : onBack ? (
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

      {/* Title / subtitle block */}
      <View style={styles.titleWrap}>
        <Text
          style={[large ? type.h1 : type.h3, { color: fg }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[type.caption, { color: onColor ? 'rgba(255,255,255,0.85)' : colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right action buttons */}
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

/** Grey circular person icon — shown when no profile photo is available */
function GreyAvatar({ colors }) {
  return (
    <View style={[styles.avatarCircle, { backgroundColor: colors.skeleton }]}>
      <Ionicons name="person" size={22} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  titleWrap: { flex: 1, justifyContent: 'center' },

  /* Avatar */
  avatarWrap: { position: 'relative', marginRight: 2 },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
  },

  /* Action icon buttons */
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  iconBtnOnColor: { backgroundColor: 'rgba(255,255,255,0.18)' },

  /* Notification badge */
  badge: {
    position: 'absolute', top: 4, right: 3,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
