/**
 * E-Services — accueil des services.
 *
 * Le catalogue vient du serveur : types, statuts et habilitation. L'ancienne
 * liste de quatre services écrite dans `config/api.js` a été retirée — la
 * plateforme en compte cinq, dont « Dépôt de documents » qui manquait.
 *
 * Corrigé le 11/09/2026 : l'onglet d'administration s'ouvrait sur
 * `is_manager || isAdmin`, où `isAdmin` est déduit d'une étiquette de profil. Un
 * membre étiqueté « Administration » voyait un onglet que le serveur refusait
 * ensuite. Seul `is_manager`, renvoyé par le serveur, décide (BG-10).
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getCatalog } from '../api/eservice';
import { messageFor } from '../api/client';
import { typeIcon } from '../config/eserviceFields';
import { Screen, AppBar, Card, Banner, SkeletonList } from '../components/ui';

export default function EServicesScreen({ navigation }) {
  const { colors, spacing, radius, shadow, layout, isDark, type: T } = useTheme();
  const { t, dirStyle, forwardIcon } = useLang();

  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setCatalog(await getCatalog());
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Catalogue indisponible.', 'الكتالوج غير متاح.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const types = catalog?.types || [];
  const isManager = !!catalog?.is_manager;

  const shortcuts = [
    { icon: 'documents-outline', label: t('Mes demandes', 'طلباتي'), onPress: () => navigation.navigate('MesDemandes') },
    ...(isManager
      ? [{ icon: 'shield-checkmark-outline', label: t('Administration', 'الإدارة'), onPress: () => navigation.navigate('AdminDemandes') }]
      : []),
  ];

  const columns = layout.isTablet ? 3 : 2;

  return (
    <Screen>
      <AppBar title={t('E-Services', 'الخدمات الإلكترونية')} large />

      <ScrollView
        contentContainerStyle={{ padding: layout.gutter, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgCard}
          />
        }
      >
        {error ? <Banner message={error} onRetry={load} onDismiss={() => setError(null)} /> : null}

        <Card padded={false}>
          {shortcuts.map((s, i) => (
            <TouchableOpacity
              key={s.label}
              style={[
                styles.shortcut,
                {
                  paddingHorizontal: spacing.md,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.borderLight,
                },
              ]}
              onPress={s.onPress}
              activeOpacity={0.8}
            >
              <Ionicons name={s.icon} size={19} color={colors.primary} />
              <Text style={[T.bodyStrong, { flex: 1, fontSize: 13.5 }, dirStyle]}>{s.label}</Text>
              <Ionicons name={forwardIcon} size={16} color={colors.border} />
            </TouchableOpacity>
          ))}
        </Card>

        <Text style={T.label}>{t('Déposer une demande', 'تقديم طلب')}</Text>

        {loading ? <SkeletonList count={3} /> : types.length === 0 ? (
          <Banner
            tone="info"
            message={t('Aucun service disponible pour le moment.', 'لا توجد خدمات متاحة حالياً.')}
          />
        ) : (
          <View style={styles.grid}>
            {types.map((ty) => (
              <TouchableOpacity
                key={ty.value}
                style={[
                  styles.tile,
                  shadow.sm,
                  {
                    width: `${100 / columns - 2}%`,
                    backgroundColor: isDark ? colors.bgElevated : colors.bgCard,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    padding: spacing.md,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('DemandeForm', { type: ty.value })}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
                  <Ionicons name={typeIcon(ty.value)} size={22} color={colors.primary} />
                </View>
                <Text style={[T.h4, { fontSize: 13 }, dirStyle]} numberOfLines={3}>{ty.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isManager ? (
          <Banner
            tone="info"
            message={t(
              'Vous êtes gestionnaire E-Services : vous pouvez traiter les demandes des membres.',
              'أنت مسؤول عن الخدمات الإلكترونية: يمكنك معالجة طلبات الأعضاء.',
            )}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%', rowGap: 12 },
  tile: { borderWidth: StyleSheet.hairlineWidth, gap: 8, minHeight: 108 },
  tileIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
});
