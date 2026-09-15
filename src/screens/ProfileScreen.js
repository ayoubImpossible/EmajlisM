/**
 * Profil.
 *
 * Ce que le serveur permet, et rien de plus : HumHub réserve `PUT /user/{id}`
 * aux administrateurs, donc un membre ne peut pas modifier son profil par
 * l'API (BG-10). L'écran le dit et renvoie vers le profil web, au lieu de
 * proposer un formulaire qui échouerait.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { BASE_URL } from '../config/env';
import { Screen, AppBar, Card, Button, Avatar, Badge, Banner } from '../components/ui';

/** Adresse web de la plateforme, déduite de l'espace : jamais écrite en dur. */
const WEB_PROFILE_PATH = '/user/account/edit';
const WEB_PASSWORD_PATH = '/user/account/change-password';

export default function ProfileScreen({ navigation }) {
  const { colors, spacing, radius, layout, type: T, isDark } = useTheme();
  const { t, lang, dirStyle, forwardIcon } = useLang();
  const { user, refreshUser, logout } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { refreshUser?.(); }, [refreshUser]));

  /**
   * Le profil web vit sur HumHub, pas sur l'API Express. L'adresse du site n'est
   * écrite nulle part dans l'application : on la déduit d'une URL que le serveur
   * a renvoyée — celle du profil, sinon celle de la photo. Si aucune des deux
   * n'est là, on le dit plutôt que d'inventer un domaine.
   */
  const webBase = (() => {
    const source = user?.profileUrl || user?.image_url || '';
    const m = /^(https?:\/\/[^/]+)/.exec(String(source));
    return m ? m[1] : null;
  })();

  const openWeb = (path, title) => {
    if (!webBase) {
      Alert.alert(
        t('Non disponible', 'غير متاح'),
        t("L'adresse du site n'est pas connue de l'application.", 'عنوان الموقع غير معروف للتطبيق.'),
      );
      return;
    }
    navigation.navigate('WebView', { url: `${webBase}${path}`, title });
  };

  const confirmLogout = () => {
    Alert.alert(
      t('Se déconnecter', 'تسجيل الخروج'),
      t('Vous devrez saisir à nouveau vos identifiants.', 'سيتعين عليك إدخال بياناتك مرة أخرى.'),
      [
        { text: t('Annuler', 'إلغاء'), style: 'cancel' },
        { text: t('Se déconnecter', 'تسجيل الخروج'), style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  const rows = [
    { icon: 'mail-outline', label: t('Adresse électronique', 'البريد الإلكتروني'), value: user?.email },
    { icon: 'person-outline', label: t('Identifiant', 'المعرّف'), value: user?.username },
    { icon: 'briefcase-outline', label: t('Fonction', 'الوظيفة'), value: user?.title },
  ].filter((r) => r.value);

  return (
    <Screen>
      <AppBar
        title={t('Profil', 'الملف الشخصي')}
        large
        actions={[{ icon: 'settings-outline', onPress: () => navigation.navigate('Settings'), label: t('Réglages', 'الإعدادات') }]}
      />

      <ScrollView
        contentContainerStyle={{ padding: layout.gutter, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refreshUser?.(); setRefreshing(false); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgCard}
          />
        }
      >
        <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
          <Avatar uri={user?.image_url} name={user?.display_name} size={84} />
          <Text style={[T.h2, { textAlign: 'center' }]} numberOfLines={2}>
            {user?.display_name || t('Membre', 'عضو')}
          </Text>
          {(user?.tags || []).length ? (
            <View style={styles.tagRow}>
              {user.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} label={tag} color={colors.primary} />
              ))}
            </View>
          ) : null}
          {user?.about ? (
            <Text style={[T.body, { textAlign: 'center' }, dirStyle]} numberOfLines={4}>{user.about}</Text>
          ) : null}
        </Card>

        {rows.length ? (
          <Card padded={false}>
            {rows.map((r, i) => (
              <View
                key={r.label}
                style={[
                  styles.infoRow,
                  {
                    paddingHorizontal: spacing.md,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.borderLight,
                  },
                ]}
              >
                <Ionicons name={r.icon} size={17} color={colors.textMuted} />
                <Text style={[T.caption, { width: 110 }]}>{r.label}</Text>
                <Text style={[T.bodyStrong, { flex: 1, fontSize: 13 }, dirStyle]} numberOfLines={2}>
                  {r.value}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Banner
          tone="info"
          message={t(
            "La modification du profil et du mot de passe se fait sur le site : l'API les réserve aux administrateurs.",
            'يتم تعديل الملف الشخصي وكلمة المرور عبر الموقع: الواجهة تحصرهما في المسؤولين.',
          )}
        />

        <Card padded={false}>
          {[
            { icon: 'create-outline', label: t('Modifier mon profil', 'تعديل ملفي'), onPress: () => openWeb(WEB_PROFILE_PATH, t('Mon profil', 'ملفي')) },
            { icon: 'key-outline', label: t('Changer mon mot de passe', 'تغيير كلمة المرور'), onPress: () => openWeb(WEB_PASSWORD_PATH, t('Mot de passe', 'كلمة المرور')) },
            { icon: 'people-outline', label: t('Membres des espaces', 'أعضاء الفضاءات'), onPress: () => navigation.navigate('Membres') },
            { icon: 'settings-outline', label: t('Réglages', 'الإعدادات'), onPress: () => navigation.navigate('Settings') },
          ].map((a, i) => (
            <TouchableOpacity
              key={a.label}
              style={[
                styles.actionRow,
                {
                  paddingHorizontal: spacing.md,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.borderLight,
                },
              ]}
              onPress={a.onPress}
              activeOpacity={0.8}
            >
              <Ionicons name={a.icon} size={19} color={colors.primary} />
              <Text style={[T.bodyStrong, { flex: 1, fontSize: 13.5 }, dirStyle]}>{a.label}</Text>
              <Ionicons name={forwardIcon} size={16} color={colors.border} />
            </TouchableOpacity>
          ))}
        </Card>

        <Button
          title={t('Se déconnecter', 'تسجيل الخروج')}
          icon="log-out-outline"
          variant="danger"
          onPress={confirmLogout}
        />

        <Text style={[T.caption, { textAlign: 'center' }]}>
          {t('Serveur', 'الخادم')} : {String(BASE_URL || '—').replace(/^https?:\/\//, '')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
