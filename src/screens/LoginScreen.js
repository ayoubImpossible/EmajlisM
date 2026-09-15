/**
 * Connexion.
 *
 * Points d'attention repris le 11/09/2026 :
 *   - le message d'échec vient du contexte d'authentification, qui distingue
 *     désormais un refus d'identifiants d'une panne réseau. L'écran affiche ce
 *     que le serveur a répondu, et propose « Réessayer » quand c'est le réseau :
 *     **une panne ne doit jamais s'afficher comme « mot de passe incorrect »** ;
 *   - la case « se souvenir de moi » a été retirée : elle ne faisait rien. La
 *     session est conservée dans SecureStore de toute façon, et le jeton HumHub
 *     n'expire pas ;
 *   - thème clair/sombre, clavier qui ne masque plus le bouton, et bascule de
 *     langue accessible avant la connexion — un membre arabophone ne devait pas
 *     avoir à se connecter en français d'abord.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { BASE_URL, IS_INSECURE_TRANSPORT } from '../config/env';
import { Button, Banner } from '../components/ui';

export default function LoginScreen() {
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, setLang, dirStyle } = useLang();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNetwork, setIsNetwork] = useState(false);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError(t('Veuillez remplir les deux champs.', 'يرجى ملء الحقلين.'));
      setIsNetwork(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await login(identifier.trim(), password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || t('La connexion a échoué.', 'فشل الاتصال.'));
      setIsNetwork(!!res.isNetwork);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bgApp }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { padding: layout.gutter, maxWidth: 460, width: '100%', alignSelf: 'center' },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Bascule de langue, avant même la connexion */}
        <View style={styles.langRow}>
          {[{ k: 'fr', l: 'FR' }, { k: 'ar', l: 'ع' }].map((x) => (
            <TouchableOpacity
              key={x.k}
              onPress={() => setLang(x.k)}
              style={[
                styles.langBtn,
                {
                  borderRadius: radius.full,
                  backgroundColor: lang === x.k ? colors.primary : 'transparent',
                  borderColor: lang === x.k ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{
                fontSize: 12, fontWeight: '800',
                color: lang === x.k ? colors.onPrimary : colors.textSecondary,
              }}>
                {x.l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.primary, borderRadius: radius.lg }]}>
            <Text style={styles.logoText}>eM</Text>
          </View>
          <Text style={[T.h1, { textAlign: 'center' }]}>E-Majlis</Text>
          <Text style={[T.caption, { textAlign: 'center' }]}>
            {t('Conseil Supérieur de l’Éducation, de la Formation\net de la Recherche Scientifique',
               'المجلس الأعلى للتربية والتكوين والبحث العلمي')}
          </Text>
        </View>

        {error ? (
          <Banner
            tone={isNetwork ? 'warning' : 'error'}
            message={error}
            onRetry={isNetwork ? submit : null}
            onDismiss={() => setError(null)}
          />
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text style={[T.label, dirStyle]}>{t('Identifiant ou courriel', 'المعرّف أو البريد')}</Text>
          <View style={[styles.field, { backgroundColor: colors.bgInput, borderColor: colors.border, borderRadius: radius.sm }]}>
            <Ionicons name="person-outline" size={17} color={colors.textMuted} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }, dirStyle]}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={t('votre identifiant', 'المعرّف الخاص بك')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="next"
            />
          </View>

          <Text style={[T.label, dirStyle]}>{t('Mot de passe', 'كلمة المرور')}</Text>
          <View style={[styles.field, { backgroundColor: colors.bgInput, borderColor: colors.border, borderRadius: radius.sm }]}>
            <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }, dirStyle]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Button
            title={t('Se connecter', 'تسجيل الدخول')}
            icon="log-in-outline"
            loading={loading}
            onPress={submit}
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {IS_INSECURE_TRANSPORT ? (
          <Banner
            tone="warning"
            message={t(
              'Connexion en HTTP simple : à réserver au développement.',
              'اتصال عبر HTTP بسيط: للتطوير فقط.',
            )}
          />
        ) : null}

        <Text style={[T.caption, { textAlign: 'center' }]} numberOfLines={1}>
          {String(BASE_URL || '—').replace(/^https?:\/\//, '')}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', gap: 18 },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  brand: { alignItems: 'center', gap: 8, marginBottom: 6 },
  logo: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, minHeight: 48, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14.5, padding: 0 },
});
