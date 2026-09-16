/**
 * Formulaire de demande — engendré depuis le catalogue.
 *
 * Remplace quatre écrans figés (hébergement, billet, documentation, support) qui
 * répétaient la même logique avec des champs écrits à la main, et qui
 * envoyaient des noms de champs différents de ceux attendus par le serveur.
 *
 * Ici, les champs affichés sont exactement ceux que le serveur déclare dans
 * `fields_by_type` pour le type choisi. Ajouter un champ ou un type côté serveur
 * le fait apparaître sans toucher à l'application ; un champ dont le nom n'est
 * pas connu s'affiche en texte libre plutôt que d'être ignoré.
 *
 * Pourquoi pas de sélecteur de date natif : `@react-native-community/datetimepicker`
 * n'est pas installé. Plutôt que d'ajouter une dépendance, la date est saisie au
 * format AAAA-MM-JJ et **validée** (31/02 est refusé), avec des raccourcis
 * « aujourd'hui / demain ». À remplacer par un vrai sélecteur si la dépendance
 * est ajoutée.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useLang } from '../context/LangContext';
import { getCatalog, createRequest } from '../api/eservice';
import { messageFor } from '../api/client';
import { fieldUi, isValidDate, typeIcon } from '../config/eserviceFields';
import { useTheme } from '../config/theme';
import { Screen, AppBar, Banner, Button } from '../components/ui';

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function DemandeFormScreen({ route, navigation }) {
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, dirStyle } = useLang();
  const styles = useMemo(() => makeStyles({ colors, spacing, radius }), [colors, spacing, radius]);
  const initialType = route.params?.type || null;

  const [catalog, setCatalog] = useState(null);
  const [type, setType] = useState(initialType);
  const [values, setValues] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let alive = true;
    getCatalog()
      .then((c) => { if (alive) setCatalog(c); })
      .catch((e) => { if (alive) setError(messageFor(e, t('Catalogue indisponible.', 'الكتالوج غير متاح.'))); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [t]);

  const fields = useMemo(() => {
    if (!catalog || !type) return [];
    return catalog.fields_by_type?.[type] || [];
  }, [catalog, type]);

  const label = (ui) => (lang === 'ar' ? ui.ar : ui.fr);

  const setValue = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const errorFor = (name) => {
    const ui = fieldUi(name);
    const v = values[name];
    if (ui.required && (v === undefined || v === null || String(v).trim() === '')) {
      return t('Champ obligatoire', 'حقل إلزامي');
    }
    if (ui.kind === 'date' && v && !isValidDate(v)) {
      return t('Date invalide (AAAA-MM-JJ)', 'تاريخ غير صالح (سسسس- شش-يي)');
    }
    return null;
  };

  const firstError = fields.map(errorFor).find(Boolean) || null;

  // Cohérence des deux dates : une fin avant le début est une erreur de saisie.
  const dateOrderError =
    values.date_start && values.date_end &&
    isValidDate(values.date_start) && isValidDate(values.date_end) &&
    values.date_end < values.date_start
      ? t('La date de départ précède la date d’arrivée.', 'تاريخ المغادرة قبل تاريخ الوصول.')
      : null;

  const submit = async () => {
    setTouched(Object.fromEntries(fields.map((f) => [f, true])));
    if (firstError || dateOrderError) {
      setError(dateOrderError || firstError);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const payload = { type };
      for (const name of fields) {
        const ui = fieldUi(name);
        let v = values[name];
        if (ui.kind === 'bool') v = !!v;
        else if (v === undefined || v === null) continue;
        else if (typeof v === 'string') { v = v.trim(); if (!v) continue; }
        payload[name] = v;
      }
      const res = await createRequest(payload);
      setDone(res?.id || res?.request?.id || true);
    } catch (e) {
      setError(messageFor(e, t("La demande n'a pas pu être envoyée.", 'تعذر إرسال الطلب.')));
    } finally {
      setSending(false);
    }
  };

  // ── Confirmation ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <Screen>
        <View style={[styles.bg, styles.centerAll]}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.doneTitle}>{t('Demande envoyée', 'تم إرسال الطلب')}</Text>
          <Text style={styles.doneText}>
            {typeof done === 'number'
              ? t(`Votre demande n° ${done} a été enregistrée.`, `تم تسجيل طلبك رقم ${done}.`)
              : t('Votre demande a été enregistrée.', 'تم تسجيل طلبك.')}
          </Text>
          <Button
            title={t('Voir mes demandes', 'عرض طلباتي')}
            onPress={() => navigation.replace('MesDemandes')}
            full={false}
          />
          <TouchableOpacity onPress={() => navigation.popToTop()}>
            <Text style={styles.linkText}>{t('Retour aux services', 'العودة إلى الخدمات')}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppBar title={t('Nouvelle demande', 'طلب جديد')} onBack={() => navigation.goBack()} />

      {error ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <Banner message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerAll}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !catalog ? (
        <View style={styles.centerAll}>
          <Text style={styles.muted}>{t('Catalogue indisponible.', 'الكتالوج غير متاح.')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {/* Type de service — liste du serveur */}
          <Text style={styles.groupLabel}>{t('Type de demande', 'نوع الطلب')}</Text>
          <View style={styles.typeGrid}>
            {(catalog.types || []).map((ty) => (
              <TouchableOpacity
                key={ty.value}
                style={[styles.typeCard, type === ty.value && styles.typeCardActive]}
                onPress={() => { setType(ty.value); setValues({}); setTouched({}); }}
              >
                <Ionicons
                  name={typeIcon(ty.value)}
                  size={20}
                  color={type === ty.value ? colors.onPrimary : colors.primary}
                />
                <Text style={[styles.typeCardText, type === ty.value && styles.typeCardTextActive]} numberOfLines={2}>
                  {ty.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!type ? (
            <Text style={styles.muted}>{t('Choisissez un type pour continuer.', 'اختر نوعاً للمتابعة.')}</Text>
          ) : fields.length === 0 ? (
            <Text style={styles.muted}>
              {t('Ce type ne demande aucune information supplémentaire.',
                 'هذا النوع لا يتطلب معلومات إضافية.')}
            </Text>
          ) : fields.map((name) => {
            const ui = fieldUi(name);
            const err = touched[name] ? errorFor(name) : null;

            return (
              <View key={name} style={styles.field}>
                <Text style={[styles.fieldLabel, dirStyle]}>
                  {label(ui)}{ui.required ? <Text style={styles.req}> *</Text> : null}
                </Text>

                {ui.kind === 'select' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {(catalog[ui.source] || []).map((opt) => {
                      const val = String(opt[ui.valueKey]);
                      const active = String(values[name]) === val;
                      return (
                        <TouchableOpacity
                          key={val}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => { setValue(name, val); setTouched((p) => ({ ...p, [name]: true })); }}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                            {opt[ui.labelKey]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : ui.kind === 'bool' ? (
                  <View style={styles.switchRow}>
                    <Switch
                      value={!!values[name]}
                      onValueChange={(v) => setValue(name, v)}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                    <Text style={styles.switchText}>
                      {values[name] ? t('Oui', 'نعم') : t('Non', 'لا')}
                    </Text>
                  </View>
                ) : ui.kind === 'date' ? (
                  <View>
                    <TextInput
                      style={[styles.input, err && styles.inputError, dirStyle]}
                      value={values[name] || ''}
                      onChangeText={(v) => setValue(name, v)}
                      onBlur={() => setTouched((p) => ({ ...p, [name]: true }))}
                      placeholder="AAAA-MM-JJ"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                    <View style={styles.quickRow}>
                      <TouchableOpacity
                        style={styles.quickBtn}
                        onPress={() => setValue(name, isoDay(new Date()))}
                      >
                        <Text style={styles.quickText}>{t("Aujourd'hui", 'اليوم')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickBtn}
                        onPress={() => {
                          const d = new Date(); d.setDate(d.getDate() + 1);
                          setValue(name, isoDay(d));
                        }}
                      >
                        <Text style={styles.quickText}>{t('Demain', 'غداً')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TextInput
                    style={[
                      styles.input,
                      ui.kind === 'textarea' && styles.textarea,
                      err && styles.inputError,
                      dirStyle,
                    ]}
                    value={values[name] || ''}
                    onChangeText={(v) => setValue(name, v)}
                    onBlur={() => setTouched((p) => ({ ...p, [name]: true }))}
                    placeholder={lang === 'ar' ? ui.placeholderAr || '' : ui.placeholderFr || ''}
                    placeholderTextColor={colors.textMuted}
                    multiline={ui.kind === 'textarea'}
                    numberOfLines={ui.kind === 'textarea' ? 4 : 1}
                  />
                )}

                {err ? <Text style={styles.fieldError}>{err}</Text> : null}
              </View>
            );
          })}

          {dateOrderError ? <Text style={styles.fieldError}>{dateOrderError}</Text> : null}

          {type ? (
            <Button
              title={t('Envoyer la demande', 'إرسال الطلب')}
              icon="paper-plane-outline"
              loading={sending}
              onPress={submit}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}
        </ScrollView>
      )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = ({ colors, spacing, radius }) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bgApp },
  centerAll: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  form: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  groupLabel: {
    fontSize: 11, fontWeight: '800', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  typeCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeCardText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  typeCardTextActive: { color: colors.onPrimary },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary },
  req: { color: colors.danger },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 13.5, color: colors.textPrimary, minHeight: 46,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger, borderWidth: 1 },
  fieldError: { fontSize: 11, color: colors.danger },
  chipRow: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, maxWidth: 200 },
  chipTextActive: { color: colors.onPrimary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchText: { fontSize: 13, color: colors.textSecondary },
  quickRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  quickBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.bgCard, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  quickText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: spacing.sm },
  doneTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  doneText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  muted: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
});
