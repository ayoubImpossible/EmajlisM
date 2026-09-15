/**
 * Description des champs de demande E-Services.
 *
 * Le serveur dit QUELS champs s'appliquent à quel type (`fields_by_type` du
 * catalogue) ; ce fichier dit seulement COMMENT afficher un champ : son libellé,
 * sa nature, s'il est obligatoire. Aucune liste de types ni de champs n'est
 * écrite ici — ajouter un champ côté serveur le fait apparaître dans le
 * formulaire, avec un rendu texte par défaut si son nom est inconnu.
 *
 * Natures observées le 11/09/2026 sur des demandes réelles :
 *   event_name        chaîne contenant l'IDENTIFIANT de l'événement ("3")
 *   date_start/_end   "AAAA-MM-JJ"
 *   shuttle_*         booléens
 *   flight_plan       texte libre
 *   sub_type          valeur de la liste `sub_types` du catalogue
 *   observations      texte libre, multiligne
 */

export const FIELD_UI = {
  event_name: {
    kind: 'select',
    source: 'events',       // catalogue.events -> { id, name }
    valueKey: 'id',
    labelKey: 'name',
    fr: 'Événement concerné',
    ar: 'الحدث المعني',
    required: true,
  },
  sub_type: {
    kind: 'select',
    source: 'sub_types',    // catalogue.sub_types -> { value, label }
    valueKey: 'value',
    labelKey: 'label',
    fr: 'Nature de la demande',
    ar: 'طبيعة الطلب',
    required: true,
  },
  date_start: { kind: 'date', fr: "Date d'arrivée", ar: 'تاريخ الوصول', required: true },
  date_end: { kind: 'date', fr: 'Date de départ', ar: 'تاريخ المغادرة', required: true },
  shuttle_arrival: { kind: 'bool', fr: "Navette à l'arrivée", ar: 'نقل عند الوصول' },
  shuttle_departure: { kind: 'bool', fr: 'Navette au départ', ar: 'نقل عند المغادرة' },
  flight_plan: {
    kind: 'textarea',
    fr: 'Trajet souhaité',
    ar: 'المسار المطلوب',
    placeholderFr: 'Ville de départ, ville d’arrivée, horaires souhaités…',
    placeholderAr: 'مدينة المغادرة، مدينة الوصول، الأوقات المطلوبة…',
  },
  observations: {
    kind: 'textarea',
    fr: 'Observations',
    ar: 'ملاحظات',
    placeholderFr: 'Précisions utiles au traitement de votre demande',
    placeholderAr: 'تفاصيل مفيدة لمعالجة طلبك',
  },
};

/** Description d'un champ non prévu : affiché en texte, jamais masqué. */
export function fieldUi(name) {
  return FIELD_UI[name] || {
    kind: 'text',
    fr: String(name).replace(/_/g, ' '),
    ar: String(name).replace(/_/g, ' '),
  };
}

/** Couleur d'un statut. Les valeurs viennent du serveur ; ceci n'est qu'un habillage. */
export const STATUS_COLOR = {
  pending: '#D97706',
  in_progress: '#2563EB',
  approved: '#16A34A',
  rejected: '#DC2626',
};

export const statusColor = (value) => STATUS_COLOR[value] || '#6B7280';

/** Icône par type de service. Un type inconnu reçoit une icône neutre. */
export const TYPE_ICON = {
  hebergement: 'bed-outline',
  billet_avion: 'airplane-outline',
  document: 'document-text-outline',
  indemnite: 'folder-open-outline',
  support: 'headset-outline',
};

export const typeIcon = (value) => TYPE_ICON[value] || 'apps-outline';

/** Vérifie une date « AAAA-MM-JJ » et son existence réelle (31/02 refusé). */
export function isValidDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}
