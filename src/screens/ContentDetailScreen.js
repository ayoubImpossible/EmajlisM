/**
 * Détail d'un contenu — quel que soit son type — avec le bloc social.
 *
 * Corrections :
 *  - encodage UTF-8 corrigé (caractères corrompus)
 *  - les liens <a> dans le corps HTML sont maintenant cliquables
 *  - les URLs brutes dans le texte plain-text sont détectées et cliquables
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, useWindowDimensions, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { getContent } from '../api/content';
import { getComments, addComment, deleteComment, getLikeStatus, like, unlike } from '../api/social';
import { messageFor } from '../api/client';
import { openFileInApp, downloadAuthenticatedFile } from '../utils/files';
import { bodyToHtml } from '../utils/markdown';
import { formatDateTime, timeAgo } from '../utils/dates';
import { typeMeta, typeLabel } from '../components/content/ContentCard';
import AuthedImage from '../components/common/AuthedImage';
import { Screen, AppBar, Card, Button, Banner, Avatar, Badge } from '../components/ui';

// Detect URLs in plain text
const URL_REGEX = /https?:\/\/[^\s]+/g;

function LinkedText({ text, style, colors }) {
  if (!text) return null;
  const parts = [];
  let last = 0, match;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index), key: 't' + last });
    parts.push({ type: 'url', value: match[0], key: 'u' + match.index });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last), key: 't' + last });
  if (parts.length === 0) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {parts.map((p) =>
        p.type === 'url' ? (
          <Text key={p.key} style={{ color: colors.primary, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(p.value).catch(() => {})} accessibilityRole="link">
            {p.value}
          </Text>
        ) : <Text key={p.key}>{p.value}</Text>
      )}
    </Text>
  );
}

export default function ContentDetailScreen({ route, navigation }) {
  const { item, openComments } = route.params;
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, isRTL, dirStyle } = useLang();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [detail, setDetail]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [comments, setComments]       = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending]         = useState(false);
  const [liked, setLiked]             = useState(false);
  const [likeCount, setLikeCount]     = useState(item?.likes?.total || 0);
  const [likeBusy, setLikeBusy]       = useState(false);
  const [downloading, setDownloading] = useState(null);

  const data   = detail || item;
  const meta   = typeMeta(data?.type);
  const accent = colors[meta.tone] || colors.primary;
  const extra  = { ...(item?.extra || {}), ...(detail?.extra || {}) };

  useEffect(() => {
    let alive = true;
    getContent(item.id)
      .then((d) => { if (alive) { setDetail(d); setLikeCount(d?.likes?.total ?? item?.likes?.total ?? 0); } })
      .catch((e) => { if (alive) setError(messageFor(e, t('Détail indisponible.', 'التفاصيل غير متاحة.'))); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item.id, t]);

  const loadComments = useCallback(async () => {
    try { const res = await getComments(item.id); setComments(res?.results || []); } catch (_) {}
  }, [item.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    if (!item.objectModel || !item.objectId) return;
    let alive = true;
    getLikeStatus(item.objectModel, item.objectId)
      .then((s) => { if (!alive) return; setLiked(!!s.currentUserLiked); if (typeof s.counter === 'number') setLikeCount(s.counter); })
      .catch(() => {});
    return () => { alive = false; };
  }, [item.objectModel, item.objectId]);

  const toggleLike = async () => {
    if (likeBusy || !item.objectModel) return;
    setLikeBusy(true);
    const before = { liked, likeCount };
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      if (before.liked) await unlike(item.objectModel, item.objectId);
      else await like(item.objectModel, item.objectId);
    } catch (e) {
      setLiked(before.liked); setLikeCount(before.likeCount);
      setError(messageFor(e, t("Impossible d'enregistrer votre réaction.", 'تعذر تسجيل تفاعلك.')));
    } finally { setLikeBusy(false); }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await addComment(item.objectModel, item.objectId, text);
      setCommentText('');
      await loadComments();
    } catch (e) {
      setError(messageFor(e, t("Le commentaire n'a pas pu être publié.", 'تعذر نشر التعليق.')));
    } finally { setSending(false); }
  };

  const removeComment = async (id) => {
    try { await deleteComment(id); await loadComments(); }
    catch (e) { setError(messageFor(e, t('Suppression impossible.', 'تعذر الحذف.'))); }
  };

  const download = async (file) => {
    if (downloading) return;
    setDownloading(file.id);
    const res = await downloadAuthenticatedFile({ id: file.id, api_download_url: file.api_download_url, title: file.file_name || file.title, mime_type: file.mime_type }, null);
    setDownloading(null);
    if (!res.ok) setError(res.reason);
  };

  const openFile = async (file) => {
    if (downloading) return;
    setDownloading('open-' + file.id);
    const res = await openFileInApp({ id: file.id, api_download_url: file.api_download_url, title: file.file_name || file.title, mime_type: file.mime_type });
    setDownloading(null);
    if (!res.ok) { setError(res.reason); return; }
    navigation.navigate('WebView', { url: res.url, headers: res.headers, title: file.file_name || file.title || 'Fichier' });
  };

  const openSelf = async () => {
    if (!extra.downloadPath) return;
    setDownloading('opening');
    const res = await openFileInApp({ api_download_url: extra.downloadPath, title: data.title, mime_type: extra.mimeType });
    setDownloading(null);
    if (!res.ok) { setError(res.reason); return; }
    navigation.navigate('WebView', { url: res.url, headers: res.headers, title: data.title || 'Fichier' });
  };

  const downloadSelf = async () => {
    if (!extra.downloadPath) return;
    setDownloading('self');
    const res = await downloadAuthenticatedFile({ api_download_url: extra.downloadPath, title: data.title, mime_type: extra.mimeType }, null);
    setDownloading(null);
    if (!res.ok) setError(res.reason);
  };

  // Link handler: tappable <a> in HTML
  const handleHtmlLink = useCallback((_evt, href) => {
    if (!href) return;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      Linking.canOpenURL(href)
        .then((ok) => ok ? Linking.openURL(href) : navigation.navigate('WebView', { url: href, title: '' }))
        .catch(() => navigation.navigate('WebView', { url: href, title: '' }));
    } else if (href.startsWith('mailto:') || href.startsWith('tel:')) {
      Linking.openURL(href).catch(() => {});
    } else {
      navigation.navigate('WebView', { url: href, title: '' });
    }
  }, [navigation]);

  const html = useMemo(() => bodyToHtml(detail?.body, detail?.bodyFormat), [detail?.body, detail?.bodyFormat]);
  const contentWidth = Math.min(width, layout.readingWidth) - layout.gutter * 2;

  const htmlConfig = useMemo(() => ({
    baseStyle: {
      color: colors.textSecondary,
      fontSize: 14 * layout.fontScale,
      lineHeight: 22 * layout.fontScale,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    tagsStyles: {
      a:          { color: colors.primary, textDecorationLine: 'underline' },
      h2:         { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 6 },
      h3:         { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 5 },
      h4:         { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 4 },
      p:          { marginTop: 0, marginBottom: 10 },
      li:         { marginBottom: 4 },
      strong:     { color: colors.textPrimary },
      b:          { color: colors.textPrimary },
      blockquote: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 10, marginLeft: 0, fontStyle: 'italic' },
      pre:        { backgroundColor: colors.bgSubtle, padding: 10, borderRadius: radius.sm, fontSize: 12 },
      code:       { backgroundColor: colors.bgSubtle, fontSize: 12 },
      img:        { marginVertical: 8, maxWidth: contentWidth, width: contentWidth, height: 'auto' },
      hr:         { backgroundColor: colors.borderLight, height: 1, marginVertical: 12 },
    },
    renderersProps: { a: { onPress: handleHtmlLink } },
  }), [colors, radius, isRTL, layout.fontScale, contentWidth, handleHtmlLink]);

  const files = data?.files || [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <AppBar
          title={typeLabel(data?.type, lang)}
          onBack={() => navigation.goBack()}
          actions={(data?.externalUrl || data?.url) ? [{
            icon: 'open-outline',
            label: t('Ouvrir sur le site', 'فتح في الموقع'),
            onPress: () => navigation.navigate('WebView', { url: data.externalUrl || data.url, title: data.title }),
          }] : []}
        />

        {error ? (
          <View style={{ paddingHorizontal: layout.gutter, paddingTop: spacing.sm }}>
            <Banner message={error} onDismiss={() => setError(null)} />
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.sm }} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={{ paddingHorizontal: layout.gutter, paddingTop: spacing.md, gap: 6 }}>
            <Badge label={typeLabel(data?.type, lang)} color={accent} icon={meta.icon} />
            <Text style={[T.h1, { fontSize: 20 }, dirStyle]}>{data?.title || typeLabel(data?.type, lang)}</Text>
            <View style={styles.authorRow}>
              <Avatar name={data?.author?.name} size={26} />
              <Text style={T.caption} numberOfLines={1}>
                {[data?.author?.name, formatDateTime(data?.createdAt, lang)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          {/* Calendar card */}
          {data?.type === 'calendar' ? (
            <View style={{ paddingHorizontal: layout.gutter }}>
              <Card>
                <InfoRow icon="time-outline"     label={t('Début', 'البداية')} value={formatDateTime(extra.startDatetime, lang)} colors={colors} T={T} />
                <InfoRow icon="time-outline"     label={t('Fin', 'النهاية')}   value={formatDateTime(extra.endDatetime, lang)}   colors={colors} T={T} />
                <InfoRow icon="location-outline" label={t('Lieu', 'المكان')}   value={extra.location}                           colors={colors} T={T} />
                {extra.allDay ? <InfoRow icon="sunny-outline" label={t('Durée', 'المدة')} value={t('Journée entière', 'يوم كامل')} colors={colors} T={T} /> : null}
              </Card>
            </View>
          ) : null}

          {/* File buttons */}
          {data?.type === 'drive_file' || data?.type === 'cfile' ? (
            <View style={{ paddingHorizontal: layout.gutter, gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title={t('Ouvrir', 'فتح')} icon="eye-outline" variant="secondary" loading={downloading === 'opening'} onPress={openSelf} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={t('Télécharger', 'تحميل') + (extra.humanSize ? ' (' + extra.humanSize + ')' : '')} icon="cloud-download-outline" loading={downloading === 'self'} onPress={downloadSelf} />
                </View>
              </View>
              {(extra.filename || extra.humanSize) ? (
                <Text style={[T.caption, { textAlign: 'center' }]}>{[extra.filename, extra.humanSize].filter(Boolean).join(' · ')}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Body */}
          <View style={{ paddingHorizontal: layout.gutter }}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : html ? (
              <RenderHtml
                contentWidth={contentWidth}
                source={{ html }}
                baseStyle={htmlConfig.baseStyle}
                tagsStyles={htmlConfig.tagsStyles}
                renderersProps={htmlConfig.renderersProps}
                defaultTextProps={{ selectable: true }}
                enableExperimentalMarginCollapsing
                imagesMaxWidth={contentWidth}
              />
            ) : data?.excerpt ? (
              <LinkedText text={data.excerpt} style={[T.body, dirStyle]} colors={colors} />
            ) : (
              <Text style={[T.caption, { fontStyle: 'italic' }]}>
                {t("Ce contenu n'a pas de texte.", 'لا يحتوي هذا المحتوى على نص.')}
              </Text>
            )}
          </View>

          {/* Attachments */}
          {files.length > 0 && data?.type !== 'cfile' && data?.type !== 'drive_file' ? (
            <View style={{ paddingHorizontal: layout.gutter, gap: 6 }}>
              <Text style={T.label}>{t('Pièces jointes', 'المرفقات')} ({files.length})</Text>
              <Card padded={false}>
                {files.map((f, i) => (
                  <View key={String(f.id)} style={[styles.fileRow, { paddingHorizontal: spacing.md, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.borderLight }]}>
                    <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
                    <Text style={[T.bodyStrong, { flex: 1, fontSize: 13 }, dirStyle]} numberOfLines={2}>{f.file_name || f.title}</Text>
                    <TouchableOpacity onPress={() => openFile(f)} disabled={!!downloading} hitSlop={10} style={{ padding: 4 }}>
                      {downloading === 'open-' + f.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="eye-outline" size={17} color={colors.textMuted} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => download(f)} disabled={!!downloading} hitSlop={10} style={{ padding: 4 }}>
                      {downloading === f.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="cloud-download-outline" size={17} color={colors.textMuted} />}
                    </TouchableOpacity>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {/* Topics */}
          {(data?.topics || []).length > 0 ? (
            <View style={[styles.topicRow, { paddingHorizontal: layout.gutter }]}>
              {data.topics.map((tp) => <Badge key={String(tp.id || tp.name)} label={tp.name || String(tp)} color={colors.textSecondary} />)}
            </View>
          ) : null}

          {/* Social bar */}
          <View style={[styles.socialBar, { backgroundColor: colors.bgCard, borderColor: colors.borderLight, paddingHorizontal: layout.gutter }]}>
            <TouchableOpacity style={styles.socialBtn} onPress={toggleLike} disabled={likeBusy} hitSlop={6}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#E53935' : colors.textMuted} />
              <Text style={[T.caption, liked && { color: '#E53935', fontWeight: '700' }]}>{likeCount}</Text>
            </TouchableOpacity>
            <View style={styles.socialBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
              <Text style={T.caption}>{comments.length}</Text>
            </View>
          </View>

          {/* Comments */}
          <View style={{ paddingHorizontal: layout.gutter, gap: 6 }}>
            <Text style={T.label}>{t('Commentaires', 'التعليقات')}</Text>
            {comments.length === 0 ? (
              <Text style={[T.caption, { fontStyle: 'italic' }]}>{t('Aucun commentaire', 'لا توجد تعليقات')}</Text>
            ) : comments.map((c) => {
              const author = c.createdBy || c.created_by || {};
              return (
                <View key={String(c.id)} style={[styles.comment, { borderTopColor: colors.borderLight }]}>
                  <Avatar name={author.display_name} size={30} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.commentHead}>
                      <Text style={[T.bodyStrong, { fontSize: 12.5 }]} numberOfLines={1}>{author.display_name || ''}</Text>
                      <Text style={[T.caption, { flex: 1 }]}>{timeAgo(c.created_at || c.createdAt, lang)}</Text>
                      {author.id === user?.id ? (
                        <TouchableOpacity onPress={() => removeComment(c.id)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={[T.body, { fontSize: 13 }, dirStyle]}>{c.message}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Comment composer */}
        <View style={[styles.composer, { backgroundColor: colors.bgCard, borderTopColor: colors.borderLight, paddingHorizontal: layout.gutter }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bgInput, borderRadius: radius.md, color: colors.textPrimary, borderColor: colors.border }, dirStyle]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('Écrire un commentaire…', 'اكتب تعليقاً…')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: (!commentText.trim() || sending) ? colors.border : colors.primary }]}
            onPress={submitComment}
            disabled={!commentText.trim() || sending}
            accessibilityLabel={t('Publier', 'نشر')}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
          </TouchableOpacity>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ icon, label, value, colors, T }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={[T.caption, { width: 62 }]}>{label}</Text>
      <Text style={[T.bodyStrong, { flex: 1, fontSize: 13 }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  topicRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fileRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  socialBar:   { flexDirection: 'row', gap: 22, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  socialBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  comment:     { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  composer:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input:       { flex: 1, maxHeight: 110, minHeight: 42, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, borderWidth: StyleSheet.hairlineWidth },
  sendBtn:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});