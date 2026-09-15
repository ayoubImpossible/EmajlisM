/**
 * Administration des demandes E-Services.
 *
 * Corrigé les 10-11/09/2026 :
 *   - l'écran appelait `${API_URL}/eservices/admin` avec **axios nu, sans jeton** :
 *     chaque chargement recevait 401 ;
 *   - il changeait le statut par `PATCH /eservices/:id/status`, **route qui
 *     n'existait pas** côté Express — l'appel repartait en 404 sans que rien ne
 *     le signale. La route a été ajoutée, et l'écran passe par le client
 *     authentifié ;
 *   - les statuts proposés étaient `processing` et `completed`, inconnus du
 *     serveur. Ils viennent du catalogue.
 *
 * L'accès repose sur `is_manager`, renvoyé par le serveur — jamais sur une
 * étiquette de profil (BG-10). Si le serveur dit non, l'écran le dit aussi.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../config/theme';
import { useLang } from '../context/LangContext';
import { getAdminRequests, getCatalog, changeStatus } from '../api/eservice';
import { messageFor } from '../api/client';
import { statusColor, typeIcon } from '../config/eserviceFields';
import { formatDate } from '../utils/dates';
import { Screen, AppBar, Chip, ChipRow, Banner, EmptyState, Badge, Avatar, SkeletonList } from '../components/ui';

export default function AdminDemandesScreen({ navigation }) {
  const { colors, spacing, radius, layout, type: T } = useTheme();
  const { t, lang, dirStyle, forwardIcon } = useLang();

  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [status, setStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      const [res, cat] = await Promise.all([
        getAdminRequests({ page: p, limit: 25, ...(status ? { status } : {}) }),
        catalog ? Promise.resolve(catalog) : getCatalog().catch(() => null),
      ]);
      if (cat) setCatalog(cat);
      const list = res?.results || [];
      setPages(res?.pages || 1);
      setPage(p);
      setRows((prev) => (append ? [...prev, ...list] : list));
      setError(null);
    } catch (e) {
      setError(messageFor(e, t('Impossible de charger les demandes.', 'تعذر تحميل الطلبات.')));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [status, catalog, t]);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const advance = async (item, next) => {
    setBusyId(item.id);
    try {
      await changeStatus(item.id, next);
      await load(1);
    } catch (e) {
      setError(messageFor(e, t("Le statut n'a pas pu être changé.", 'تعذر تغيير الحالة.')));
    } finally {
      setBusyId(null);
    }
  };

  // Le serveur seul décide qui est gestionnaire.
  if (catalog && catalog.is_manager === false) {
    return (
      <Screen>
        <AppBar title={t('Administration', 'الإدارة')} onBack={() => navigation.goBack()} />
        <EmptyState
          icon="lock-closed-outline"
          title={t('Accès réservé', 'وصول محجوز')}
          description={t("Seuls les gestionnaires E-Services peuvent traiter les demandes.",
                         'يمكن لمسؤولي الخدمات الإلكترونية فقط معالجة الطلبات.')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar
        title={t('Administration', 'الإدارة')}
        subtitle={t('Demandes des membres', 'طلبات الأعضاء')}
        onBack={() => navigation.goBack()}
      />

      {catalog?.statuses?.length ? (
        <ChipRow>
          <Chip label={t('Toutes', 'الكل')} active={!status} onPress={() => { setStatus(null); setLoading(true); }} />
          {catalog.statuses.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              color={statusColor(s.value)}
              active={status === s.value}
              onPress={() => { setStatus(status === s.value ? null : s.value); setLoading(true); }}
            />
          ))}
        </ChipRow>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingTop: spacing.sm }}>
          <Banner message={error} onRetry={() => load(1)} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {loading ? <SkeletonList count={5} variant="row" /> : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => {
            const tint = statusColor(item.status);
            const quick = (catalog?.statuses || []).filter((s) => s.value !== item.status).slice(0, 2);
            return (
              <View style={[styles.card, {
                backgroundColor: colors.bgCard,
                borderBottomColor: colors.borderLight,
                paddingHorizontal: layout.gutter,
              }]}>
                <TouchableOpacity
                  style={styles.head}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('DemandeDetail', { demandeId: item.id })}
                >
                  <View style={[styles.icon, { backgroundColor: `${tint}22`, borderRadius: radius.sm }]}>
                    <Ionicons name={typeIcon(item.type)} size={19} color={tint} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[T.bodyStrong, { fontSize: 13.5 }, dirStyle]} numberOfLines={1}>
                      {item.type_label || item.type}
                    </Text>
                    <View style={styles.byRow}>
                      <Avatar name={item.user?.display_name} size={18} />
                      <Text style={T.caption} numberOfLines={1}>
                        {[item.user?.display_name, `#${item.id}`, formatDate(item.created_at, lang)]
                          .filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Badge label={item.status_label || item.status} color={tint} />
                  </View>
                  <Ionicons name={forwardIcon} size={16} color={colors.border} />
                </TouchableOpacity>

                {quick.length ? (
                  <View style={styles.actions}>
                    {quick.map((s) => (
                      <TouchableOpacity
                        key={s.value}
                        style={[styles.action, {
                          borderColor: statusColor(s.value),
                          borderRadius: radius.full,
                          opacity: busyId === item.id ? 0.5 : 1,
                        }]}
                        disabled={busyId === item.id}
                        onPress={() => advance(item, s.value)}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: statusColor(s.value) }}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(1); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.bgCard}
            />
          }
          onEndReached={() => { if (page < pages) load(page + 1, true); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-outline"
              title={status ? t('Aucune demande dans ce statut', 'لا توجد طلبات بهذه الحالة') : t('Aucune demande', 'لا توجد طلبات')}
              actionTitle={status ? t('Voir toutes', 'عرض الكل') : null}
              onAction={status ? () => { setStatus(null); setLoading(true); } : null}
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
  card: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 8, paddingLeft: 52 },
  action: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
});
