/**
 * Dates.
 *
 * HumHub renvoie « 2026-09-16 10:00:00 » — sans T, sans fuseau. `new Date()`
 * l'accepte sur Android et le rejette sur iOS (Invalid Date). L'application
 * affichait donc des dates vides sur iPhone. Toute date venant du serveur doit
 * passer par `parseServerDate`.
 *
 * Le serveur est réglé sur Africa/Casablanca ; la chaîne ne portant pas de
 * fuseau, elle est lue comme une heure locale — ce qui est le comportement
 * attendu pour un horaire de réunion.
 */

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Renvoie un Date valide, ou null. Ne renvoie jamais « Invalid Date ». */
export function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const s = String(value).trim();

  // « 2026-09-16 10:00:00 » ou « 2026-09-16 10:00 »
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }

  // « 2026-09-16 »
  const md = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (md) {
    const d = new Date(+md[1], +md[2] - 1, +md[3]);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s); // ISO complet avec fuseau
  return isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, '0');

/** « 16 septembre 2026 » / « 16 شتنبر 2026 ». Chaîne vide si la date est absente. */
export function formatDate(value, lang = 'fr') {
  const d = parseServerDate(value);
  if (!d) return '';
  const months = lang === 'ar' ? MONTHS_AR : MONTHS_FR;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** « lundi 16 septembre 2026 ». */
export function formatDateLong(value, lang = 'fr') {
  const d = parseServerDate(value);
  if (!d) return '';
  const days = lang === 'ar' ? DAYS_AR : DAYS_FR;
  return `${days[d.getDay()]} ${formatDate(d, lang)}`;
}

/** « 10:00 ». */
export function formatTime(value) {
  const d = parseServerDate(value);
  if (!d) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** « 16 septembre 2026 à 10:00 ». */
export function formatDateTime(value, lang = 'fr') {
  const d = parseServerDate(value);
  if (!d) return '';
  const at = lang === 'ar' ? 'على' : 'à';
  return `${formatDate(d, lang)} ${at} ${formatTime(d)}`;
}

/** « il y a 3 jours ». Retombe sur la date absolue au-delà d'un mois. */
export function timeAgo(value, lang = 'fr') {
  const d = parseServerDate(value);
  if (!d) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);

  if (sec < 0) return formatDate(d, lang);
  if (lang === 'ar') {
    if (sec < 60) return 'الآن';
    if (sec < 3600) return `منذ ${Math.floor(sec / 60)} دقيقة`;
    if (sec < 86400) return `منذ ${Math.floor(sec / 3600)} ساعة`;
    if (sec < 2592000) return `منذ ${Math.floor(sec / 86400)} يوم`;
    return formatDate(d, lang);
  }
  if (sec < 60) return "à l'instant";
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `il y a ${Math.floor(sec / 3600)} h`;
  if (sec < 2592000) return `il y a ${Math.floor(sec / 86400)} j`;
  return formatDate(d, lang);
}

/** Clé « YYYY-MM-DD » — pour regrouper par jour. */
export function dayKey(value) {
  const d = parseServerDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Tri décroissant sur une date serveur, robuste aux valeurs manquantes. */
export function byDateDesc(field) {
  return (a, b) => {
    const da = parseServerDate(a?.[field]);
    const db = parseServerDate(b?.[field]);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  };
}
