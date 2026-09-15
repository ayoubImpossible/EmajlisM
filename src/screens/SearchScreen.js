/**
 * Recherche.
 *
 * Corrigé le 11/09/2026 :
 *   - `searchTypes` renvoyait deux types écrits en dur (Post, CalendarEntry) :
 *     l'utilisateur ne pouvait chercher que dans deux types sur onze, sans
 *     jamais savoir que les autres existaient. La liste vient du serveur ;
 *   - les résultats passaient par un rendu maison lisant des champs
 *     inexistants ; ils passent par `ContentRow`, avec repli générique ;
 *   - la recherche dans un espace fonctionne : `containerId` est transmis, ce
 *     qui rend utilisables les pages « Recherche » des espaces.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { search, searchTypes } from '../api/search';
import { messageFor } from '../api/client';
import { ContentRow } from '../components/content/ContentCard';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, SkeletonList } from '../components/ui';

export default function SearchScreen({ route, navigation }) {
  const { containerId, title } = route.params || {};
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, isRTL, dirStyle } = useLang();

  const [keyword, setKeyword] = useState('');
  const [types, setTypes] = useState([]);
  const [type, setType] = useState(null);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let alive = true;
    searchTypes().then((l) => { if (alive) setTypes(Array.isArray(l) ? l : []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const run = useCallback(async (p = 1, append = false) => {
    const kw = keyword.trim();
    if (!kw) return;
    if (append) setLoadingMore(true); else { setLoading(true); Keyboard.dismiss(); }
    setError(null);
    try {
      const params = {};
      if (type) params.contentType = type;
      if (containerId) params.containerId = containerId;
      const res = await search(kw, p, params);
      const list = res.results || [];
      setTotal(res.total || 0);
      setPages(res.pages || 1);
      setPage(p);
      setResults((prev) => (append ? [...prev, ...list] : list));
      setSearched(true);
    } catch (e) {
      setError(messageFor(e, t('La recherche a échoué.', 'فشل البحث.')));
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [keyword, type, containerId, t]);

  // Relance quand le filtre change, si une recherche a déjà eu lieu.
  useEffect(() => { if (searched && keyword.trim()) run(1); /* eslint-disable-next-line */ }, [type]);

  return (
    <Screen>
      <AppBar title={title ? `${t('Rechercher dans', 'ابحث في')} ${title}` : t('Rechercher', 'بحث')} onBack={() => navigation.goBack()} />

      <View style={[styles.searchWrap, { backgroundColor: colors.bgHeader, paddingHorizontal: layout.gutter, borderBottomColor: colors.borderLight }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgApp, borderRadius: radius.md }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }, dirStyle]}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => run(1)}
            placeholder={t('Mot-clé…', 'كلمة للبحث…')}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoFocus
          />
          {keyword ? (
            <TouchableOpacity onPress={() => { setKeyword(''); setResults([]); setSearched(false); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {types.length ? (
        <ChipRow>
          <Chip label={t('Tout', 'الكل')} active={!type} onPress={() => setType(null)} />
          {types.map((ty) => {
            const key = ty.class || ty.value || ty.id;
            const label = ty.label || ty.name || '';
            if (!key || !label) return null;
            return (
              <Chip
                key={String(key)}
                label={label}
                active={type === key}
                onPress={() => setType(type === key ? null : key)}
              />
            );
          })}
        </ChipRow>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner message={error} onRetry={() => run(1)} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {searched && !loading ? (
        <Text style={[T.caption, { paddingHorizontal: layout.gutter, paddingVertical: 6 }]}>
          {total} {t('résultat(s)', 'نتيجة')}
        </Text>
      ) : null}

      {loading ? <SkeletonList count={6} variant="row" /> : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ContentRow
              item={item}
              lang={lang}
              isRTL={isRTL}
              onPress={(it) => navigation.navigate('ContentDetail', { item: it })}
            />
          )}
          onEndReached={() => { if (!loadingMore && page < pages) run(page + 1, true); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              icon={searched ? 'search-outline' : 'text-outline'}
              title={searched ? t('Aucun résultat', 'لا توجد نتائج') : t('Saisissez un mot-clé', 'أدخل كلمة للبحث')}
              description={searched && type
                ? t('Essayez sans filtre de type.', 'جرّب بدون مرشح النوع.')
                : null}
              actionTitle={searched && type ? t('Retirer le filtre', 'إزالة المرشح') : null}
              onAction={searched && type ? () => setType(null) : null}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  input: { flex: 1, fontSize: 14, padding: 0 },
});
