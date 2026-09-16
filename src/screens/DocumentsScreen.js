/**
 * Documents — onglet Drive : fichiers récents + navigation par espace.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import api, { messageFor } from '../api/client';
import { getSpaces } from '../api/spaces';
import { openFileInApp, downloadAuthenticatedFile } from '../utils/files';
import { formatDate } from '../utils/dates';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, SkeletonList } from '../components/ui';

const DRIVE_FILE_MODEL = 'humhub\\modules\\driveManager\\models\\DriveFile';

const MIME_META = {
  'application/pdf':                                                             { icon: 'document-text-outline', tone: 'danger' },
  'application/msword':                                                          { icon: 'document-outline',      tone: 'info' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':    { icon: 'document-outline',      tone: 'info' },
  'application/vnd.ms-excel':                                                    { icon: 'grid-outline',          tone: 'success' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':          { icon: 'grid-outline',          tone: 'success' },
  'application/vnd.ms-powerpoint':                                               { icon: 'easel-outline',         tone: 'warning' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':  { icon: 'easel-outline',         tone: 'warning' },
};

export default function DocumentsScreen({ navigation }) {
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, dirStyle, forwardIcon } = useLang();

  const [tab, setTab]             = useState('recents');
  const [recents, setRecents]     = useState([]);
  const [spaces, setSpaces]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [opening, setOpening]     = useState(null);
  const [progress, setProgress]   = useState(0);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [feed, sp] = await Promise.all([
        api.get('/feed', { params: { limit: 40, contentType: DRIVE_FILE_MODEL } }),
        getSpaces(1, 50),
      ]);
      setRecents(feed.data?.results || []);
      setSpaces(sp?.results || []);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger les documents.', 'تعذر تحميل الوثائق.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // Tap row → open in-app viewer
  const openFile = async (item) => {
    if (opening || downloading) return;
    const e = item.extra || {};
    setOpening(item.id);
    const res = await openFileInApp(
      { api_download_url: e.downloadPath, title: item.title, mime_type: e.mimeType },
    );
    setOpening(null);
    if (!res.ok) { setError(res.reason); return; }
    navigation.navigate('WebView', {
      url: res.url,
      headers: res.headers,
      title: item.title || 'Fichier',
    });
  };

  // Tap download icon → save/share
  const download = async (item) => {
    if (downloading || opening) return;
    const e = item.extra || {};
    setDownloading(item.id);
    setProgress(0);
    const res = await downloadAuthenticatedFile(
      { api_download_url: e.downloadPath, title: item.title, mime_type: e.mimeType },
      setProgress,
    );
    setDownloading(null); setProgress(0);
    if (!res.ok) setError(res.reason);
  };

  const renderRecent = ({ item }) => {
    const e = item.extra || {};
    const m = MIME_META[e.mimeType] || { icon: 'document-outline', tone: 'textMuted' };
    const tint = colors[m.tone] || colors.textMuted;
    const busy        = downloading === item.id || opening === item.id;
    const isOpening   = opening === item.id;
    const isDownloading = downloading === item.id;

    return (
      <TouchableOpacity
        style={[styles.row, {
          backgroundColor: colors.bgCard,
          paddingHorizontal: layout.gutter,
          borderBottomColor: colors.borderLight,
        }]}
        onPress={() => openFile(item)}
        disabled={busy}
        activeOpacity={0.85}
      >
        {/* File type icon */}
        <View style={[styles.iconWrap, { backgroundColor: `${tint}22`, borderRadius: radius.sm }]}>
          {isOpening
            ? <ActivityIndicator size="small" color={tint} />
            : <Ionicons name={m.icon} size={20} color={tint} />}
        </View>

        {/* Title + meta */}
        <View style={{ flex: 1 }}>
          <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={T.caption} numberOfLines={1}>
            {[e.humanSize, item.author?.name, formatDate(item.createdAt, lang)].filter(Boolean).join(' · ')}
          </Text>
          {isDownloading ? (
            <View style={[styles.track, { backgroundColor: colors.borderLight }]}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          ) : null}
        </View>

        {/* Open icon */}
        <TouchableOpacity
          onPress={() => openFile(item)}
          disabled={busy}
          hitSlop={10}
          style={styles.actionBtn}
        >
          {isOpening
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="eye-outline" size={19} color={colors.textMuted} />}
        </TouchableOpacity>

        {/* Download icon */}
        <TouchableOpacity
          onPress={() => download(item)}
          disabled={busy}
          hitSlop={10}
          style={styles.actionBtn}
        >
          {isDownloading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="cloud-download-outline" size={19} color={colors.textMuted} />}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSpace = ({ item }) => (
    <TouchableOpacity
      style={[styles.row, {
        backgroundColor: colors.bgCard,
        paddingHorizontal: layout.gutter,
        borderBottomColor: colors.borderLight,
      }]}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('Drive', {
        containerId: item.contentcontainer_id,
        spaceName: item.name,
      })}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
        <Ionicons name="folder-open-outline" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={2}>{item.name}</Text>
        {item.description
          ? <Text style={T.caption} numberOfLines={1}>{item.description}</Text>
          : null}
      </View>
      <Ionicons name={forwardIcon} size={16} color={colors.border} />
    </TouchableOpacity>
  );

  return (
    <Screen>
      <AppBar title={t('Documents', 'الوثائق')} large />

      <ChipRow>
        <Chip label={t('Récents', 'الأحدث')} icon="time-outline"  active={tab === 'recents'} onPress={() => setTab('recents')} />
        <Chip label={t('Par espace', 'حسب الفضاء')} icon="grid-outline" active={tab === 'espaces'} onPress={() => setTab('espaces')} />
      </ChipRow>

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner message={error} onRetry={() => load()} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={6} variant="row" /> : (
        <FlatList
          data={tab === 'recents' ? recents : spaces}
          keyExtractor={(item) => String(item.id)}
          renderItem={tab === 'recents' ? renderRecent : renderSpace}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ refresh: true })}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.bgCard}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="file-tray-outline"
              title={t('Aucun document', 'لا توجد وثائق')}
              description={tab === 'recents'
                ? t('Les documents déposés apparaîtront ici.', 'ستظهر الوثائق المودعة هنا.')
                : null}
              actionTitle={tab === 'recents' ? t('Parcourir par espace', 'تصفح حسب الفضاء') : null}
              onAction={tab === 'recents' ? () => setTab('espaces') : null}
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { padding: 4 },
  track: { height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  fill:  { height: 3 },
});
