/**
 * Membres d'un espace.
 *
 * Corrigé le 11/09/2026. Deux constats mesurés ce jour-là :
 *
 *  1. L'écran appelait `/api/membres`, l'annuaire **général** de la plateforme :
 *     il affichait donc les mêmes personnes quel que soit l'espace consulté.
 *  2. Cet annuaire général **n'est pas accessible** : `/user` et `/user/{id}`
 *     répondent 401 à un membre ordinaire, HumHub les réservant aux
 *     administrateurs (BG-14). L'écran ne pouvait donc rien afficher du tout.
 *
 * Ce qui est accessible, c'est la composition d'un espace
 * (`/api/spaces/:id/members`). L'écran est donc rattaché à un espace. Ouvert
 * sans espace, il propose de choisir lequel — plutôt que d'échouer.
 *
 * L'API de composition ne renvoie ni photo ni fiche détaillée, seulement
 * l'identité, le rôle et la date d'adhésion. Les initiales remplacent la photo,
 * et la fiche complète s'ouvre sur le profil web de la personne : c'est ce que
 * le serveur permet, et l'écran ne prétend pas à plus.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getSpaceMembers, getSpaces } from '../api/spaces';
import { messageFor } from '../api/client';
import { formatDate } from '../utils/dates';
import { Screen, AppBar, Banner, EmptyState, Avatar, Badge, SkeletonList } from '../components/ui';

export default function MembresScreen({ route, navigation }) {
  const { spaceId: initialSpace, spaceName } = route.params || {};
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, isRTL, dirStyle, forwardIcon } = useLang();

  const [spaceId, setSpaceId] = useState(initialSpace || null);
  const [title, setTitle] = useState(spaceName || '');
  const [spaces, setSpaces] = useState([]);
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Sans espace choisi : on propose la liste des espaces.
  useEffect(() => {
    if (spaceId) return;
    let alive = true;
    getSpaces(1, 50)
      .then((r) => { if (alive) setSpaces(r?.results || []); })
      .catch((e) => { if (alive) setError(messageFor(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [spaceId]);

  const load = useCallback(async (p = 1, append = false) => {
    if (!spaceId) return;
    if (!append) setLoading(true);
    try {
      const res = await getSpaceMembers(spaceId, p, 50);
      const rows = (res?.results || []).map((m) => ({
        id: m.user?.id ?? m.id,
        name: m.user?.display_name || '',
        url: m.user?.url || null,
        role: m.role || null,
        since: m.member_since || null,
        lastVisit: m.last_visit || null,
      }));
      setTotal(res?.total || rows.length);
      setPages(res?.pages || 1);
      setPage(p);
      setMembers((prev) => (append ? [...prev, ...rows] : rows));
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger les membres.', 'تعذر تحميل الأعضاء.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [spaceId, t]);

  useEffect(() => { load(1); }, [load]);

  // Filtrage local : l'API de composition n'a pas de paramètre de recherche.
  const q = query.trim().toLowerCase();
  const visible = q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;

  const openProfile = (m) => {
    if (!m.url) {
      setError(t("Le profil de cette personne n'est pas accessible.", 'ملف هذا الشخص غير متاح.'));
      return;
    }
    navigation.navigate('WebView', { url: m.url, title: m.name });
  };

  // ── Choix de l'espace ─────────────────────────────────────────────────────
  if (!spaceId) {
    return (
      <Screen>
        <AppBar title={t('Membres', 'الأعضاء')} onBack={() => navigation.goBack()} />
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner
            tone="info"
            message={t(
              "Les membres se consultent espace par espace : l'API ne publie pas d'annuaire général.",
              'يتم عرض الأعضاء حسب الفضاء: لا توفر الواجهة دليلاً عاماً.',
            )}
          />
        </View>
        {loading ? <SkeletonList count={5} variant="row" /> : (
          <FlatList
            data={spaces}
            keyExtractor={(s) => String(s.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { backgroundColor: colors.bgCard, paddingHorizontal: layout.gutter, borderBottomColor: colors.borderLight }]}
                onPress={() => { setSpaceId(item.id); setTitle(item.name); setLoading(true); }}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
                  <Ionicons name="people-outline" size={19} color={colors.primary} />
                </View>
                <Text style={[T.bodyStrong, { flex: 1 }, dirStyle]} numberOfLines={2}>{item.name}</Text>
                <Ionicons name={forwardIcon} size={16} color={colors.border} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<EmptyState icon="grid-outline" title={t('Aucun espace', 'لا توجد فضاءات')} />}
            contentContainerStyle={{ flexGrow: 1 }}
          />
        )}
      </Screen>
    );
  }

  // ── Membres de l'espace ───────────────────────────────────────────────────
  return (
    <Screen>
      <AppBar
        title={title || t('Membres', 'الأعضاء')}
        subtitle={`${total} ${t('membres', 'أعضاء')}`}
        onBack={() => navigation.goBack()}
        actions={initialSpace ? [] : [{ icon: 'swap-horizontal-outline', onPress: () => { setSpaceId(null); setMembers([]); setLoading(true); }, label: t("Changer d'espace", 'تغيير الفضاء') }]}
      />

      <View style={[styles.searchWrap, { backgroundColor: colors.bgHeader, paddingHorizontal: layout.gutter, borderBottomColor: colors.borderLight }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgApp, borderRadius: radius.md }]}>
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }, dirStyle]}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Filtrer par nom', 'تصفية بالاسم')}
            placeholderTextColor={colors.textMuted}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner message={error} onRetry={() => load(1)} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={6} variant="row" /> : (
        <FlatList
          data={visible}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.bgCard, paddingHorizontal: layout.gutter, borderBottomColor: colors.borderLight }]}
              onPress={() => openProfile(item)}
              activeOpacity={0.85}
            >
              <Avatar name={item.name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={1}>{item.name}</Text>
                <Text style={T.caption} numberOfLines={1}>
                  {item.since ? `${t('Membre depuis', 'عضو منذ')} ${formatDate(item.since, lang)}` : ''}
                </Text>
              </View>
              {item.role === 'admin' ? (
                <Badge label={t('Responsable', 'مسؤول')} color={colors.primary} icon="shield-checkmark-outline" />
              ) : null}
              <Ionicons name={forwardIcon} size={15} color={colors.border} />
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(1); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.bgCard}
            />
          }
          onEndReached={() => { if (page < pages && !q) load(page + 1, true); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={q ? t('Aucun nom ne correspond', 'لا يوجد اسم مطابق') : t('Aucun membre', 'لا يوجد أعضاء')}
              actionTitle={q ? t('Effacer le filtre', 'مسح المرشح') : null}
              onAction={q ? () => setQuery('') : null}
            />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xxl }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  input: { flex: 1, fontSize: 13.5, padding: 0 },
});
