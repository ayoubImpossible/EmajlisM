/**
 * Agenda.
 *
 * Corrigé le 11/09/2026 :
 *   - les événements étaient lus dans des champs inexistants et les dates
 *     passaient par `new Date("2026-09-16 10:00:00")`, invalide sur iOS : les
 *     réunions s'affichaient sans date sur iPhone. Tout passe par
 *     `utils/dates.js` ;
 *   - la liste n'était pas groupée : cinquante réunions s'enchaînaient sans
 *     repère. Elles sont regroupées par jour, avec les prochaines d'abord ;
 *   - la couleur renvoyée par HumHub (`color`) est utilisée, comme sur le web,
 *     pour distinguer les instances d'un coup d'œil.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getCalendar } from '../api/calendar';
import { messageFor } from '../api/client';
import { parseServerDate, formatDateLong, formatTime, dayKey } from '../utils/dates';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, SkeletonList } from '../components/ui';

export default function CalendrierScreen({ navigation }) {
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, dirStyle } = useLang();

  const [events, setEvents] = useState([]);
  const [scope, setScope] = useState('upcoming'); // 'upcoming' | 'past' | 'all'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getCalendar();
      setEvents(res?.results || res?.data || []);
      setError(null);
    } catch (e) {
      setError(messageFor(e, t("Impossible de charger l'agenda.", 'تعذر تحميل الأجندة.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => {
    const now = Date.now();

    const withDate = events
      .map((e) => ({ ...e, _start: parseServerDate(e.startDatetime || e.start_datetime || e.start_date) }))
      .filter((e) => e._start);

    const filtered = withDate.filter((e) => {
      if (scope === 'upcoming') return e._start.getTime() >= now - 12 * 3600 * 1000;
      if (scope === 'past') return e._start.getTime() < now;
      return true;
    });

    filtered.sort((a, b) => (scope === 'past'
      ? b._start - a._start
      : a._start - b._start));

    const byDay = new Map();
    for (const e of filtered) {
      const k = dayKey(e._start);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(e);
    }

    return [...byDay.entries()].map(([key, data]) => ({
      key,
      title: formatDateLong(data[0]._start, lang),
      data,
    }));
  }, [events, scope, lang]);

  const scopes = [
    { key: 'upcoming', label: t('À venir', 'القادمة') },
    { key: 'past', label: t('Passées', 'السابقة') },
    { key: 'all', label: t('Toutes', 'الكل') },
  ];

  return (
    <Screen>
      <AppBar title={t('Agenda', 'الأجندة')} onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />

      <ChipRow>
        {scopes.map((s) => (
          <Chip key={s.key} label={s.label} active={scope === s.key} onPress={() => setScope(s.key)} />
        ))}
      </ChipRow>

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner message={error} onRetry={load} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={5} variant="row" /> : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHead, { backgroundColor: colors.bgApp, paddingHorizontal: layout.gutter }]}>
              <Text style={[T.label, { color: colors.textSecondary }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const accent = /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : colors.primary;
            const end = parseServerDate(item.endDatetime || item.end_datetime);
            return (
              <TouchableOpacity
                style={[styles.card, {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  marginHorizontal: layout.gutter,
                }]}
                activeOpacity={0.85}
                onPress={() => {
                  if (item.url) navigation.navigate('WebView', { url: item.url, title: item.title });
                }}
              >
                <View style={[styles.accent, { backgroundColor: accent }]} />
                <View style={styles.cardBody}>
                  <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={3}>{item.title}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={T.caption}>
                      {item.allDay
                        ? t('Toute la journée', 'طوال اليوم')
                        : [formatTime(item._start), end ? formatTime(end) : null].filter(Boolean).join(' – ')}
                    </Text>
                  </View>
                  {item.location ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                      <Text style={T.caption} numberOfLines={2}>{item.location}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.bgCard}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={scope === 'upcoming'
                ? t('Aucune réunion à venir', 'لا توجد اجتماعات قادمة')
                : t('Aucune réunion', 'لا توجد اجتماعات')}
              actionTitle={scope !== 'all' ? t('Voir toutes les dates', 'عرض كل التواريخ') : null}
              onAction={scope !== 'all' ? () => setScope('all') : null}
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
  sectionHead: { paddingVertical: 8 },
  card: {
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 8,
  },
  accent: { width: 4 },
  cardBody: { flex: 1, padding: 12, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
