/**
 * Détail d'un contenu — quel que soit son type — avec le bloc social.
 *
 * Corrigé les 10-11/09/2026 :
 *   - l'écran réutilisait l'extrait du fil, tronqué à 200 caractères et vidé de
 *     son HTML : le corps d'une publication n'était jamais lisible en entier. Il
 *     est chargé par `/api/content/:id`, intact, avec `bodyFormat` ;
 *   - les pièces jointes étaient ouvertes par `Linking.openURL` vers une URL
 *     HumHub reconstruite à la main : le navigateur du téléphone n'a pas la
 *     session, le serveur répondait 401. Elles passent par le téléchargement
 *     authentifié ;
 *   - commentaires et « j'aime » n'existaient pas, alors que chaque contenu du
 *     web en a.
 *
 * L'élément du fil sert d'affichage immédiat ; le détail complet arrive ensuite.
 * L'écran n'attend jamais le réseau pour montrer quelque chose.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, useWindowDimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { getContent } from '../api/content';
import { getComments, addComment, deleteComment, getLikeStatus, like, unlike } from '../api/social';
import { messageFor } from '../api/client';
import { downloadAuthenticatedFile } from '../utils/files';
import { bodyToHtml } from '../utils/markdown';
import { formatDateTime, timeAgo } from '../utils/dates';
import { typeMeta, typeLabel } from '../components/content/ContentCard';
import AuthedImage from '../components/common/AuthedImage';
import { Screen, AppBar, Card, Button, Banner, Avatar, Badge } from '../components/ui';

export default function ContentDetailScreen({ route, navigation }) {
  const { item } = route.params;
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, isRTL, dirStyle } = useLang();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item?.likes?.total || 0);
  const [likeBusy, setLikeBusy] = useState(false);

  const [downloading, setDownloading] = useState(null);

  const data = detail || item;
  const meta = typeMeta(data?.type);
  const accent = colors[meta.tone] || colors.primary;
  const extra = data?.extra || {};

  useEffect(() => {
    let alive = true;
    getContent(item.id)
      .then((d) => { if (alive) { setDetail(d); setLikeCount(d?.likes?.total ?? item?.likes?.total ?? 0); } })
      .catch((e) => { if (alive) setError(messageFor(e, t('Détail indisponible.', 'التفاصيل غير متاحة.'))); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item.id, t]);

  const loadComments = useCallback(async () => {
    try {
      const res = await getComments(item.id);
      setComments(res?.results || []);
    } catch (_) { /* le bloc social ne doit jamais faire échouer la page */ }
  }, [item.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    if (!item.objectModel || !item.objectId) return;
    let alive = true;
    getLikeStatus(item.objectModel, item.objectId)
      .then((s) => {
        if (!alive) return;
        setLiked(!!s.currentUserLiked);
        if (typeof s.counter === 'number') setLikeCount(s.counter);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [item.objectModel, item.objectId]);

  const toggleLike = async () => {
    if (likeBusy || !item.objectModel) return;
    setLikeBusy(true);
    const before = { liked, likeCount };
    // Affichage optimiste, annulé si le serveur refuse.
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      if (before.liked) await unlike(item.objectModel, item.objectId);
      else await like(item.objectModel, item.objectId);
    } catch (e) {
      setLiked(before.liked);
      setLikeCount(before.likeCount);
      setError(messageFor(e, t("Impossible d'enregistrer votre réaction.", 'تعذر تسجيل تفاعلك.')));
    } finally {
      setLikeBusy(false);
    }
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
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (id) => {
    try { await deleteComment(id); await loadComments(); }
    catch (e) { setError(messageFor(e, t('Suppression impossible.', 'تعذر الحذف.'))); }
  };

  const download = async (file) => {
    if (downloading) return;
    setDownloading(file.id);
    const res = await downloadAuthenticatedFile({
      id: file.id,
      api_download_url: file.api_download_url,
      title: file.file_name || file.title,
      mime_type: file.mime_type,
    }, null);
    setDownloading(null);
    if (!res.ok) setError(res.reason);
  };

  const downloadSelf = async () => {
    if (!extra.downloadPath) return;
    setDownloading('self');
    const res = await downloadAuthenticatedFile({
      api_download_url: extra.downloadPath,
      title: data.title,
      mime_type: extra.mimeType,
    }, null);
    setDownloading(null);
    if (!res.ok) setError(res.reason);
  };

  const html = useMemo(() => bodyToHtml(detail?.body, detail?.bodyFormat), [detail?.body, detail?.bodyFormat]);

  const htmlConfig = useMemo(() => ({
    baseStyle: {
      color: colors.textSecondary,
      fontSize: 14 * layout.fontScale,
      lineHeight: 22 * layout.fontScale,
      textAlign: isRTL ? 'right' : 'left',
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    tagsStyles: {
      a: { color: colors.textLink, textDecorationLine: 'underline' },
      h2: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 6 },
      h3: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 5 },
      h4: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 4 },
      p: { marginTop: 0, marginBottom: 10 },
      li: { marginBottom: 4 },
      strong: { color: colors.textPrimary },
      b: { color: colors.textPrimary },
      blockquote: {
        borderLeftWidth: 3, borderLeftColor: colors.border,
        paddingLeft: 10, marginLeft: 0, fontStyle: 'italic',
      },
      pre: { backgroundColor: colors.bgSubtle, padding: 10, borderRadius: radius.sm, fontSize: 12 },
      code: { backgroundColor: colors.bgSubtle, fontSize: 12 },
      img: { marginVertical: 8, maxWidth: contentWidth, width: contentWidth, height: 'auto' },
      hr: { backgroundColor: colors.borderLight, height: 1, marginVertical: 12 },
    },
  }), [colors, radius, isRTL, layout.fontScale]);

  const files = data?.files || [];
  const contentWidth = Math.min(width, layout.readingWidth) - layout.gutter * 2;

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

        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
        >
          {data?.imageUrl ? (
            <AuthedImage
              uri={data.imageUrl}
              style={{ width: '100%', height: layout.isTablet ? 260 : 190 }}
              resizeMode="cover"
            />
          ) : null}

          <View style={{ paddingHorizontal: layout.gutter, paddingTop: spacing.md, gap: 6 }}>
            <Badge label={typeLabel(data?.type, lang)} color={accent} icon={meta.icon} />
            <Text style={[T.h1, { fontSize: 20 }, dirStyle]}>
              {data?.title || typeLabel(data?.type, lang)}
            </Text>
            <View style={styles.authorRow}>
              <Avatar name={data?.author?.name} size={26} />
              <Text style={T.caption} numberOfLines={1}>
                {[data?.author?.name, formatDateTime(data?.createdAt, lang)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          {data?.type === 'calendar' ? (
            <View style={{ paddingHorizontal: layout.gutter }}>
              <Card>
                <InfoRow icon="time-outline" label={t('Début', 'البداية')} value={formatDateTime(extra.startDatetime, lang)} colors={colors} T={T} />
                <InfoRow icon="time-outline" label={t('Fin', 'النهاية')} value={formatDateTime(extra.endDatetime, lang)} colors={colors} T={T} />
                <InfoRow icon="location-outline" label={t('Lieu', 'المكان')} value={extra.location} colors={colors} T={T} />
                {extra.allDay ? (
                  <InfoRow icon="sunny-outline" label={t('Durée', 'المدة')} value={t('Journée entière', 'يوم كامل')} colors={colors} T={T} />
                ) : null}
              </Card>
            </View>
          ) : null}

          {data?.type === 'drive_file' ? (
            <View style={{ paddingHorizontal: layout.gutter, gap: 6 }}>
              <Button
                title={`${t('Télécharger', 'تحميل')}${extra.humanSize ? ` (${extra.humanSize})` : ''}`}
                icon="cloud-download-outline"
                loading={downloading === 'self'}
                onPress={downloadSelf}
              />
              {extra.filename ? (
                <Text style={[T.caption, { textAlign: 'center' }]}>{extra.filename}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={{ paddingHorizontal: layout.gutter }}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : html ? (
              <RenderHtml
                contentWidth={contentWidth}
                source={{ html }}
                baseStyle={htmlConfig.baseStyle}
                tagsStyles={htmlConfig.tagsStyles}
                defaultTextProps={{ selectable: true }}
                enableExperimentalMarginCollapsing
                imagesMaxWidth={contentWidth}
              />
            ) : data?.excerpt ? (
              <Text style={[T.body, dirStyle]}>{data.excerpt}</Text>
            ) : (
              <Text style={[T.caption, { fontStyle: 'italic' }]}>
                {t("Ce contenu n'a pas de texte.", 'لا يحتوي هذا المحتوى على نص.')}
              </Text>
            )}
          </View>

          {files.length ? (
            <View style={{ paddingHorizontal: layout.gutter, gap: 6 }}>
              <Text style={T.label}>{t('Pièces jointes', 'المرفقات')} ({files.length})</Text>
              <Card padded={false}>
                {files.map((f, i) => (
                  <TouchableOpacity
                    key={String(f.id)}
                    style={[
                      styles.fileRow,
                      {
                        paddingHorizontal: spacing.md,
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: colors.borderLight,
                      },
                    ]}
                    onPress={() => download(f)}
                    disabled={!!downloading}
                  >
                    <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
                    <Text style={[T.bodyStrong, { flex: 1, fontSize: 13 }, dirStyle]} numberOfLines={2}>
                      {f.file_name || f.title}
                    </Text>
                    {downloading === f.id
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name="cloud-download-outline" size={17} color={colors.textMuted} />}
                  </TouchableOpacity>
                ))}
              </Card>
            </View>
          ) : null}

          {(data?.topics || []).length ? (
            <View style={[styles.topicRow, { paddingHorizontal: layout.gutter }]}>
              {data.topics.map((tp) => (
                <Badge key={String(tp.id || tp.name)} label={tp.name || String(tp)} color={colors.textSecondary} />
              ))}
            </View>
          ) : null}

          {/* Bloc social */}
          <View style={[styles.socialBar, {
            backgroundColor: colors.bgCard,
            borderColor: colors.borderLight,
            paddingHorizontal: layout.gutter,
          }]}>
            <TouchableOpacity style={styles.socialBtn} onPress={toggleLike} disabled={likeBusy} hitSlop={6}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.danger : colors.textMuted} />
              <Text style={[T.caption, liked && { color: colors.danger, fontWeight: '700' }]}>{likeCount}</Text>
            </TouchableOpacity>
            <View style={styles.socialBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
              <Text style={T.caption}>{comments.length}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: layout.gutter, gap: 6 }}>
            <Text style={T.label}>{t('Commentaires', 'التعليقات')}</Text>
            {comments.length === 0 ? (
              <Text style={[T.caption, { fontStyle: 'italic' }]}>
                {t('Aucun commentaire', 'لا توجد تعليقات')}
              </Text>
            ) : comments.map((c) => {
              const author = c.createdBy || c.created_by || {};
              return (
                <View key={String(c.id)} style={[styles.comment, { borderTopColor: colors.borderLight }]}>
                  <Avatar name={author.display_name} size={30} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.commentHead}>
                      <Text style={[T.bodyStrong, { fontSize: 12.5 }]} numberOfLines={1}>
                        {author.display_name || ''}
                      </Text>
                      <Text style={[T.caption, { flex: 1 }]}>
                        {timeAgo(c.created_at || c.createdAt, lang)}
                      </Text>
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

        <View style={[styles.composer, {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.borderLight,
          paddingHorizontal: layout.gutter,
        }]}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.bgInput, borderRadius: radius.md, color: colors.textPrimary, borderColor: colors.border },
              dirStyle,
            ]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('Écrire un commentaire…', 'اكتب تعليقاً…')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: (!commentText.trim() || sending) ? colors.border : colors.primary },
            ]}
            onPress={submitComment}
            disabled={!commentText.trim() || sending}
            accessibilityLabel={t('Publier', 'نشر')}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={17} color="#fff" />}
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
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  socialBar: {
    flexDirection: 'row', gap: 22, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, maxHeight: 110, minHeight: 42,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
