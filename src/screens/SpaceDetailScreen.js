/**
 * Espace : menu construit depuis le serveur, puis fil de l'espace.
 *
 * Règle tenue ici : **aucun test sur le nom de l'espace**. Le menu vient de
 * `/api/spaces/:cid/modules` (ce que l'espace contient réellement) et de
 * `/api/spaces/:cid/pages` (les pages du menu web, avec leur raccourci déjà
 * résolu). Ajouter un module ou une page côté web les fait apparaître ici sans
 * toucher à l'application.
 *
 * Ce que le serveur ne peut pas dire est dit à l'utilisateur : HumHub n'expose
 * pas la liste des modules activés (BG-13), donc un module activé mais vide
 * n'apparaît pas. Ce n'est pas un oubli, c'est une limite mesurée.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getSpaceFeed, getSpaceModules, getSpacePages, getSpaceMembers } from '../api/spaces';
import { messageFor } from '../api/client';
import ContentCard from '../components/content/ContentCard';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, SkeletonList } from '../components/ui';

/**
 * Apparence et destination de chaque module. La liste des modules PRÉSENTS vient
 * du serveur ; ceci ne fait que dire comment les afficher et où ils mènent.
 * Un module inconnu reste affiché, avec une icône neutre, et filtre le fil.
 */
const MODULE_UI = {
  'drive-manager': { icon: 'folder-open-outline', fr: 'Documents', ar: 'الوثائق', target: 'drive' },
  cfiles: { icon: 'documents-outline', fr: 'Fichiers', ar: 'الملفات', target: 'filter:cfile' },
  calendar: { icon: 'calendar-outline', fr: 'Agenda', ar: 'الأجندة', target: 'filter:calendar' },
  tasks: { icon: 'checkbox-outline', fr: 'Tâches', ar: 'المهام', target: 'web' },
  polls: { icon: 'stats-chart-outline', fr: 'Sondages', ar: 'استطلاعات', target: 'web' },
  custom_pages: { icon: null }, // rendu par la liste des pages, pas comme un bouton
};

/** Icône FontAwesome de HumHub -> Ionicons. Repli neutre si inconnue. */
const PAGE_ICON = {
  'fa-search': 'search-outline',
  'fa-archive': 'archive-outline',
  'fa-folder': 'folder-outline',
  'fa-file': 'document-outline',
  'fa-link': 'link-outline',
  'fa-calendar': 'calendar-outline',
  'fa-book': 'book-outline',
  'fa-info': 'information-circle-outline',
};
const iconForPage = (fa) => PAGE_ICON[fa] || 'ellipse-outline';

export default function SpaceDetailScreen({ route, navigation }) {
  const { space } = route.params;
  const { colors, spacing, layout, type: T } = useTheme();
  const { t, lang, isRTL } = useLang();

  const cid = space.contentcontainer_id || space.id;

  // mounted ref — all async callbacks check this before touching state.
  // When the screen unmounts (user navigated back), all in-flight requests
  // silently discard their results instead of calling setState on an
  // unmounted component and triggering background API calls.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [menu, setMenu] = useState([]);
  const [pages, setPages] = useState([]);
  const [memberCount, setMemberCount] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Menu et effectif: annulé si l'écran se démonte.
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    Promise.allSettled([
      getSpaceModules(cid, signal),
      getSpacePages(cid, signal),
      getSpaceMembers(space.id, 1, 1, signal),
    ]).then(([mods, pgs, mem]) => {
      if (signal.aborted) return;
      if (mods.status === 'fulfilled') setMenu(mods.value?.menu || []);
      if (pgs.status === 'fulfilled') setPages((pgs.value?.results || []).filter((p) => !p.hidden));
      if (mem.status === 'fulfilled' && typeof mem.value?.total === 'number') setMemberCount(mem.value.total);
      setMenuLoading(false);
    });
    return () => controller.abort();
  }, [cid, space.id]);

  const load = useCallback(async (p = 1, append = false, signal = null) => {
    try {
      const res = await getSpaceFeed(cid, p, 20, signal);
      if (signal?.aborted) return;
      const results = res.results || [];
      setHasMore(p < (res.pages || 1));
      setPage(p);
      setItems((prev) => (append ? [...prev, ...results] : results));
      setError(null);
    } catch (e) {
      if (e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') return;
      setError(messageFor(e, t('Impossible de charger le fil.', 'تعذر تحميل التدفق.')));
    } finally {
      if (!signal?.aborted) {
        setLoading(false); setLoadingMore(false); setRefreshing(false);
      }
    }
  }, [cid, t]);

  useEffect(() => {
    const controller = new AbortController();
    load(1, false, controller.signal);
    return () => controller.abort(); // Cancels the HTTP request immediately on unmount
  }, [load]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const openWeb = (path, title) => {
    // `space.url` est l'adresse web de l'espace, renvoyée par le serveur : on ne
    // reconstruit pas le domaine HumHub à la main.
    const base = String(space.url || '').replace(/\/+$/, '');
    if (!base) {
      setError(t("Cette section n'est accessible que depuis le web.", 'هذا القسم متاح فقط عبر الويب.'));
      return;
    }
    navigation.navigate('WebView', { url: `${base}${path}`, title });
  };

  const openModule = (id) => {
    const ui = MODULE_UI[id] || {};
    const title = ui[lang === 'ar' ? 'ar' : 'fr'] || id;

    if (ui.target === 'drive') {
      navigation.navigate('Drive', { containerId: cid, spaceName: space.name });
    } else if (String(ui.target || '').startsWith('filter:')) {
      const kind = ui.target.split(':')[1];
      setFilter((prev) => (prev === kind ? null : kind));
    } else if (ui.target === 'web') {
      openWeb(`/${id}`, title);
    } else {
      setFilter((prev) => (prev === id ? null : id));
    }
  };

  const openPage = (p) => {
    const s = p.shortcut;
    if (!s) { openWeb(`/custom_pages/view/view?id=${p.id}`, p.title); return; }

    switch (s.kind) {
      case 'drive':
        navigation.navigate('Drive', { containerId: cid, spaceName: p.title, folderId: s.folderId });
        break;
      case 'search':
        navigation.navigate('Search', { containerId: cid, containerGuid: s.containerGuid, title: p.title });
        break;
      case 'cfiles':
        openWeb(`/cfiles/browse/index?fid=${s.folderId}`, p.title);
        break;
      case 'internal':
        openWeb(String(s.url || '').replace(String(space.url || '').replace(/\/+$/, ''), ''), p.title);
        break;
      case 'external':
        navigation.navigate('WebView', { url: s.url, title: p.title });
        break;
      default:
        openWeb(`/custom_pages/view/view?id=${p.id}`, p.title);
    }
  };

  const visible = filter ? items.filter((i) => i.type === filter) : items;
  const columns = layout.columns;

  const buttons = menu
    .filter((id) => id !== 'custom_pages')
    .map((id) => {
      const ui = MODULE_UI[id] || {};
      const target = String(ui.target || '');
      return {
        id,
        icon: ui.icon || 'ellipse-outline',
        label: ui[lang === 'ar' ? 'ar' : 'fr'] || id.replace(/[-_]/g, ' '),
        active: target.startsWith('filter:') && filter === target.split(':')[1],
      };
    });

  return (
    <Screen>
      <AppBar
        title={space.name}
        subtitle={memberCount !== null ? `${memberCount} ${t('membres', 'أعضاء')}` : undefined}
        onBack={() => navigation.goBack()}
        color={colors.primary}
        actions={[
          { icon: 'people-outline', onPress: () => navigation.navigate('Membres', { spaceId: space.id, spaceName: space.name }), label: t('Membres', 'الأعضاء') },
          { icon: 'search', onPress: () => navigation.navigate('Search', { containerId: cid, containerGuid: space.guid, title: space.name }), label: t('Rechercher', 'بحث') },
        ]}
      />

      {!!space.description && (
        <View style={[styles.desc, { backgroundColor: colors.bgHeader, padding: spacing.md, borderBottomColor: colors.borderLight }]}>
          <Text style={T.body} numberOfLines={3}>{space.description}</Text>
        </View>
      )}

      {menuLoading ? (
        <View style={{ padding: spacing.md, backgroundColor: colors.bgHeader }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (buttons.length || pages.length) ? (
        <ChipRow>
          {buttons.map((b) => (
            <Chip key={b.id} label={b.label} icon={b.icon} active={b.active} onPress={() => openModule(b.id)} />
          ))}
          {pages.map((p) => (
            <Chip key={`page-${p.id}`} label={p.title} icon={iconForPage(p.icon)} onPress={() => openPage(p)} />
          ))}
        </ChipRow>
      ) : null}

      {error || filter ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm }}>
          {error ? <Banner message={error} onRetry={() => load(1)} onDismiss={() => setError(null)} /> : null}
          {filter ? (
            <Banner
              tone="info"
              message={`${t('Filtré', 'مُصفّى')} — ${visible.length} ${t('élément(s) sur cette page', 'عنصر في هذه الصفحة')}`}
              onDismiss={() => setFilter(null)}
            />
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <SkeletonList count={3} />
      ) : (
        <FlatList
          data={visible}
          key={`cols-${columns}`}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: spacing.sm } : undefined}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={columns > 1 ? { flex: 1 / columns } : undefined}>
              <ContentCard
                item={item}
                lang={lang}
                isRTL={isRTL}
                onPress={(it) => navigation.navigate('ContentDetail', { item: it })}
              />
            </View>
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
          onEndReached={() => { if (!loadingMore && hasMore && !filter) { setLoadingMore(true); load(page + 1, true); } }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} /> : null}
          ListEmptyComponent={
            <EmptyState
              icon="file-tray-outline"
              title={filter
                ? t('Aucun élément de ce type sur cette page', 'لا يوجد عنصر من هذا النوع في هذه الصفحة')
                : t('Aucun contenu', 'لا يوجد محتوى')}
              actionTitle={filter ? t('Retirer le filtre', 'إزالة المرشح') : null}
              onAction={filter ? () => setFilter(null) : null}
            />
          }
          contentContainerStyle={{ padding: layout.gutter, paddingBottom: spacing.xxl, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  desc: { borderBottomWidth: StyleSheet.hairlineWidth },
});
