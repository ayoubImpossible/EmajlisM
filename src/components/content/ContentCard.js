

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';
import { formatDate, formatDateTime, timeAgo } from '../../utils/dates';
import AuthedImage from '../common/AuthedImage';
import Badge from '../ui/Badge';
import { getLikeStatus, like as apiLike, unlike as apiUnlike } from '../../api/social';

// ─── Type metadata ────────────────────────────────────────────────────────────
const TYPE_META = {
  post:         { icon: 'chatbubble-ellipses-outline', tone: 'primary',     fr: 'Publication',  ar: 'منشور'   },
  calendar:     { icon: 'calendar-outline',            tone: 'olive',        fr: 'Événement',    ar: 'حدث'     },
  drive_file:   { icon: 'document-text-outline',       tone: 'info',         fr: 'Document',     ar: 'وثيقة'   },
  drive_folder: { icon: 'folder-outline',              tone: 'warning',      fr: 'Dossier',      ar: 'مجلد'    },
  cfile:        { icon: 'document-attach-outline',     tone: 'teal',         fr: 'Fichier',      ar: 'ملف'     },
  cfolder:      { icon: 'folder-open-outline',         tone: 'warning',      fr: 'Dossier',      ar: 'مجلد'    },
  page:         { icon: 'reader-outline',              tone: 'tagPleniere',  fr: 'Page',         ar: 'صفحة'    },
  article:      { icon: 'newspaper-outline',           tone: 'tagRevue',     fr: 'Article',      ar: 'مقال'    },
  task:         { icon: 'checkbox-outline',            tone: 'success',      fr: 'Tâche',        ar: 'مهمة'    },
  poll:         { icon: 'stats-chart-outline',         tone: 'primaryLight', fr: 'Sondage',      ar: 'استطلاع' },
  wiki:         { icon: 'book-outline',                tone: 'teal',         fr: 'Wiki',         ar: 'ويكي'    },
};
const GENERIC = { icon: 'ellipse-outline', tone: 'textMuted', fr: 'Contenu', ar: 'محتوى' };

export function typeLabel(type, lang = 'fr') {
  const meta = TYPE_META[type];
  if (meta) return lang === 'ar' ? meta.ar : meta.fr;
  return String(type || '').replace(/_/g, ' ') || (lang === 'ar' ? GENERIC.ar : GENERIC.fr);
}
export function typeMeta(type) { return TYPE_META[type] || GENERIC; }
export function useTypeColor(type) {
  const { colors } = useTheme();
  return colors[typeMeta(type).tone] || colors.textMuted;
}

// ─── Like state hook ──────────────────────────────────────────────────────────
/**
 * Manages liked state + count for a single feed item.
 *
 * - Loads currentUserLiked from GET /api/likes/status on mount (lazy, one call per card)
 * - Optimistic update: flips state + count instantly, then confirms with the server
 * - Reverts if the server call fails
 * - model + pk come from item.objectModel / item.objectId (already in every feed item)
 */
function useLikeState(item) {
  const model = item?.objectModel || null;
  const pk    = item?.objectId    ?? null;

  const [liked,    setLiked]    = useState(null);   // null = not yet loaded
  const [count,    setCount]    = useState(item?.likes?.total ?? 0);
  const [loading,  setLoading]  = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Load like status once on mount (only if we have model+pk)
  useEffect(() => {
    if (!model || pk == null) return;
    let alive = true;
    getLikeStatus(model, pk)
      .then((data) => {
        if (!alive || !mounted.current) return;
        setLiked(!!data?.currentUserLiked);
        // Server count is more accurate than feed snapshot — prefer it
        if (data?.counter != null) setCount(data.counter);
      })
      .catch(() => {
        // If status call fails, fall back to feed count, liked = false
        if (alive && mounted.current) setLiked(false);
      });
    return () => { alive = false; };
  }, [model, pk]);

  const toggle = useCallback(async () => {
    if (!model || pk == null || loading) return;
    if (liked === null) return; // not loaded yet

    // Optimistic
    const wasLiked = liked;
    const wasCount = count;
    setLiked(!wasLiked);
    setCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);
    setLoading(true);

    try {
      if (wasLiked) {
        await apiUnlike(model, pk);
      } else {
        await apiLike(model, pk);
      }
    } catch {
      // Revert on failure
      if (mounted.current) {
        setLiked(wasLiked);
        setCount(wasCount);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [model, pk, liked, count, loading]);

  return { liked, count, loading, toggle };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ContentCard({ item, onPress, onCommentPress, lang = 'fr', isRTL = false, accentColor }) {
  const { colors, spacing, radius, shadow, isDark, layout, type: T } = useTheme();
  const s = useMemo(
    () => makeStyles({ colors, spacing, radius, isDark }),
    [colors, spacing, radius, isDark],
  );

  // Like state — wired to real API
  const likeState = useLikeState(item);

  if (!item) return null;

  const meta      = typeMeta(item.type);
  const color     = accentColor || colors[meta.tone] || colors.textMuted;
  const showImage = !!item.imageUrl && (item.type === 'post' || item.type === 'article');
  const isFile    = item.type === 'drive_file' || item.type === 'cfile';
  const isCal     = item.type === 'calendar';

  const comments    = item.comments?.total ?? 0;
  const dir         = isRTL ? { textAlign: 'right', writingDirection: 'rtl' } : null;

  // ── Article / Post WITH cover image ──────────────────────────────────────
  if (showImage) {
    return (
      <TouchableOpacity
        style={[s.card, shadow.sm]}
        onPress={() => onPress?.(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel(item.type, lang)} : ${item.title || ''}`}
      >
        {/* Cover */}
        <View style={[s.cover, { height: layout.isTablet ? 200 : 160 }]}>
          <AuthedImage uri={item.imageUrl} style={StyleSheet.absoluteFill} resizeMode="cover" />

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 0, y: 1 }}
          />

          {/* ● Rapport Récent tag — top-left */}
          {(item.tag || item.pinned) ? (
            <View style={s.rapportTag}>
              <View style={[s.rapportDot, { backgroundColor: color }]} />
              <Text style={s.rapportText}>
                {item.tag || (lang === 'ar' ? 'مثبّت' : 'Épinglé')}
              </Text>
            </View>
          ) : null}

          {/* Category + title at bottom */}
          <View style={s.coverOverlay}>
            {item.category ? (
              <Text style={s.coverCategory} numberOfLines={1}>{item.category}</Text>
            ) : null}
            <Text style={[s.coverTitle, dir]} numberOfLines={2}>{item.title || ''}</Text>
          </View>
        </View>

        {/* Image-card footer */}
        <View style={[s.imgFooter, { borderTopColor: colors.borderLight }]}>
          <View style={{ flex: 1 }}>
            <Text style={[T.caption, { color: colors.textSecondary }]} numberOfLines={1}>
              {[item.author?.name, item.extra?.humanSize ? `PDF (${item.extra.humanSize})` : null]
                .filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          <LikeButton likeState={likeState} colors={colors} />
          <CommentButton count={comments} colors={colors} onPress={() => onCommentPress?.(item)} />
          <TouchableOpacity style={[s.consultBtn, { backgroundColor: colors.primarySoft }]}
            onPress={() => onPress?.(item)}>
            <Text style={[s.consultText, { color: colors.primary }]}>
              {lang === 'ar' ? 'اطلع' : 'Consulter'}
            </Text>
            <Ionicons name="chevron-forward" size={11} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Standard card WITHOUT image ───────────────────────────────────────────
  const excerpt = item.excerpt || '';

  return (
    <TouchableOpacity
      style={[s.card, shadow.sm]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel(item.type, lang)} : ${item.title || ''}`}
    >
      <View style={s.body}>

        {/* ① Top row: [Badge]  …spacer…  time-ago */}
        <View style={s.topRow}>
          <Badge label={typeLabel(item.type, lang)} color={color} icon={meta.icon} />
          {item.pinned ? (
            <Ionicons name="pin" size={13} color={colors.textMuted} />
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={[T.caption, { color: colors.textMuted }]}>
            {timeAgo(item.createdAt, lang)}
          </Text>
        </View>

        {/* ② Title */}
        <Text style={[T.bodyStrong, s.title, dir]} numberOfLines={3}>
          {item.title || typeLabel(item.type, lang)}
        </Text>

        {/* ③ Type-specific content block */}
        {isFile ? (
          <FileBlock item={item} color={color} colors={colors} lang={lang} T={T} s={s} />
        ) : isCal ? (
          <CalBlock item={item} color={color} colors={colors} lang={lang} />
        ) : excerpt ? (
          <Text style={[s.excerpt, { color: colors.textSecondary }, dir]} numberOfLines={2}>
            {excerpt}
          </Text>
        ) : null}

      </View>

      {/* ④ Divider */}
      <View style={[s.divider, { backgroundColor: colors.borderLight }]} />

      {/* ⑤ Footer */}
      <View style={s.footer}>
        {/* Author: bare circle + plain name */}
        {item.author?.name ? (
          <AuthorRow name={item.author.name} color={color} colors={colors} T={T} />
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* Stats */}
        <LikeButton likeState={likeState} colors={colors} />
        <CommentButton count={comments} colors={colors} onPress={() => onCommentPress?.(item)} />

        {/* Calendar → Participer button; Document → share icon; else → ··· */}
        {isCal ? (
          <TouchableOpacity
            style={[s.participerBtn, { backgroundColor: colors.primary }]}
            onPress={() => onPress?.(item)}
          >
            <Text style={[s.participerText]}>
              {lang === 'ar' ? 'مشاركة' : 'Participer'}
            </Text>
          </TouchableOpacity>
        ) : isFile ? (
          <Ionicons name="share-outline" size={16} color={colors.textMuted} style={{ marginLeft: 10 }} />
        ) : (
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} style={{ marginLeft: 10 }} />
        )}
      </View>

      {/* Degraded notice */}
      {item.needsServerSupport ? (
        <Text style={[s.degraded, { color: colors.textMuted, borderTopColor: colors.borderLight }]}>
          {lang === 'ar'
            ? 'عرض مبسط — لا يوفر الخادم تفاصيل هذا النوع.'
            : "Aperçu limité — le serveur n'expose pas le détail de ce type."}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── File block ───────────────────────────────────────────────────────────────
// [PPTX]  filename  757 KB • Télécharger   ⋮
function FileBlock({ item, color, colors, lang, T, s }) {
  const e    = item.extra || {};
  const file = (item.files || [])[0];
  const raw  = e.filename || file?.file_name || '';
  const ext  = raw.split('.').pop().toUpperCase().slice(0, 5);
  const name = raw;
  const size = e.humanSize
    || (file?.size ? `${(file.size / 1024).toFixed(2)} KB` : '');
  const hasDownload = !!(e.downloadUrl || file?.url);

  return (
    <View style={s.fileRow}>
      {/* Extension badge */}
      {ext ? (
        <View style={[s.extBox, { backgroundColor: `${color}22` }]}>
          <Text style={[s.extText, { color }]}>{ext}</Text>
        </View>
      ) : null}

      {/* Filename + size · Télécharger */}
      <View style={{ flex: 1, marginRight: 4 }}>
        <Text style={[T.caption, { color: colors.textSecondary }]} numberOfLines={2}>
          {name}
        </Text>
        {(size || hasDownload) ? (
          <Text style={{ fontSize: 11.5, color: colors.textMuted }} numberOfLines={1}>
            {size}
            {size && hasDownload ? '  •  ' : ''}
            {hasDownload ? (
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {lang === 'ar' ? 'تحميل' : 'Télécharger'}
              </Text>
            ) : null}
          </Text>
        ) : null}
      </View>

      {/* ⋮ more */}
      <TouchableOpacity hitSlop={10}>
        <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Calendar block ───────────────────────────────────────────────────────────
// 🕐  17 septembre 2026 à 15:00
// 📍  Salle de réunion INE RDC
function CalBlock({ item, color, colors, lang }) {
  const e = item.extra || {};
  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      {e.startDatetime ? (
        <View style={calStyles.row}>
          <Ionicons name="time-outline" size={13} color={color} />
          <Text style={[calStyles.text, { color: colors.textSecondary }]} numberOfLines={1}>
            {formatDateTime(e.startDatetime, lang)}
          </Text>
        </View>
      ) : null}
      {e.location ? (
        <View style={calStyles.row}>
          <Ionicons name="location-outline" size={13} color={color} />
          <Text style={[calStyles.text, { color: colors.textSecondary }]} numberOfLines={1}>
            {e.location}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
const calStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 12.5, lineHeight: 18, flexShrink: 1 },
});

// ─── Author row ───────────────────────────────────────────────────────────────
// ● HB   Hanae BOUCHEBTI
function AuthorRow({ name, color, colors, T }) {
  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '').join('');
  return (
    <View style={authorStyles.row}>
      <View style={[authorStyles.circle, { backgroundColor: color }]}>
        <Text style={authorStyles.initials}>{initials}</Text>
      </View>
      <Text style={[T.caption, { color: colors.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}
const authorStyles = StyleSheet.create({
  row:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, marginRight: 8 },
  circle:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials: { fontSize: 9, fontWeight: '800', color: '#fff' },
});

// ─── Like button — tappable, filled when liked, animated pulse ───────────────
function LikeButton({ likeState, colors }) {
  const { liked, count, loading, toggle } = likeState;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Quick pulse animation on tap
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start();
    toggle();
  };

  const isLiked  = liked === true;
  const iconName = isLiked ? 'heart' : 'heart-outline';
  const iconColor = isLiked ? '#E53935' : colors.textMuted;
  const textColor = isLiked ? '#E53935' : colors.textMuted;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading || liked === null}
      hitSlop={8}
      style={likeStyles.btn}
      accessibilityRole="button"
      accessibilityLabel={isLiked ? "Retirer le j'aime" : "J'aime"}
      accessibilityState={{ checked: isLiked }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={iconName} size={15} color={iconColor} />
      </Animated.View>
      {count > 0 ? (
        <Text style={[likeStyles.count, { color: textColor }]}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  );
}
const likeStyles = StyleSheet.create({
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10, padding: 2 },
  count: { fontSize: 12, fontWeight: '600' },
});

// ─── Comment button — tappable, navigates to comments ────────────────────────
function CommentButton({ count, colors, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      style={commentStyles.btn}
      accessibilityRole="button"
      accessibilityLabel="Commentaires"
    >
      <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
      {count > 0 ? (
        <Text style={[commentStyles.count, { color: colors.textMuted }]}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  );
}
const commentStyles = StyleSheet.create({
  btn:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10, padding: 2 },
  count: { fontSize: 12, fontWeight: '600' },
});

// ─── Compact row (search results) ────────────────────────────────────────────
export function ContentRow({ item, onPress, lang = 'fr', isRTL = false }) {
  const { colors, spacing, radius, type: T } = useTheme();
  const meta  = typeMeta(item.type);
  const color = colors[meta.tone] || colors.textMuted;
  const dir   = isRTL ? { textAlign: 'right', writingDirection: 'rtl' } : null;
  return (
    <TouchableOpacity
      style={[rowStyles.row, {
        backgroundColor: colors.bgCard,
        paddingHorizontal: spacing.md,
        borderBottomColor: colors.borderLight,
      }]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.85}
    >
      <View style={[rowStyles.icon, { backgroundColor: `${color}22`, borderRadius: radius.sm }]}>
        <Ionicons name={meta.icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.bodyStrong, { fontSize: 13 }, dir]} numberOfLines={2}>
          {item.title || typeLabel(item.type, lang)}
        </Text>
        <Text style={T.caption} numberOfLines={1}>
          {[typeLabel(item.type, lang), item.author?.name, formatDate(item.createdAt, lang)]
            .filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={15} color={colors.border} />
    </TouchableOpacity>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const makeStyles = ({ colors, spacing, radius, isDark }) => StyleSheet.create({

  // Card shell
  card: {
    backgroundColor: isDark ? colors.bgElevated : colors.bgCard,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  // Body padding (no-image cards)
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },

  // Title
  title: {
    lineHeight: 22,
    marginBottom: 6,
  },

  // Excerpt (post / page / wiki …)
  excerpt: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },

  // File row  [EXT]  name  size • Télécharger  ⋮
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  extBox: {
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  extText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Divider between content and footer
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },

  // Footer row
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },

  // Participer button (calendar)
  participerBtn: {
    marginLeft: 10,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 16,
  },
  participerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Image-card styles ──────────────────────────────────────────────────────
  cover: {
    width: '100%',
    backgroundColor: colors.skeleton,
    overflow: 'hidden',
  },

  // "● Rapport Récent" pill — top-left over image
  rapportTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  rapportDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  rapportText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Category + title over gradient at bottom
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  coverCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
  },

  // Image-card footer
  imgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  consultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginLeft: 6,
  },
  consultText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  // Degraded notice
  degraded: {
    fontSize: 11,
    fontStyle: 'italic',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
