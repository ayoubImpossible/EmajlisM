/**
 * Système de design — E-Majlis.
 *
 * Refonte du 11/09/2026. Ce qui a changé et pourquoi :
 *
 *  - **Thème sombre.** La plateforme web (thème « clean » de HumHub) en a un ;
 *    l'application n'en avait pas, et le système d'exploitation du téléphone en
 *    impose un depuis longtemps. Les couleurs sont maintenant des jetons
 *    sémantiques déclinés en clair et en sombre : un écran demande
 *    `colors.bgCard`, jamais `#FFFFFF`.
 *  - **Trois réglages** : « système » (par défaut, suit le téléphone), « clair »,
 *    « sombre ». Le choix est mémorisé.
 *  - **Responsive.** L'ancien fichier venait de maquettes à une seule largeur.
 *    Les tailles s'adaptent désormais à la largeur réelle : une tablette n'affiche
 *    plus une colonne de texte étirée sur 1 000 points, et un petit téléphone ne
 *    tronque plus les libellés.
 *
 * Compatibilité : `Colors`, `Spacing`, `Radius`, `Shadow`, `Typography` restent
 * exportés — ce sont les jetons du thème clair. Les écrans non encore migrés
 * continuent de fonctionner, en clair. Les écrans migrés utilisent `useTheme()`.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, useWindowDimensions, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEME_KEY = 'theme_scheme'; // 'system' | 'light' | 'dark'

// ── Palettes ─────────────────────────────────────────────────────────────────

/** Bordeaux CSEFRS — identité de marque, commune aux deux thèmes. */
const BRAND = {
  bordeaux: '#6B1A2A',
  bordeauxDark: '#4A1020',
  bordeauxLight: '#8B2439',
  olive: '#8B8B3A',
  teal: '#3A6B6B',
};

const LIGHT = {
  scheme: 'light',

  primary: BRAND.bordeaux,
  primaryDark: BRAND.bordeauxDark,
  primaryLight: BRAND.bordeauxLight,
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(107,26,42,0.10)',

  olive: BRAND.olive,
  oliveDark: '#6B6B2A',
  teal: BRAND.teal,
  charcoal: '#1A1A2E',

  textPrimary: '#1A1A2E',
  textSecondary: '#5A6270',
  textMuted: '#8A909C',
  textWhite: '#FFFFFF',
  textLink: BRAND.bordeaux,

  bgApp: '#F5F3F0',
  bgCard: '#FFFFFF',
  bgElevated: '#FFFFFF',
  bgInput: '#FFFFFF',
  bgHeader: '#FFFFFF',
  bgSection: '#F9F7F4',
  bgSubtle: '#EFECE7',

  border: '#E3DED6',
  borderLight: '#EFEAE3',

  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',

  successSoft: '#F0FDF4',
  warningSoft: '#FFFBEB',
  dangerSoft: '#FEF2F2',
  infoSoft: '#EFF6FF',

  skeleton: '#E9E4DC',
  overlay: 'rgba(16,16,20,0.45)',
  statusBar: 'dark-content',

  // Alias hérités — conservés pour les écrans non migrés.
  bgMain: '#FFFFFF',
  bgSecondary: '#F9F7F4',
  bgPage: '#F5F3F0',
  bgHighlight: 'rgba(107,26,42,0.08)',
  textContrast: '#FFFFFF',
  textHighlight: '#1A1A2E',
  textDefault: '#1A1A2E',
  textSoft: '#8A909C',
  tagFocus: BRAND.bordeaux,
  tagRevue: '#6B6B2A',
  tagPleniere: '#3A5F8B',
  certifiedBg: '#FEF9E7',
  certifiedBorder: '#F5D06B',
  certifiedText: '#92610C',
};

const DARK = {
  scheme: 'dark',

  // Le bordeaux plein manque de contraste sur fond sombre : on l'éclaircit pour
  // le texte et les icônes, on garde une version plus dense pour les aplats.
  primary: '#C6455E',
  primaryDark: '#8B2439',
  primaryLight: '#E0768C',
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(198,69,94,0.16)',

  olive: '#B4B45A',
  oliveDark: '#8B8B3A',
  teal: '#5A9A9A',
  charcoal: '#ECECEE',

  textPrimary: '#ECECEE',
  textSecondary: '#AAAAB4',
  textMuted: '#7C7C86',
  textWhite: '#FFFFFF',
  textLink: '#E0768C',

  bgApp: '#0F0F11',
  bgCard: '#1A1A1D',
  bgElevated: '#222226',
  bgInput: '#222226',
  bgHeader: '#1A1A1D',
  bgSection: '#16161A',
  bgSubtle: '#26262B',

  border: '#2E2E34',
  borderLight: '#26262B',

  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',

  successSoft: 'rgba(74,222,128,0.12)',
  warningSoft: 'rgba(251,191,36,0.12)',
  dangerSoft: 'rgba(248,113,113,0.12)',
  infoSoft: 'rgba(96,165,250,0.12)',

  skeleton: '#26262B',
  overlay: 'rgba(0,0,0,0.60)',
  statusBar: 'light-content',

  bgMain: '#1A1A1D',
  bgSecondary: '#16161A',
  bgPage: '#0F0F11',
  bgHighlight: 'rgba(198,69,94,0.14)',
  textContrast: '#FFFFFF',
  textHighlight: '#ECECEE',
  textDefault: '#ECECEE',
  textSoft: '#7C7C86',
  tagFocus: '#C6455E',
  tagRevue: '#B4B45A',
  tagPleniere: '#7AA0D8',
  certifiedBg: 'rgba(245,208,107,0.14)',
  certifiedBorder: '#8A6F21',
  certifiedText: '#E8C468',
};

// ── Échelles ─────────────────────────────────────────────────────────────────

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const Radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999 };

/**
 * Ombres. En thème sombre, une ombre noire ne se voit pas : la profondeur passe
 * par un fond plus clair (`bgElevated`) et une bordure, comme sur le web.
 */
function shadows(isDark) {
  if (isDark) {
    return {
      sm: { elevation: 0 },
      md: { elevation: 0 },
      lg: { elevation: 0 },
    };
  }
  return {
    sm: { shadowColor: '#00000018', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
    md: { shadowColor: '#00000020', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
    lg: { shadowColor: '#00000028', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8 },
  };
}

// ── Responsive ───────────────────────────────────────────────────────────────

/**
 * Points de rupture, repris de l'usage du web : sous 360 pt on est sur un petit
 * téléphone, au-dessus de 600 pt sur une tablette, au-dessus de 900 pt sur une
 * grande tablette ou une fenêtre de bureau.
 */
export const Breakpoints = { compact: 360, medium: 600, large: 900 };

function layoutFor(width) {
  const isSmall = width < Breakpoints.compact;
  const isTablet = width >= Breakpoints.medium;
  const isLarge = width >= Breakpoints.large;

  return {
    width,
    isSmall,
    isTablet,
    isLarge,
    /** Marge latérale : plus généreuse quand l'écran est large. */
    gutter: isLarge ? 32 : isTablet ? 24 : 16,
    /** Nombre de colonnes pour les grilles de cartes. */
    columns: isLarge ? 3 : isTablet ? 2 : 1,
    /**
     * Largeur maximale d'une colonne de lecture. Au-delà d'environ 700 points,
     * une ligne de texte devient pénible à suivre : sur tablette on centre le
     * contenu au lieu de l'étirer.
     */
    readingWidth: Math.min(width, 720),
    /** Ajustement typographique léger — jamais plus de 12 %. */
    fontScale: isLarge ? 1.12 : isTablet ? 1.06 : isSmall ? 0.94 : 1,
  };
}

function typography(colors, fontScale) {
  const s = (n) => Math.round(n * fontScale);
  return {
    h1: { fontSize: s(24), fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    h2: { fontSize: s(20), fontWeight: '700', color: colors.textPrimary },
    h3: { fontSize: s(16), fontWeight: '700', color: colors.textPrimary },
    h4: { fontSize: s(14), fontWeight: '700', color: colors.textPrimary },
    body: { fontSize: s(14), fontWeight: '400', color: colors.textSecondary, lineHeight: s(22) },
    bodyStrong: { fontSize: s(14), fontWeight: '600', color: colors.textPrimary, lineHeight: s(22) },
    caption: { fontSize: s(12), fontWeight: '400', color: colors.textMuted },
    label: {
      fontSize: s(11), fontWeight: '700', color: colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.8,
    },
    button: { fontSize: s(13), fontWeight: '700', letterSpacing: 0.6 },
  };
}

// ── Contexte ─────────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();          // 'light' | 'dark' | null
  const { width } = useWindowDimensions();
  const [preference, setPreference] = useState('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SCHEME_KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPreference(v); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(() => {
    const effective = preference === 'system' ? (systemScheme || 'light') : preference;
    const isDark = effective === 'dark';
    const colors = isDark ? DARK : LIGHT;
    const layout = layoutFor(width);

    return {
      colors,
      isDark,
      scheme: effective,
      preference,
      setScheme: (next) => {
        setPreference(next);
        AsyncStorage.setItem(SCHEME_KEY, next).catch(() => {});
      },
      spacing: Spacing,
      radius: Radius,
      shadow: shadows(isDark),
      type: typography(colors, layout.fontScale),
      layout,
      ready,
    };
  }, [preference, systemScheme, width, ready]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={value.colors.statusBar}
        backgroundColor={Platform.OS === 'android' ? value.colors.bgHeader : undefined}
      />
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Thème courant. Hors de `ThemeProvider`, renvoie le thème clair plutôt que de
 * lever une exception : un composant isolé (test, aperçu) doit rester rendable.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  const layout = layoutFor(Breakpoints.compact + 40);
  return {
    colors: LIGHT,
    isDark: false,
    scheme: 'light',
    preference: 'system',
    setScheme: () => {},
    spacing: Spacing,
    radius: Radius,
    shadow: shadows(false),
    type: typography(LIGHT, 1),
    layout,
    ready: true,
  };
}

/** Mise en page seule, quand les couleurs ne servent pas. */
export function useLayout() {
  const { width } = useWindowDimensions();
  return useMemo(() => layoutFor(width), [width]);
}

// ── Compatibilité ────────────────────────────────────────────────────────────
// Jetons du thème clair, exportés tels quels. Les écrans encore basés dessus
// restent en clair ; ils passeront à `useTheme()` au fur et à mesure.
export const Colors = LIGHT;
export const Shadow = shadows(false);
export const Typography = typography(LIGHT, 1);
export const LightColors = LIGHT;
export const DarkColors = DARK;
