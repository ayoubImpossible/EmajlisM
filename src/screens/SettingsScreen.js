/**
 * Réglages.
 *
 * Nouveautés du 11/09/2026 : choix du thème (système / clair / sombre) et de la
 * langue, tous deux mémorisés. L'écran précédent ne proposait que les
 * notifications push.
 *
 * Sur les notifications : la case ne promet rien qu'elle ne tienne. Tant que le
 * transport n'est pas arrêté (voir BG-11), elle enregistre le jeton Expo et le
 * dit clairement, au lieu de laisser croire que tout est branché.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { BASE_URL, IS_INSECURE_TRANSPORT } from '../config/env';
import { registerForPushNotifications } from '../services/notificationService';
import { Screen, AppBar, Card, Banner, Button } from '../components/ui';

export default function SettingsScreen({ navigation }) {
  const { colors, spacing, radius, layout, type: T, preference, setScheme, isDark } = useTheme();
  const { t, lang, setLang, dirStyle } = useLang();
  const { logout, user } = useAuth();

  const [push, setPush] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('push_enabled').then((v) => setPush(v === 'true')).catch(() => {});
  }, []);

  const togglePush = async (next) => {
    setPushBusy(true);
    setPushNote(null);
    try {
      if (next) {
        const token = await registerForPushNotifications();
        if (!token) {
          setPush(false);
          setPushNote(t(
            "L'autorisation n'a pas été accordée, ou l'appareil ne la prend pas en charge.",
            'لم يتم منح الإذن، أو أن الجهاز لا يدعمه.',
          ));
          return;
        }
        await AsyncStorage.multiSet([['push_enabled', 'true'], ['push_token', token]]);
        setPush(true);
        setPushNote(t(
          "Jeton enregistré sur cet appareil. L'envoi effectif dépend du transport choisi côté serveur.",
          'تم تسجيل الرمز على هذا الجهاز. يعتمد الإرسال الفعلي على وسيلة النقل المختارة في الخادم.',
        ));
      } else {
        await AsyncStorage.setItem('push_enabled', 'false');
        setPush(false);
      }
    } catch (e) {
      setPush(false);
      setPushNote(e?.message || t('Opération impossible.', 'تعذرت العملية.'));
    } finally {
      setPushBusy(false);
    }
  };

  const themes = [
    { key: 'system', icon: 'phone-portrait-outline', label: t('Système', 'النظام') },
    { key: 'light', icon: 'sunny-outline', label: t('Clair', 'فاتح') },
    { key: 'dark', icon: 'moon-outline', label: t('Sombre', 'داكن') },
  ];

  const langs = [
    { key: 'fr', label: 'Français' },
    { key: 'ar', label: 'العربية' },
  ];

  return (
    <Screen>
      <AppBar title={t('Réglages', 'الإعدادات')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: layout.gutter, paddingBottom: spacing.xxl, gap: spacing.md }}>

        {/* ── Apparence ── */}
        <Text style={T.label}>{t('Apparence', 'المظهر')}</Text>
        <Card padded={false}>
          <View style={[styles.segment, { padding: spacing.sm, gap: spacing.sm }]}>
            {themes.map((th) => {
              const active = preference === th.key;
              return (
                <TouchableOpacity
                  key={th.key}
                  style={[
                    styles.segmentBtn,
                    {
                      borderRadius: radius.sm,
                      backgroundColor: active ? colors.primary : colors.bgApp,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setScheme(th.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={th.icon} size={18} color={active ? colors.onPrimary : colors.textSecondary} />
                  <Text style={[styles.segmentText, { color: active ? colors.onPrimary : colors.textSecondary }]}>
                    {th.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[T.caption, { paddingHorizontal: spacing.md, paddingBottom: spacing.md }]}>
            {preference === 'system'
              ? t(`Suit votre téléphone — actuellement ${isDark ? 'sombre' : 'clair'}.`,
                  `يتبع هاتفك — حالياً ${isDark ? 'داكن' : 'فاتح'}.`)
              : t('Choix fixé pour cette application.', 'اختيار ثابت لهذا التطبيق.')}
          </Text>
        </Card>

        {/* ── Langue ── */}
        <Text style={T.label}>{t('Langue', 'اللغة')}</Text>
        <Card padded={false}>
          {langs.map((l, i) => (
            <TouchableOpacity
              key={l.key}
              style={[
                styles.row,
                {
                  paddingHorizontal: spacing.md,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.borderLight,
                },
              ]}
              onPress={() => setLang(l.key)}
            >
              <Text style={[T.bodyStrong, { flex: 1, fontSize: 13.5 }]}>{l.label}</Text>
              {lang === l.key ? <Ionicons name="checkmark" size={19} color={colors.primary} /> : null}
            </TouchableOpacity>
          ))}
        </Card>

        {/* ── Notifications ── */}
        <Text style={T.label}>{t('Notifications', 'الإشعارات')}</Text>
        <Card padded={false}>
          <View style={[styles.row, { paddingHorizontal: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]}>
                {t('Notifications sur cet appareil', 'إشعارات على هذا الجهاز')}
              </Text>
              <Text style={T.caption}>
                {Platform.OS === 'ios'
                  ? t('Autorisation demandée au système.', 'يتم طلب الإذن من النظام.')
                  : t('Requiert une autorisation Android.', 'يتطلب إذن أندرويد.')}
              </Text>
            </View>
            <Switch
              value={push}
              disabled={pushBusy}
              onValueChange={togglePush}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>
        {pushNote ? <Banner tone="info" message={pushNote} onDismiss={() => setPushNote(null)} /> : null}

        {/* ── Connexion ── */}
        <Text style={T.label}>{t('Connexion', 'الاتصال')}</Text>
        <Card>
          <Text style={[T.caption, dirStyle]}>{t('Compte', 'الحساب')}</Text>
          <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]}>{user?.display_name || '—'}</Text>
          <View style={{ height: spacing.sm }} />
          <Text style={[T.caption, dirStyle]}>{t('Serveur', 'الخادم')}</Text>
          <Text style={[T.bodyStrong, { fontSize: 12.5 }]} numberOfLines={1}>{BASE_URL || '—'}</Text>
        </Card>

        {IS_INSECURE_TRANSPORT ? (
          <Banner
            tone="warning"
            message={t(
              "La connexion au serveur se fait en HTTP simple : votre jeton circule en clair sur le réseau. À réserver au développement.",
              'الاتصال بالخادم عبر HTTP بسيط: رمزك يمر بدون تشفير. للتطوير فقط.',
            )}
          />
        ) : null}

        <Button
          title={t('Se déconnecter', 'تسجيل الخروج')}
          icon="log-out-outline"
          variant="danger"
          onPress={() => Alert.alert(
            t('Se déconnecter', 'تسجيل الخروج'),
            t('Vous devrez saisir à nouveau vos identifiants.', 'سيتعين عليك إدخال بياناتك مرة أخرى.'),
            [
              { text: t('Annuler', 'إلغاء'), style: 'cancel' },
              { text: t('Se déconnecter', 'تسجيل الخروج'), style: 'destructive', onPress: () => logout() },
            ],
          )}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row' },
  segmentBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderWidth: 1,
  },
  segmentText: { fontSize: 11.5, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
