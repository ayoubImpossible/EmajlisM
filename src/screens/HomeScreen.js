/**
 * Accueil — fil unifié de la plateforme.
 *
 * Corrections du 10-11/09/2026 :
 *   - la carte lisait `item.post`, `item.calendarEntry`, `item.driveFile` —
 *     trois champs absents de la réponse — puis retombait sur `meta.url`, ce qui
 *     affichait un chemin d'URL en guise de titre. Le rendu est confié à
 *     `ContentCard`, qui s'appuie sur `item.type` ;
 *   - les filtres étaient cinq types écrits en dur, dont un qui ne correspondait
 *     à rien d'accessible. Ils viennent de `/api/feed/search/types` — onze types
 *     réels — avec repli sur « Tout » si la liste ne charge pas ;
 *   - les erreurs partaient dans la console : un fil vide à cause d'une panne
 *     ressemblait à un fil réellement vide. Elles sont affichées, avec
 *     « Réessayer » ;
 *   - le contenu des deux premiers éléments était journalisé à chaque
 *     chargement ;
 *   - thème clair/sombre, encoches respectées, et grille à deux ou trois
 *     colonnes sur tablette au lieu d'une colonne étirée.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { getFeed } from '../api/feed';
import { searchTypes } from '../api/search';
import { getUnseenCount } from '../api/notifications';
import { messageFor } from '../api/client';
import ContentCard from '../components/content/ContentCard';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, SkeletonList } from '../components/ui';

export default function HomeScreen({ navigation }) {
  const { colors, spacing, layout, type: T } = useTheme();
  const { t, lang, isRTL } = useLang();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(null);
  const [types, setTypes] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const [error, setError] = useState(null);

  // Les filtres viennent du serveur. S'ils échouent, « Tout » reste utilisable :
  // on ne remplace pas par une liste inventée.
  useEffect(() => {
    let alive = true;
    searchTypes()
      .then((list) => { if (alive) setTypes(Array.isArray(list) ? list : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      const params = filter ? { contentType: filter } : {};
      const res = await getFeed(p, 20, params);
      const results = res.results || [];
      setHasMore(p < (res.pages || 1));
      setPage(p);
      setItems((prev) => (append ? [...prev, ...results] : results));
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger le fil.', 'تعذر تحميل التدفق.')));
    } finally {
      setLoading(false); setLoadingMore(false); setRefreshing(false);
    }
  }, [filter, t]);

  useEffect(() => { setLoading(true); setItems([]); load(1); }, [filter, load]);

  useFocusEffect(useCallback(() => {
    getUnseenCount().then((d) => setUnseen(d?.count ?? d?.unseen ?? 0)).catch(() => {});
  }, []));

  const firstName = user?.firstname || user?.display_name?.split(' ')[0] || t('Membre', 'عضو');

  const filters = [
    { key: null, label: t('Tout', 'الكل') },
    ...types
      .map((ty) => ({ key: ty.class || ty.value || ty.id, label: ty.label || ty.name || '' }))
      .filter((x) => x.key && x.label),
  ];

  const columns = layout.columns;

  return (
    <Screen>
      <AppBar
        title={firstName}
        subtitle={t('Bonjour,', 'مرحباً،')}
        actions={[
          { icon: 'calendar-outline', onPress: () => navigation.navigate('Calendrier'), label: t('Agenda', 'الأجندة') },
          { icon: 'search-outline', onPress: () => navigation.navigate('Search'), label: t('Rechercher', 'بحث') },
          { icon: 'notifications-outline', onPress: () => navigation.navigate('Notifications'), badge: unseen, label: t('Notifications', 'الإشعارات') },
        ]}
      />

      <ChipRow>
        {filters.map((f) => (
          <Chip
            key={String(f.key)}
            label={f.label}
            active={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ChipRow>

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner
            message={error}
            onRetry={() => { setError(null); setLoading(true); load(1); }}
            onDismiss={() => setError(null)}
          />
        </View>
      ) : null}

      {loading ? (
        <SkeletonList count={4} />
      ) : (
        <FlatList
          data={items}
          key={`cols-${columns}`}   // changer le nombre de colonnes exige une nouvelle liste
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
          onEndReached={() => { if (!loadingMore && hasMore) { setLoadingMore(true); load(page + 1, true); } }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} />
              : !hasMore && items.length
                ? <Text style={[T.caption, { textAlign: 'center', margin: spacing.md }]}>
                    {t('Vous avez tout vu.', 'لقد اطلعت على كل شيء.')}
                  </Text>
                : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="file-tray-outline"
              title={t('Aucun contenu', 'لا يوجد محتوى')}
              description={filter
                ? t('Aucun élément de ce type pour le moment.', 'لا يوجد عنصر من هذا النوع حالياً.')
                : t('Le fil se remplira dès qu’un contenu sera publié.', 'سيمتلئ التدفق بمجرد نشر محتوى.')}
              actionTitle={filter ? t('Retirer le filtre', 'إزالة المرشح') : null}
              onAction={filter ? () => setFilter(null) : null}
            />
          }
          contentContainerStyle={{
            padding: layout.gutter,
            paddingBottom: spacing.xxl,
            flexGrow: 1,
            maxWidth: layout.isTablet ? layout.width : undefined,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
