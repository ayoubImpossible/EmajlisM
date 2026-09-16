import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getMyRequests, getCatalog } from '../api/eservice';
import { messageFor } from '../api/client';
import { statusColor, typeIcon } from '../config/eserviceFields';
import { formatDate } from '../utils/dates';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, SkeletonList } from '../components/ui';

export default function MesDemandesScreen({ navigation }) {
  const { colors, spacing, radius, shadow, layout, isDark, type: T } = useTheme();
  const { t, lang, dirStyle, forwardIcon } = useLang();

  const [rows, setRows]       = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [status, setStatus]   = useState(null);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState(null);

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

  const renderItem = ({ item, index }) => {
    const tint = statusColor(item.status);
    const isLast = index === rows.length - 1;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          shadow.sm,
          {
            backgroundColor: isDark ? colors.bgElevated : colors.bgCard,
            borderColor: colors.border,
            borderRadius: radius.lg,
            marginHorizontal: layout.gutter,
            marginBottom: isLast ? spacing.xxl : spacing.sm,
          },
        ]}
        activeOpacity={0.82}
        onPress={() => navigation.navigate('DemandeDetail', { demandeId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`${item.type_label || item.type}, #${item.id}, ${item.status_label || item.status}`}
      >
        {/* Accent bar on the left */}
        <View style={[styles.accentBar, { backgroundColor: tint, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg }]} />

        <View style={styles.cardBody}>
          {/* Top row: icon + title + arrow */}
          <View style={styles.topRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${tint}20`, borderRadius: radius.md }]}>
              <Ionicons name={typeIcon(item.type)} size={21} color={tint} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[T.bodyStrong, { fontSize: 14 }, dirStyle]} numberOfLines={1}>
                {item.type_label || item.type}
              </Text>
              <Text style={[T.caption, { color: colors.textMuted }]} numberOfLines={1}>
                {[`#${item.id}`, formatDate(item.created_at, lang)].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
            <Ionicons name={forwardIcon} size={15} color={colors.border} />
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {/* Bottom row: status pill + observations preview */}
          <View style={styles.bottomRow}>
            {/* Status pill */}
            <View style={[styles.pill, { backgroundColor: `${tint}18`, borderColor: `${tint}40` }]}>
              <View style={[styles.dot, { backgroundColor: tint }]} />
              <Text style={[styles.pillText, { color: tint }]}>
                {item.status_label || item.status}
              </Text>
            </View>

            {/* Observations preview if present */}
            {item.observations ? (
              <Text style={[T.caption, { flex: 1, color: colors.textMuted, textAlign: 'right' }]} numberOfLines={1}>
                {item.observations}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <AppBar
        title={t('Mes demandes', 'طلباتي')}
        onBack={() => navigation.goBack()}
        actions={[{
          icon: 'add-circle-outline',
          label: t('Nouvelle demande', 'طلب جديد'),
          onPress: () => navigation.navigate('DemandeForm'),
        }]}
      />

      {statuses.length ? (
        <ChipRow>
          <Chip
            label={t('Toutes', 'الكل')}
            active={!status}
            onPress={() => { setStatus(null); setLoading(true); }}
          />
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

      {loading ? (
        <SkeletonList count={5} variant="row" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderItem}
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
          ListHeaderComponent={<View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState
              icon="documents-outline"
              title={
                status
                  ? t('Aucune demande dans ce statut', 'لا توجد طلبات بهذه الحالة')
                  : t('Aucune demande', 'لا توجد طلبات')
              }
              description={t('Déposez une demande depuis les services.', 'قدّم طلباً من الخدمات.')}
              actionTitle={t('Nouvelle demande', 'طلب جديد')}
              onAction={() => navigation.navigate('DemandeForm')}
            />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
