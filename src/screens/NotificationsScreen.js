/**
 * Notifications.
 *
 * Le serveur renvoie `output` : une phrase dÃ©jÃ  rÃ©digÃ©e, en HTML
 * (Â« <strong>X</strong> a crÃ©Ã© â€¦ Â»). L'afficher brut montrerait les balises ;
 * la passer Ã  un moteur de rendu HTML pour chaque ligne serait coÃ»teux. Les
 * balises sont donc retirÃ©es, et l'auteur affichÃ© sÃ©parÃ©ment â€” l'information est
 * la mÃªme, le rendu est instantanÃ©.
 *
 * `class` dit de quoi il s'agit (contenu crÃ©Ã©, mention, commentaire, Â« j'aime Â»).
 * On s'en sert pour l'icÃ´ne, avec un repli neutre : une classe inconnue reste
 * affichÃ©e, jamais masquÃ©e.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getNotifications, markSeen } from '../api/notifications';
import { messageFor } from '../api/client';
import { timeAgo } from '../utils/dates';
import { Screen, AppBar, Banner, EmptyState, Avatar, SkeletonList } from '../components/ui';

/** IcÃ´ne selon la classe de notification. Repli neutre si inconnue. */
function iconFor(cls) {
  const c = String(cls || '').toLowerCase();
  if (c.includes('comment')) return 'chatbubble-ellipses-outline';
  if (c.includes('like')) return 'heart-outline';
  if (c.includes('mentioned')) return 'at-outline';
  if (c.includes('follow')) return 'person-add-outline';
  if (c.includes('space')) return 'grid-outline';
  if (c.includes('calendar')) return 'calendar-outline';
  if (c.includes('contentcreated')) return 'document-text-outline';
  return 'notifications-outline';
}

/** Retire les balises et rÃ©tablit les entitÃ©s courantes. */
function toText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default function NotificationsScreen({ navigation }) {
  const { colors, spacing, layout, type: T } = useTheme();
  const { t, lang, dirStyle } = useLang();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      const res = await getNotifications(p, 25);
      const rows = res?.results || [];
      setPages(res?.pages || 1);
      setPage(p);
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger les notifications.', 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(1); }, [load]);

  // Marquer comme lues Ã  l'ouverture : c'est le comportement du web. En cas
  // d'Ã©chec on ne dit rien â€” l'utilisateur voit bien ses notifications.
  useEffect(() => { markSeen().catch(() => {}); }, []);

  return (
    <Screen>
      <AppBar
        title={t('Notifications', 'Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª')}
        onBack={() => navigation.goBack()}
        actions={[{
          icon: 'checkmark-done-outline',
          label: t('Tout marquer comme lu', 'ØªØ¹Ù„ÙŠÙ… Ø§Ù„ÙƒÙ„ ÙƒÙ…Ù‚Ø±ÙˆØ¡'),
          onPress: () => markSeen().then(() => load(1)).catch(() => {}),
        }]}
      />

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner message={error} onRetry={() => load(1)} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={6} variant="row" /> : (
        <FlatList
          data={items}
          keyExtractor={(n, index) => `${n.id ?? index}-${index}`}
          renderItem={({ item }) => {
            const text = toText(item.output);
            const who = item.originator?.display_name || '';
            return (
              <TouchableOpacity
                style={[styles.row, {
                  backgroundColor: colors.bgCard,
                  paddingHorizontal: layout.gutter,
                  borderBottomColor: colors.borderLight,
                }]}
                activeOpacity={0.85}
                onPress={() => {
                  // Le serveur ne donne pas d'identifiant de contenu exploitable
                  // pour toutes les classes ; on ouvre le profil de l'auteur
                  // quand c'est la seule cible sÃ»re.
                  if (item.originator?.url) {
                    navigation.navigate('WebView', { url: item.originator.url, title: who });
                  }
                }}
              >
                <Avatar name={who} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { color: colors.textPrimary, fontSize: 13 }, dirStyle]} numberOfLines={3}>
                    {text}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons name={iconFor(item.class)} size={12} color={colors.textMuted} />
                    <Text style={T.caption}>{timeAgo(item.createdAt || item.created_at, lang)}</Text>
                  </View>
                </View>
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
              icon="notifications-off-outline"
              title={t('Aucune notification', 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª')}
              description={t('Vous serez prÃ©venu des nouveautÃ©s qui vous concernent.',
                             'Ø³ÙŠØªÙ… Ø¥Ø¹Ù„Ø§Ù…Ùƒ Ø¨Ø§Ù„Ù…Ø³ØªØ¬Ø¯Ø§Øª Ø§Ù„ØªÙŠ ØªØ®ØµÙƒ.')}
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
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
});

