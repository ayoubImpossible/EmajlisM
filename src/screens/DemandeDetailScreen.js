/**
 * Détail d'une demande E-Services.
 *
 * Corrigé les 10-11/09/2026 :
 *   - l'écran appelait le serveur avec **axios nu, sans en-tête
 *     d'autorisation** : chaque ouverture recevait 401 ;
 *   - il affichait les statuts `processing` et `completed`, **qui n'existent
 *     pas** — toute demande en cours ou approuvée retombait sur « En attente ».
 *     Les libellés viennent maintenant du serveur (`status_label`) ;
 *   - l'historique des changements de statut (`status_logs`) n'était pas montré,
 *     alors que c'est ce que l'utilisateur vient vérifier ;
 *   - `event_name` contient l'**identifiant** de l'événement, pas son nom : il
 *     est résolu depuis le catalogue, sinon la demande affichait « 3 ».
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getRequest, getCatalog, changeStatus } from '../api/eservice';
import { messageFor } from '../api/client';
import { statusColor, typeIcon, fieldUi } from '../config/eserviceFields';
import { formatDate, formatDateTime, timeAgo } from '../utils/dates';
import { downloadAuthenticatedFile } from '../utils/files';
import { Screen, AppBar, Card, Badge, Banner, Button, EmptyState, SkeletonList } from '../components/ui';

/** Champs à présenter, dans cet ordre, s'ils sont renseignés. */
const FIELD_ORDER = [
  'sub_type', 'event_name', 'date_start', 'date_end',
  'shuttle_arrival', 'shuttle_departure', 'flight_plan', 'observations',
];

export default function DemandeDetailScreen({ route, navigation }) {
  const { demandeId } = route.params || {};
  const { colors, spacing, layout, type: T } = useTheme();
  const { t, lang, dirStyle } = useLang();

  const [demande, setDemande] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([getRequest(demandeId), getCatalog().catch(() => null)]);
      setDemande(d);
      if (c) setCatalog(c);
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Demande introuvable.', 'الطلب غير موجود.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [demandeId, t]);

  useEffect(() => { load(); }, [load]);

  /** Résout la valeur affichable d'un champ. */
  const displayValue = (name, raw) => {
    if (raw === null || raw === undefined || raw === '') return null;
    const ui = fieldUi(name);

    if (ui.kind === 'bool') return raw ? t('Oui', 'نعم') : t('Non', 'لا');
    if (ui.kind === 'date') return formatDate(raw, lang);

    if (name === 'event_name') {
      // Le serveur stocke l'identifiant de l'événement, pas son nom.
      const found = (catalog?.events || []).find((e) => String(e.id) === String(raw));
      return found ? found.name : String(raw);
    }
    if (name === 'sub_type') {
      const found = (catalog?.sub_types || []).find((s) => s.value === raw);
      return found ? found.label : String(raw);
    }
    return String(raw);
  };

  const download = async (f) => {
    setDownloading(f.id);
    const res = await downloadAuthenticatedFile({
      id: f.id,
      api_download_url: f.api_download_url,
      title: f.file_name || f.title,
      mime_type: f.mime_type,
    });
    setDownloading(null);
    if (!res.ok) setError(res.reason);
  };

  const setStatus = async (value) => {
    setBusy(true);
    try {
      await changeStatus(demandeId, value);
      await load();
    } catch (e) {
      setError(messageFor(e, t("Le statut n'a pas pu être changé.", 'تعذر تغيير الحالة.')));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppBar title={t('Demande', 'الطلب')} onBack={() => navigation.goBack()} />
        <SkeletonList count={4} />
      </Screen>
    );
  }

  if (!demande) {
    return (
      <Screen>
        <AppBar title={t('Demande', 'الطلب')} onBack={() => navigation.goBack()} />
        <EmptyState icon="alert-circle-outline" title={error || t('Demande introuvable.', 'الطلب غير موجود.')} />
      </Screen>
    );
  }

  const tint = statusColor(demande.status);
  const rows = FIELD_ORDER
    .map((name) => ({ name, ui: fieldUi(name), value: displayValue(name, demande[name]) }))
    .filter((r) => r.value !== null);

  const isManager = !!catalog?.is_manager;
  const logs = demande.status_logs || [];
  const files = demande.files || [];

  return (
    <Screen>
      <AppBar
        title={demande.type_label || demande.type}
        subtitle={`#${demande.id}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{ padding: layout.gutter, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgCard}
          />
        }
      >
        {error ? <Banner message={error} onDismiss={() => setError(null)} /> : null}

        <Card style={{ gap: spacing.sm }}>
          <View style={styles.headRow}>
            <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>
              <Ionicons name={typeIcon(demande.type)} size={22} color={tint} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[T.h3, dirStyle]}>{demande.type_label || demande.type}</Text>
              <Badge label={demande.status_label || demande.status} color={tint} />
            </View>
          </View>
          <Text style={T.caption}>
            {t('Déposée le', 'قُدّم في')} {formatDateTime(demande.created_at, lang)}
            {demande.user?.display_name ? ` · ${demande.user.display_name}` : ''}
          </Text>
        </Card>

        {rows.length ? (
          <Card padded={false}>
            {rows.map((r, i) => (
              <View
                key={r.name}
                style={[
                  styles.fieldRow,
                  {
                    paddingHorizontal: spacing.md,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.borderLight,
                  },
                ]}
              >
                <Text style={[T.caption, { width: 130 }]}>{lang === 'ar' ? r.ui.ar : r.ui.fr}</Text>
                <Text style={[T.bodyStrong, { flex: 1, fontSize: 13 }, dirStyle]}>{r.value}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {demande.admin_comment ? (
          <Banner tone="info" message={`${t('Réponse du gestionnaire', 'رد المسؤول')} : ${demande.admin_comment}`} />
        ) : null}

        {files.length ? (
          <>
            <Text style={T.label}>{t('Pièces jointes', 'المرفقات')}</Text>
            <Card padded={false}>
              {files.map((f, i) => (
                <TouchableOpacity
                  key={String(f.id)}
                  style={[
                    styles.fieldRow,
                    {
                      paddingHorizontal: spacing.md,
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.borderLight,
                    },
                  ]}
                  onPress={() => download(f)}
                  disabled={!!downloading}
                >
                  <Ionicons name="document-attach-outline" size={17} color={colors.primary} />
                  <Text style={[T.bodyStrong, { flex: 1, fontSize: 13 }, dirStyle]} numberOfLines={2}>
                    {f.file_name || f.title}
                  </Text>
                  {downloading === f.id
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Ionicons name="cloud-download-outline" size={16} color={colors.textMuted} />}
                </TouchableOpacity>
              ))}
            </Card>
          </>
        ) : null}

        {logs.length ? (
          <>
            <Text style={T.label}>{t('Historique', 'السجل')}</Text>
            <Card padded={false}>
              {logs.map((l, i) => (
                <View
                  key={String(l.id)}
                  style={[
                    styles.logRow,
                    {
                      paddingHorizontal: spacing.md,
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.borderLight,
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: statusColor(l.new_status) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.bodyStrong, { fontSize: 12.5 }]}>
                      {l.old_status
                        ? `${l.old_status} → ${l.new_status}`
                        : t('Demande créée', 'تم إنشاء الطلب')}
                    </Text>
                    {l.comment ? <Text style={T.caption}>{l.comment}</Text> : null}
                    <Text style={T.caption}>{timeAgo(l.created_at, lang)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {isManager ? (
          <>
            <Text style={T.label}>{t('Traitement', 'المعالجة')}</Text>
            <View style={{ gap: spacing.sm }}>
              {(catalog?.statuses || [])
                .filter((s) => s.value !== demande.status)
                .map((s) => (
                  <Button
                    key={s.value}
                    title={s.label}
                    variant={s.value === 'rejected' ? 'danger' : 'secondary'}
                    loading={busy}
                    onPress={() => setStatus(s.value)}
                  />
                ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
});
