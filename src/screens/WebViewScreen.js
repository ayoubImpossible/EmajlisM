/**
 * Vue web intégrée.
 *
 * Sert pour ce que l'API n'expose pas : pages personnalisées, tâches, sondages,
 * modification du profil. Le jeton de l'application n'est pas la session web :
 * l'utilisateur peut avoir à se connecter une fois dans cette vue. C'est dit,
 * plutôt que laissé deviner.
 *
 * Corrigé le 11/09/2026 :
 *   - le domaine HumHub était écrit en dur pour décider quels liens ouvrir ;
 *     la règle se base maintenant sur le domaine de la page demandée ;
 *   - une page qui échoue affichait un écran blanc muet : l'erreur est montrée,
 *     avec un bouton pour recharger et un autre pour ouvrir dans le navigateur ;
 *   - barre de progression, et couleurs du thème.
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { Screen, AppBar, Banner, Button } from '../components/ui';

export default function WebViewScreen({ route, navigation }) {
  const { url, title = '', headers: sourceHeaders } = route.params || {};
  const { colors, spacing, layout, type: T } = useTheme();
  const { t } = useLang();

  const ref = useRef(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(url);

  const isLocalFile = /^file:\/\//i.test(String(url));
  let host = '';
  try { if (!isLocalFile) host = new URL(String(url)).host; } catch (_) { host = ''; }

  if (!url) {
    return (
      <Screen>
        <AppBar title={title || t('Page', 'صفحة')} onBack={() => navigation.goBack()} />
        <View style={{ padding: layout.gutter }}>
          <Banner message={t('Aucune adresse fournie.', 'لم يتم توفير عنوان.')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar
        title={title || host}
        subtitle={host || undefined}
        onBack={() => navigation.goBack()}
        actions={[
          { icon: 'refresh-outline', label: t('Recharger', 'إعادة التحميل'), onPress: () => { setError(null); ref.current?.reload(); } },
          ...(!isLocalFile ? [{ icon: 'open-outline', label: t('Ouvrir dans le navigateur', 'فتح في المتصفح'), onPress: () => Linking.openURL(current || url).catch(() => {}) }] : []),
        ]}
      />

      {progress > 0 && progress < 1 ? (
        <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
        </View>
      ) : null}

      {error ? (
        <View style={{ padding: layout.gutter, gap: spacing.sm }}>
          <Banner message={error} onRetry={() => { setError(null); ref.current?.reload(); }} />
          <Button
            title={t('Ouvrir dans le navigateur', 'فتح في المتصفح')}
            icon="open-outline"
            variant="secondary"
            onPress={() => Linking.openURL(current || url).catch(() => {})}
          />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <WebView
          ref={ref}
          source={{ uri: url, headers: sourceHeaders || undefined }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          onNavigationStateChange={(s) => setCurrent(s.url)}
          onError={({ nativeEvent }) =>
            setError(nativeEvent?.description || t('La page n’a pas pu être chargée.', 'تعذر تحميل الصفحة.'))
          }
          onHttpError={({ nativeEvent }) =>
            setError(`${t('Le serveur a répondu', 'أجاب الخادم')} ${nativeEvent?.statusCode}`)
          }
          // Les liens vers un autre domaine partent dans le navigateur.
          // Pour les fichiers locaux (file://) on laisse la WebView gérer.
          onShouldStartLoadWithRequest={(req) => {
            if (isLocalFile || /^file:\/\//i.test(req.url)) return true;
            try {
              const reqHost = new URL(req.url).host;
              if (reqHost === host) return true;
              Linking.openURL(req.url).catch(() => {});
              return false;
            } catch (_) { return true; }
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.loader, { backgroundColor: colors.bgApp }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          style={{ backgroundColor: colors.bgApp }}
        />
        {loading && progress === 0 ? (
          <View style={[styles.loader, { backgroundColor: colors.bgApp }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={T.caption}>{t('Chargement…', 'جارٍ التحميل…')}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 2, width: '100%' },
  progressFill: { height: 2 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8 },
});
