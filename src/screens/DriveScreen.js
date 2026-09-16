/**
 * Drive Manager — navigation dans les dossiers d'un espace.
 *
 * Corrigé le 10/09/2026 :
 *   - `openFile` lisait le jeton dans SecureStore puis ne s'en servait pas : il
 *     ouvrait l'URL dans le navigateur du téléphone, qui n'a pas la session. Le
 *     serveur répondait 401. Le téléchargement passe par `utils/files.js` ;
 *   - l'URL était fabriquée à la main vers le domaine HumHub ; elle vient
 *     maintenant du champ `api_download_url` renvoyé par le serveur ;
 *   - les erreurs étaient avalées dans `console.error` ; elles sont affichées ;
 *   - le fil d'Ariane était reconstruit depuis un historique local ; il vient du
 *     serveur, donc il reste juste même quand l'écran s'ouvre directement sur un
 *     sous-dossier (raccourci d'une page personnalisée).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { browse } from '../api/drive';
import { openFileInApp, downloadAuthenticatedFile } from '../utils/files';
import { messageFor } from '../api/client';
import { formatDate } from '../utils/dates';
import { Screen, AppBar, Banner, EmptyState, SkeletonList } from '../components/ui';

/** Icône et teinte par type de fichier. Un type inconnu garde une icône neutre. */
const MIME_META = {
  'application/pdf': { icon: 'document-text-outline', tone: 'danger' },
  'image/jpeg': { icon: 'image-outline', tone: 'tagPleniere' },
  'image/png': { icon: 'image-outline', tone: 'tagPleniere' },
  'application/msword': { icon: 'document-outline', tone: 'info' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'document-outline', tone: 'info' },
  'application/vnd.ms-excel': { icon: 'grid-outline', tone: 'success' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'grid-outline', tone: 'success' },
  'application/vnd.ms-powerpoint': { icon: 'easel-outline', tone: 'warning' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: 'easel-outline', tone: 'warning' },
  'application/zip': { icon: 'archive-outline', tone: 'textMuted' },
};

export default function DriveScreen({ route, navigation }) {
  const { containerId, spaceName, folderId: initFolder = null } = route.params || {};
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, dirStyle, forwardIcon } = useLang();

  const [data, setData] = useState(null);
  const [folderId, setFolderId] = useState(initFolder);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);  // file being downloaded
  const [opening, setOpening] = useState(null);           // file being opened
  const [progress, setProgress] = useState(0);

  const load = useCallback(async (fid, { refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      setData(await browse(containerId, fid || null));
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger ce dossier.', 'تعذر تحميل هذا المجلد.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [containerId, t]);

  useEffect(() => { load(folderId); }, [folderId, load]);

  const breadcrumb = data?.breadcrumb || [];

  const goBack = () => {
    if (breadcrumb.length > 1) setFolderId(breadcrumb[breadcrumb.length - 2].id);
    else if (breadcrumb.length === 1) setFolderId(null);
    else navigation.goBack();
  };

  // Tap on file row → open in-app viewer
  const openFile = async (file) => {
    if (opening || downloading) return;
    setOpening(file.id);
    const res = await openFileInApp(file);
    setOpening(null);
    if (!res.ok) { setError(res.reason); return; }
    navigation.navigate('WebView', {
      url: res.url,
      headers: res.headers,
      title: file.title || file.file_name || 'Fichier',
    });
  };

  // Tap on download icon → save/share
  const downloadFile = async (file) => {
    if (downloading || opening) return;
    setDownloading(file.id);
    setProgress(0);
    const res = await downloadAuthenticatedFile(file, setProgress);
    setDownloading(null); setProgress(0);
    if (!res.ok) setError(res.reason);
  };

  const folders = data?.folders || [];
  const files = data?.files || [];
  const items = [
    ...folders.map((f) => ({ ...f, _type: 'folder' })),
    ...files.map((f) => ({ ...f, _type: 'file' })),
  ];

  const crumbs = [{ id: null, name: spaceName || t('Documents', 'الوثائق') }, ...breadcrumb];

  const renderItem = ({ item }) => {
    if (item._type === 'folder') {
      return (
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.bgCard, paddingHorizontal: layout.gutter, borderBottomColor: colors.borderLight }]}
          onPress={() => setFolderId(item.id)}
          activeOpacity={0.85}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${colors.warning}22`, borderRadius: radius.sm }]}>
            <Ionicons name="folder" size={21} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={2}>{item.name}</Text>
            {typeof item.item_count === 'number' ? (
              <Text style={T.caption}>{item.item_count} {t('éléments', 'عناصر')}</Text>
            ) : null}
          </View>
          <Ionicons name={forwardIcon} size={16} color={colors.border} />
        </TouchableOpacity>
      );
    }

    const m = MIME_META[item.mime_type] || { icon: 'document-outline', tone: 'textMuted' };
    const tint = colors[m.tone] || colors.textMuted;
    const busy = downloading === item.id || opening === item.id;
    const isDownloading = downloading === item.id;
    const isOpening = opening === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: colors.bgCard, paddingHorizontal: layout.gutter, borderBottomColor: colors.borderLight },
          busy && { opacity: 0.85 },
        ]}
        onPress={() => openFile(item)}
        activeOpacity={0.85}
        disabled={busy}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${tint}22`, borderRadius: radius.sm }]}>
          {isOpening
            ? <ActivityIndicator size="small" color={tint} />
            : <Ionicons name={m.icon} size={20} color={tint} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={2}>
            {item.title || item.file_name}
          </Text>
          <Text style={T.caption}>
            {[item.human_size, formatDate(item.created_at, lang)].filter(Boolean).join(' · ')}
          </Text>
          {isDownloading ? (
            <View style={[styles.track, { backgroundColor: colors.borderLight }]}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          ) : null}
        </View>
        {/* Download icon — separate from open action */}
        <TouchableOpacity
          onPress={() => openFile(item)}
          disabled={busy}
          hitSlop={10}
          style={{ padding: 4 }}
        >
          {isOpening
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="eye-outline" size={19} color={colors.textMuted} />}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => downloadFile(item)}
          disabled={busy}
          hitSlop={10}
          style={{ padding: 4 }}
        >
          {isDownloading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="cloud-download-outline" size={19} color={colors.textMuted} />}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <AppBar
        title={crumbs[crumbs.length - 1]?.name || t('Documents', 'الوثائق')}
        subtitle={crumbs.length > 1 ? crumbs.slice(0, -1).map((c) => c.name).join(' › ') : undefined}
        onBack={goBack}
      />

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner message={error} onDismiss={() => setError(null)} onRetry={() => load(folderId)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={6} variant="row" /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item._type}-${item.id}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(folderId, { refresh: true })}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.bgCard}
            />
          }
          ListHeaderComponent={
            <View style={{ paddingHorizontal: layout.gutter, paddingVertical: spacing.sm }}>
              <Text style={T.caption}>
                {folders.length} {t('dossiers', 'مجلدات')} · {files.length} {t('fichiers', 'ملفات')}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="folder-open-outline"
              title={t('Dossier vide', 'المجلد فارغ')}
              description={t('Rien à afficher ici pour le moment.', 'لا شيء لعرضه هنا حالياً.')}
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
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  track: { height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  fill: { height: 3 },
});
