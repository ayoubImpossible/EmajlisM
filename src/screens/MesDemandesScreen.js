/**
 * Mes demandes E-Services.
 *
 * Simplifié le 11/09/2026 : l'écran embarquait aussi un formulaire de création,
 * ouvert par `route.params.openForm`, avec ses propres champs. Ce formulaire est
 * désormais engendré depuis le catalogue (`DemandeFormScreen`) : cet écran ne
 * fait plus qu'une chose, lister.
 *
 * Les libellés de statut viennent du serveur (`status_label`) ; la couleur est
 * le seul habillage local, et un statut inconnu reste affiché en gris plutôt que
 * d'être confondu avec « En attente ».
 */

import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getMyRequests, getCatalog } from '../api/eservice';
import { messageFor } from '../api/client';
import { statusColor, typeIcon } from '../config/eserviceFields';
import { formatDate } from '../utils/dates';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, Badge, SkeletonList } from '../components/ui';

export default function MesDemandesScreen({ navigation }) {
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, dirStyle, forwardIcon } = useLang();

  const [rows, setRows] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [status, setStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      const [res, cat] = await Promise.all([
        getMyRequests({ page: p, limit: 25, ...(status ? { status } : {}) }),
        statuses.length ? Promise.resolve(null) : getCatalog().catch(() => null),
      ]);
      if (cat?.statuses) setStatuses(cat.statuses);
      const list = res?.results || [];
      setPages(res?.pages || 1);
      setPage(p);
      setRows((prev) => (append ? [...prev, ...list] : list));
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger vos demandes.', 'تعذر تحميل طلباتك.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [status, statuses.length, t]);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  return (
    <Screen>
      <AppBar
        title={t('Mes demandes', 'طلباتي')}
        onBack={() => navigation.goBack()}
        actions={[{ icon: 'add', label: t('Nouvelle demande', 'طلب جديد'), onPress: () => navigation.navigate('DemandeForm') }]}
      />

      {statuses.length ? (
        <ChipRow>
          <Chip label={t('Toutes', 'الكل')} active={!status} onPress={() => { setStatus(null); setLoading(true); }} />
          {statuses.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              color={statusColor(s.value)}
              active={status === s.value}
              onPress={() => { setStatus(status === s.value ? null : s.value); setLoading(true); }}
            />
          ))}
        </ChipRow>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: spacing.sm }}>
          <Banner message={error} onRetry={() => load(1)} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={5} variant="row" /> : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => {
            const tint = statusColor(item.status);
            return (
              <TouchableOpacity
                style={[styles.row, {
                  backgroundColor: colors.bgCard,
                  paddingHorizontal: layout.gutter,
                  borderBottomColor: colors.borderLight,
                }]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('DemandeDetail', { demandeId: item.id })}
              >
                <View style={[styles.icon, { backgroundColor: `${tint}22`, borderRadius: radius.sm }]}>
                  <Ionicons name={typeIcon(item.type)} size={20} color={tint} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={1}>
                    {item.type_label || item.type}
                  </Text>
                  <Text style={T.caption} numberOfLines={1}>
                    {[`#${item.id}`, formatDate(item.created_at, lang)].filter(Boolean).join(' · ')}
                  </Text>
                  <Badge label={item.status_label || item.status} color={tint} />
                </View>
                <Ionicons name={forwardIcon} size={16} color={colors.border} />
              </TouchableOpacity>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(1); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.bgCard}
            />
          }
          onEndReached={() => { if (page < pages) load(page + 1, true); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              icon="documents-outline"
              title={status ? t('Aucune demande dans ce statut', 'لا توجد طلبات بهذه الحالة') : t('Aucune demande', 'لا توجد طلبات')}
              description={t('Déposez une demande depuis les services.', 'قدّم طلباً من الخدمات.')}
              actionTitle={t('Nouvelle demande', 'طلب جديد')}
              onAction={() => navigation.navigate('DemandeForm')}
            />
          }
          contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
});
