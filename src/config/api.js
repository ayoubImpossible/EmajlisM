/**
 * Constantes de l'API et catalogues d'affichage.
 *
 * Modifié le 10/09/2026 :
 *   - l'adresse du serveur n'est plus calculée ici. Elle vient de config/env.js,
 *     seul endroit qui la décide. Les exports BASE_URL / API_URL sont conservés :
 *     huit écrans les importent, rien n'a besoin de changer chez eux ;
 *   - ESPACES_CONSEIL, COMMISSIONS et ESERVICES ont été retirés. C'étaient des
 *     listes écrites à la main — sept commissions, quatre e-services, avec des
 *     effectifs figés (« count: 30 »). La plateforme compte 17 espaces et le
 *     catalogue des e-services vient du serveur (/api/eservices/catalog, cinq
 *     types réels). Aucun écran ne les importait plus.
 *
 * Ce qui reste ici est de l'habillage : libellés bilingues et regroupements
 * d'affichage. Aucune donnée métier ne doit être ajoutée dans ce fichier — elle
 * vient du serveur, ou elle n'existe pas.
 */

import { BASE_URL as ENV_BASE_URL, API_URL as ENV_API_URL } from './env';

export const BASE_URL = ENV_BASE_URL;
export const API_URL = ENV_API_URL;

// Sous-adresses utilisées par les anciens services (src/services/*).
export const MEMBRE_API_URL   = `${API_URL}/membres`;
export const PUBLI_API_URL    = `${API_URL}/publications`;
export const AUTH_API_URL     = `${API_URL}/auth`;
export const CALENDAR_API_URL = `${API_URL}/calendar`;
export const ESPACES_API_URL  = `${API_URL}/espaces`;
export const ESERVICE_API_URL = `${API_URL}/eservices`;
export const NOTIF_API_URL    = `${API_URL}/notifications`;

export const PER_PAGE = 12;
export const DEFAULT_LANG = 'fr';

/** Regroupements d'affichage des publications — libellés, pas données. */
export const CATEGORY_GROUPS = [
  {
    label_fr: 'Avis du Conseil',
    label_ar: 'آراء المجلس',
    items: [
      { fr: 'Avis - Auto saisine', ar: 'إحالة ذاتية' },
      { fr: 'Avis - Saisine',      ar: 'إحالة' },
    ],
  },
  {
    label_fr: 'Publications',
    label_ar: 'إصدارات المجلس',
    items: [
      { fr: 'Rapports',                          ar: 'تقارير' },
      { fr: 'Études et recherches',              ar: 'دراسات وأبحاث' },
      { fr: 'Actes des colloques et rencontres', ar: 'أشغال الندوات والملتقيات' },
      { fr: "Rapports d'activités",              ar: 'تقارير الأنشطة' },
      { fr: "Rapports d'évaluation & études",    ar: 'تقارير ودراسات تقييمية' },
      { fr: 'Revues et périodiques',             ar: 'مجلات ودوريات' },
    ],
  },
];

/**
 * Sous-catégories du formulaire « Demande de documentation ».
 * Ce sont des choix de formulaire, pas des données serveur : le type
 * `document` du catalogue e-services n'a pas de sous-type côté HumHub.
 */
export const DOC_SERVICES = [
  { id: 'pret',        icon: '📖', labelFr: "Réservation d'un ouvrage pour prêt physique",        labelAr: 'حجز مؤلف للإعارة المادية' },
  { id: 'bo',          icon: '📋', labelFr: "Demande d'un Bulletin Officiel",                     labelAr: 'طلب الجريدة الرسمية' },
  { id: 'dossier',     icon: '⭐', labelFr: "Demande de constitution d'un dossier documentaire",  labelAr: 'طلب إعداد ملف وثائقي' },
  { id: 'diverse',     icon: '🗂️', labelFr: 'Demande de documentation diverse',                   labelAr: 'طلب وثائق مختلفة' },
  { id: 'proposition', icon: '➕', labelFr: "Proposition de titres d'ouvrages pour acquisition",  labelAr: 'مقترح عناوين كتب للاقتناء' },
];
