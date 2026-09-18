import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  RefreshControl, StyleSheet, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getSpaces } from '../api/spaces';
import { messageFor } from '../api/client';
import AuthedImage from '../components/common/AuthedImage';
import { Screen, AppBar, Banner, EmptyState, SkeletonList } from '../components/ui';

// â”€â”€â”€ Local asset maps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BACKGROUNDS = {
  8:  require('../../assets/Emajlis BackgroundV2/8.jpeg'),
  9:  require('../../assets/Emajlis BackgroundV2/9.jpeg'),
  10: require('../../assets/Emajlis BackgroundV2/10.jpeg'),
  11: require('../../assets/Emajlis BackgroundV2/11.jpeg'),
  12: require('../../assets/Emajlis BackgroundV2/12.jpeg'),
  13: require('../../assets/Emajlis BackgroundV2/13.jpeg'),
  14: require('../../assets/Emajlis BackgroundV2/14.png'),
  15: require('../../assets/Emajlis BackgroundV2/15.png'),
  16: require('../../assets/Emajlis BackgroundV2/16.png'),
};

const ICONS = {
  8:  require('../../assets/Emajlis icons V2/8.jpg'),
  9:  require('../../assets/Emajlis icons V2/9.jpg'),
  10: require('../../assets/Emajlis icons V2/10.jpg'),
  11: require('../../assets/Emajlis icons V2/11.jpg'),
  12: require('../../assets/Emajlis icons V2/12.jpg'),
  13: require('../../assets/Emajlis icons V2/13.jpg'),
  14: require('../../assets/Emajlis icons V2/14.jpg'),
  15: require('../../assets/Emajlis icons V2/15.jpg'),
  16: require('../../assets/Emajlis icons V2/16.jpg'),
};

// Space name â†’ { bg: number, icon: number }
// bg numbers map to Emajlis BackgroundV2/:
//   8  = silhouettes at bright window (bureau/council)
//   9  = illustrated round-table meeting (warm tones) â€” commissions CP*
//  10  = red sketch two people at laptop â€” GSTFC
//  11  = blurry audience from behind â€” not used currently
//  12  = orange blurry media/screens â€” ressources documentaires
//  13  = folded newspaper â€” revues de presse
//  14  = blue floating documents/data â€” info doc / veille
//  15  = plain light grey/white â€” le journal
// Matching is done on normalised uppercase name (ignores accents/spaces variations)
const SPACE_ASSETS = {
  'BUREAU DU CONSEIL':       { bg: 8,  icon: 9  },
  'CPCPFD':                  { bg: 9,  icon: 8  },
  'CPEFTA':                  { bg: 9,  icon: 8  },
  'CPGSEF':                  { bg: 9,  icon: 8  },
  'CPMEFG':                  { bg: 9,  icon: 8  },
  'CPRSTI':                  { bg: 9,  icon: 8  },
  'CPSSC':                   { bg: 9,  icon: 8  },
  'GSTFC':                   { bg: 10, icon: 10 },
  'L INFO DOC':              { bg: 14, icon: 12 },
  'LE JOURNAL':              { bg: 15, icon: 15 },
  'RESSOURCES DOCUMENTAIRES':{ bg: 12, icon: 10 },
  'REVUES DE PRESSE':        { bg: 13, icon: 13 },
  'VEILLE DOCUMENTAIRE':     { bg: 14, icon: 14 },
};

/** Return the asset pair for a space, falling back to null if unknown */
function assetsFor(name = '') {
  const key = name.trim().toUpperCase();
  // exact match
  if (SPACE_ASSETS[key]) return SPACE_ASSETS[key];
  // partial match â€” e.g. "L'INFO DOC" contains "INFO DOC"
  const found = Object.keys(SPACE_ASSETS).find((k) => key.includes(k) || k.includes(key));
  return found ? SPACE_ASSETS[found] : null;
}

// â”€â”€â”€ Fallback helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Derive initials from a space name for the placeholder avatar
function initials(name = '') {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

// Pick a stable accent colour from a palette based on the space id
const PALETTE = [
  '#6B1A2A', '#1A6B5A', '#1A3E6B', '#6B5A1A',
  '#3E1A6B', '#1A6B2E', '#6B3E1A', '#1A5A6B',
];
function spaceColor(id) {
  return PALETTE[Number(id) % PALETTE.length];
}

export default function EspacesScreen({ navigation }) {
  const { colors, spacing, radius, shadow, layout, isDark, type: T } = useTheme();
  const { t, dirStyle } = useLang();

  const [spaces, setSpaces]     = useState([]);
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await getSpaces(1, 50);
      // Deduplicate by id â€” the API can return the same space more than once
      const raw = res?.results || [];
      const seen = new Set();
      const unique = raw.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      setSpaces(unique);
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger les espaces.', 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙØ¶Ø§Ø¡Ø§Øª.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? spaces.filter((s) => `${s.name} ${s.description || ''}`.toLowerCase().includes(q))
    : spaces;

  const renderItem = ({ item }) => {
    const color   = spaceColor(item.id);
    const members = item.members_count ?? item.member_count ?? item.members ?? null;
    const assets  = assetsFor(item.name);
    const bgSrc   = assets ? BACKGROUNDS[assets.bg] : null;
    const iconSrc = assets ? ICONS[assets.icon]     : null;
    const isPrivate = item.visibility === 2;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          shadow.md,
          {
            backgroundColor: isDark ? colors.bgElevated : colors.bgCard,
            borderRadius: radius.xl,
            marginHorizontal: layout.gutter,
            marginBottom: spacing.md,
          },
        ]}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('SpaceDetail', { space: item })}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        {/* â”€â”€ Top banner with gradient overlay â”€â”€ */}
        <View style={[styles.banner, { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: `${color}33` }]}>
          {bgSrc ? (
            <Image source={bgSrc} style={styles.bannerImg} resizeMode="cover" />
          ) : item.image_url || item.banner_url || item.cover_url ? (
            <AuthedImage
              uri={item.image_url || item.banner_url || item.cover_url}
              style={styles.bannerImg}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
          )}

          {/* Dark-to-transparent gradient at the bottom of the banner */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          {/* Visibility pill â€“ top-right */}
          <View style={[
            styles.visibilityPill,
            { backgroundColor: isPrivate ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)' },
          ]}>
            <Ionicons
              name={isPrivate ? 'lock-closed' : 'globe-outline'}
              size={10}
              color="#fff"
            />
            <Text style={styles.visibilityText}>
              {isPrivate ? t('PrivÃ©', 'Ø®Ø§Øµ') : t('Public', 'Ø¹Ø§Ù…')}
            </Text>
          </View>

          {/* Member count â€“ bottom-right */}
          {members != null ? (
            <View style={styles.membersBadge}>
              <Ionicons name="people" size={11} color="#fff" />
              <Text style={styles.membersText}>{members}</Text>
            </View>
          ) : null}
        </View>

        {/* â”€â”€ Body â€” icon floats here, overlapping the banner edge â”€â”€ */}
        <View style={styles.bodyWrapper}>
          {/* Circular icon â€“ left side, negative top to overlap the banner */}
          {iconSrc ? (
            <View style={[styles.iconCircle, { borderColor: isDark ? colors.bgElevated : colors.bgCard }]}>
              <Image source={iconSrc} style={styles.iconImg} resizeMode="contain" />
            </View>
          ) : (
            <View style={[styles.iconCircle, { borderColor: isDark ? colors.bgElevated : colors.bgCard, backgroundColor: color }]}>
              <Text style={styles.iconFallbackText}>{initials(item.name)}</Text>
            </View>
          )}

          <View style={styles.body}>
            <Text
              style={[T.bodyStrong, { fontSize: 15, color: colors.textPrimary, letterSpacing: 0.1 }, dirStyle]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.description ? (
              <Text
                style={[T.caption, { color: colors.textSecondary, lineHeight: 18, marginTop: 3 }, dirStyle]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* â”€â”€ Footer divider + arrow â”€â”€ */}
        <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
          <Text style={[{ fontSize: 11, color: colors.textMuted }, dirStyle]}>
            {t('Voir l\'espace', 'Ø¹Ø±Ø¶ Ø§Ù„ÙØ¶Ø§Ø¡')}
          </Text>
          <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <AppBar title={t('Mes Espaces', 'ÙØ¶Ø§Ø¡Ø§ØªÙŠ')} large />

      {/* Search bar */}
      <View style={[
        styles.searchWrap,
        {
          backgroundColor: colors.bgHeader,
          paddingHorizontal: layout.gutter,
          borderBottomColor: colors.borderLight,
        },
      ]}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgApp, borderRadius: radius.md }]}>
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }, dirStyle]}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Filtrer les espacesâ€¦', 'ØªØµÙÙŠØ© Ø§Ù„ÙØ¶Ø§Ø¡Ø§Øªâ€¦')}
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

      {loading ? (
        <SkeletonList count={6} variant="row" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(s, i) => `${s.id}-${i}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.bgCard}
            />
          }
          ListHeaderComponent={<View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <EmptyState
              icon="grid-outline"
              title={
                q
                  ? t('Aucun espace ne correspond', 'Ù„Ø§ ÙŠÙˆØ¬Ø¯ ÙØ¶Ø§Ø¡ Ù…Ø·Ø§Ø¨Ù‚')
                  : t('Aucun espace', 'Ù„Ø§ ØªÙˆØ¬Ø¯ ÙØ¶Ø§Ø¡Ø§Øª')
              }
              actionTitle={q ? t('Effacer le filtre', 'Ù…Ø³Ø­ Ø§Ù„Ù…Ø±Ø´Ø­') : null}
              onAction={q ? () => setQuery('') : null}
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
  /* â”€â”€ Card shell â”€â”€ */
  card: {
    overflow: 'hidden',
  },

  /* â”€â”€ Top banner â”€â”€ */
  banner: {
    height: 140,  // Increased for better JPEG display
    overflow: 'hidden',
  },
  bannerImg: {
    ...StyleSheet.absoluteFillObject,
  },

  /* Visibility pill â€“ top-right of banner */
  visibilityPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  visibilityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  /* Member count â€“ bottom-right of banner */
  membersBadge: {
    position: 'absolute',
    bottom: 20,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  membersText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  /* Icon circle â€“ pulls up to overlap the banner bottom edge */
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: -22,   // half its height â€” overlaps the banner
    marginLeft: 14,
    flexShrink: 0,
  },
  iconImg: {
    width: 30,
    height: 30,
  },
  iconFallbackText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },

  /* â”€â”€ Body row (icon + text side by side) â”€â”€ */
  bodyWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 16,
    paddingBottom: 12,
  },
  /* â”€â”€ Text block next to the icon â”€â”€ */
  body: {
    flex: 1,
    paddingLeft: 10,
    paddingTop: 6,
  },

  /* â”€â”€ Footer row â”€â”€ */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  /* â”€â”€ Search bar â”€â”€ */
  searchWrap: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13.5, padding: 0 },
});
