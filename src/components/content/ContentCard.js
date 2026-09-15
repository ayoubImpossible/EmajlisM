/**
 * Carte de contenu — un rendu par type, et un repli générique.
 *
 * Le fil mélange des types très différents : publication, événement, fichier du
 * Drive, dossier, fichier cfiles, page, article. L'ancien code lisait
 * `item.post || item.calendarEntry || item.driveFile` — trois champs absents de
 * la réponse — puis retombait sur `meta.url`, affichant un chemin d'URL en guise
 * de titre.
 *
 * Ici le type est lu dans `item.type`, renvoyé par le serveur. **Un type non
 * prévu n'est jamais masqué** : il tombe sur la carte générique, qui montre
 * titre, auteur et date. Un contenu mal présenté vaut mieux qu'un contenu
 * invisible.
 *
 * Mise à jour du 11/09/2026 : couleurs du thème (clair et sombre), accents
 * dérivés des jetons plutôt qu'écrits en dur, et image de couverture à ratio
 * fixe pour que la hauteur des cartes ne saute plus d'un écran à l'autre.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../config/theme';
import { formatDate, formatDateTime, timeAgo } from '../../utils/dates';
import AuthedImage from '../common/AuthedImage';
import Badge from '../ui/Badge';

/**
 * Apparence par type. `tone` désigne un jeton du thème, pas une couleur figée :
 * la même carte reste lisible en clair comme en sombre.
 */
const TYPE_META = {
  post: { icon: 'chatbubble-ellipses-outline', tone: 'primary', fr: 'Publication', ar: 'منشور' },
  calendar: { icon: 'calendar-outline', tone: 'olive', fr: 'Événement', ar: 'حدث' },
  drive_file: { icon: 'document-text-outline', tone: 'info', fr: 'Document', ar: 'وثيقة' },
  drive_folder: { icon: 'folder-outline', tone: 'warning', fr: 'Dossier', ar: 'مجلد' },
  cfile: { icon: 'document-attach-outline', tone: 'teal', fr: 'Fichier', ar: 'ملف' },
  cfolder: { icon: 'folder-open-outline', tone: 'warning', fr: 'Dossier', ar: 'مجلد' },
  page: { icon: 'reader-outline', tone: 'tagPleniere', fr: 'Page', ar: 'صفحة' },
  article: { icon: 'newspaper-outline', tone: 'tagRevue', fr: 'Article', ar: 'مقال' },
  task: { icon: 'checkbox-outline', tone: 'success', fr: 'Tâche', ar: 'مهمة' },
  poll: { icon: 'stats-chart-outline', tone: 'primaryLight', fr: 'Sondage', ar: 'استطلاع' },
  wiki: { icon: 'book-outline', tone: 'teal', fr: 'Wiki', ar: 'ويكي' },
};

const GENERIC = { icon: 'ellipse-outline', tone: 'textMuted', fr: 'Contenu', ar: 'محتوى' };

/** Libellé du type dans la langue courante. Jamais l'identifiant technique brut. */
export function typeLabel(type, lang = 'fr') {
  const meta = TYPE_META[type];
  if (meta) return lang === 'ar' ? meta.ar : meta.fr;
  return String(type || '').replace(/_/g, ' ') || (lang === 'ar' ? GENERIC.ar : GENERIC.fr);
}

export function typeMeta(type) {
  return TYPE_META[type] || GENERIC;
}

/** Couleur d'un type, résolue dans le thème courant. */
export function useTypeColor(type) {
  const { colors } = useTheme();
  const meta = typeMeta(type);
  return colors[meta.tone] || colors.textMuted;
}

/** Détail propre au type, affiché sous le titre. Chaîne vide si rien à dire. */
function subtitleFor(item, lang) {
  const e = item.extra || {};
  switch (item.type) {
    case 'calendar': {
      const when = formatDateTime(e.startDatetime, lang);
      return [when, e.location].filter(Boolean).join(' · ');
    }
    case 'drive_file':
      return [e.humanSize, e.filename].filter(Boolean).join(' · ');
    case 'cfile': {
      const f = (item.files || [])[0];
      return f ? f.file_name : '';
    }
    case 'drive_folder':
    case 'cfolder':
      return lang === 'ar' ? 'فتح المجلد' : 'Ouvrir le dossier';
    default:
      return item.excerpt || '';
  }
}

export default function ContentCard({ item, onPress, lang = 'fr', isRTL = false, accentColor }) {
  const { colors, spacing, radius, shadow, isDark, layout, type: T } = useTheme();
  const styles = useMemo(() => makeStyles({ colors, spacing, radius, isDark }), [colors, spacing, radius, isDark]);

  if (!item) return null;

  const meta = typeMeta(item.type);
  const color = accentColor || colors[meta.tone] || colors.textMuted;
  const subtitle = subtitleFor(item, lang);
  const showImage = !!item.imageUrl && (item.type === 'post' || item.type === 'article');

  const comments = item.comments?.total || 0;
  const likes = item.likes?.total || 0;
  const attachments = (item.files || []).length;

  const dir = isRTL ? { textAlign: 'right', writingDirection: 'rtl' } : null;

  return (
    <TouchableOpacity
      style={[styles.card, shadow.sm]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel(item.type, lang)} : ${item.title || ''}`}
    >
      {showImage ? (
        <AuthedImage
          uri={item.imageUrl}
          // Ratio fixe : sans lui, la hauteur des cartes dépendait de l'image et
          // la liste sautait pendant le défilement.
          style={[styles.cover, { height: layout.isTablet ? 200 : 160 }]}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Badge label={typeLabel(item.type, lang)} color={color} icon={meta.icon} />
          {item.pinned ? <Ionicons name="pin" size={13} color={colors.textMuted} /> : null}
          <View style={{ flex: 1 }} />
          <Text style={T.caption}>{timeAgo(item.createdAt, lang)}</Text>
        </View>

        <Text style={[T.bodyStrong, styles.title, dir]} numberOfLines={3}>
          {item.title || typeLabel(item.type, lang)}
        </Text>

        {subtitle ? (
          <Text style={[T.body, styles.subtitle, dir]} numberOfLines={2}>{subtitle}</Text>
        ) : null}

        <View style={styles.footer}>
          <Text style={[T.caption, { maxWidth: '55%' }]} numberOfLines={1}>
            {item.author?.name || ''}
          </Text>
          <View style={{ flex: 1 }} />
          <Stat icon="chatbubble-outline" value={comments} colors={colors} />
          <Stat icon="heart-outline" value={likes} colors={colors} />
          <Stat icon="attach-outline" value={attachments} colors={colors} />
        </View>

        {item.needsServerSupport ? (
          <Text style={[T.caption, styles.degraded]}>
            {lang === 'ar'
              ? 'عرض مبسط — لا يوفر الخادم تفاصيل هذا النوع.'
              : "Aperçu limité — le serveur n'expose pas le détail de ce type."}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function Stat({ icon, value, colors }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 10 }}>
      <Ionicons name={icon} size={12} color={colors.textMuted} />
      <Text style={{ fontSize: 11, color: colors.textMuted }}>{value}</Text>
    </View>
  );
}

/** Ligne compacte, pour les listes denses (résultats de recherche). */
export function ContentRow({ item, onPress, lang = 'fr', isRTL = false }) {
  const { colors, spacing, radius, type: T } = useTheme();
  const meta = typeMeta(item.type);
  const color = colors[meta.tone] || colors.textMuted;
  const dir = isRTL ? { textAlign: 'right', writingDirection: 'rtl' } : null;

  return (
    <TouchableOpacity
      style={[
        rowStyles.row,
        {
          backgroundColor: colors.bgCard,
          paddingHorizontal: spacing.md,
          borderBottomColor: colors.borderLight,
        },
      ]}
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

const makeStyles = ({ colors, spacing, radius, isDark }) => StyleSheet.create({
  card: {
    backgroundColor: isDark ? colors.bgElevated : colors.bgCard,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cover: { width: '100%', backgroundColor: colors.skeleton },
  body: { padding: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { lineHeight: 20 },
  subtitle: { marginTop: 4, fontSize: 12.5, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  degraded: { fontStyle: 'italic', marginTop: 6 },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
