/**
 * Espaces.
 *
 * Les 14 espaces visibles viennent du serveur. À ne pas confondre avec
 * l'ancienne liste de huit espaces écrite en dur dans `config/api.js`, qui a été
 * retirée : les effectifs y étaient figés et trois espaces manquaient.
 *
 * Mise à jour du 11/09/2026 : grille à deux ou trois colonnes sur tablette,
 * couleurs du thème, et recherche locale sur le nom.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getSpaces } from '../api/spaces';
import { messageFor } from '../api/client';
import { Screen, AppBar, Banner, EmptyState, SkeletonList } from '../components/ui';

export default function EspacesScreen({ navigation }) {
  const { colors, spacing, radius, shadow, layout, isDark, type: T } = useTheme();
  const { t, dirStyle } = useLang();

  const [spaces, setSpaces] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getSpaces(1, 50);
      setSpaces(res?.results || []);
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger les espaces.', 'تعذر تحميل الفضاءات.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? spaces.filter((s) => `${s.name} ${s.description || ''}`.toLowerCase().includes(q))
    : spaces;

  const columns = layout.columns;

  return (
    <Screen>
      <AppBar title={t('Espaces', 'الفضاءات')} large />

      <View style={[styles.searchWrap, { backgroundColor: colors.bgHeader, paddingHorizontal: layout.gutter, borderBottomColor: colors.borderLight }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgApp, borderRadius: radius.md }]}>
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.textPrimary }, dirStyle]}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Filtrer les espaces', 'تصفية الفضاءات')}
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
          <Banner message={error} onRetry={load} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={5} /> : (
        <FlatList
          data={visible}
          key={`cols-${columns}`}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: spacing.sm } : undefined}
          keyExtractor={(s) => String(s.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.card,
                shadow.sm,
                {
                  flex: columns > 1 ? 1 / columns : undefined,
                  backgroundColor: isDark ? colors.bgElevated : colors.bgCard,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SpaceDetail', { space: item })}
            >
              <View style={[styles.icon, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
                <Ionicons name="grid-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[T.h4, dirStyle]} numberOfLines={2}>{item.name}</Text>
              {item.description ? (
                <Text style={[T.caption, dirStyle]} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </TouchableOpacity>
          )}
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
              icon="grid-outline"
              title={q ? t('Aucun espace ne correspond', 'لا يوجد فضاء مطابق') : t('Aucun espace', 'لا توجد فضاءات')}
              actionTitle={q ? t('Effacer le filtre', 'مسح المرشح') : null}
              onAction={q ? () => setQuery('') : null}
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
  card: { borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  searchWrap: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  input: { flex: 1, fontSize: 13.5, padding: 0 },
});
