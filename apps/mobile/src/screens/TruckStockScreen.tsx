import { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatCajones, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useEggTypes } from '../hooks/useEggTypes';
import { useMyDeliveries } from '../hooks/useMyDeliveries';
import { useTruckLoads, useTruckCounts } from '../hooks/useTruckStock';
import { computeStock } from '../lib/truck';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TruckStock'>;

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

export default function TruckStockScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: eggTypes, isLoading: loadingTypes } = useEggTypes();
  const { data: counts } = useTruckCounts(profile?.id);
  const { data: loads } = useTruckLoads(profile?.id);
  const { data: deliveries } = useMyDeliveries(profile?.id);

  const stock = useMemo(
    () => computeStock(counts ?? [], loads ?? [], deliveries ?? []),
    [counts, loads, deliveries],
  );

  const totalStock = useMemo(() => {
    let t = 0;
    for (const v of stock.values()) t += v;
    return t;
  }, [stock]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Stock del camión</Text>
        <View style={{ width: 80 }} />
      </View>

      {loadingTypes ? (
        <ActivityIndicator color="#f59e0b" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>Sin conexión — mostrando últimos datos guardados</Text>
            </View>
          )}

          {/* Total */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>En el camión ahora</Text>
            <Text style={styles.heroTotal}>{totalStock} <Text style={styles.heroUnit}>cp</Text></Text>
            <Text style={styles.heroSub}>= {formatCajones(totalStock)} cajones</Text>
          </View>

          {/* Lista por tipo */}
          {(eggTypes ?? []).map((t) => {
            const cur = stock.get(t.id) ?? 0;
            return (
              <View key={t.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: eggDotColor(t.color) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.sub}>{formatCajones(cur)} cajones</Text>
                </View>
                <Text style={styles.stockNum}>{cur} <Text style={styles.stockUnit}>cp</Text></Text>
              </View>
            );
          })}

          <Text style={styles.footnote}>
            El stock se calcula solo: último recuento + cargas − entregas. Las cargas y los recuentos
            los registra el administrador desde la web; las entregas descuentan solas.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#fffbeb',
    borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 14, color: '#92400e', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginHorizontal: 8 },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  offlineBanner: { backgroundColor: '#fef3c7', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#fde68a' },
  offlineText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  hero: { backgroundColor: '#0f766e', borderRadius: 16, padding: 18 },
  heroLabel: { color: '#99f6e4', fontSize: 12, fontWeight: '600' },
  heroTotal: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
  heroUnit: { fontSize: 16, fontWeight: '700', color: '#ccfbf1' },
  heroSub: { color: '#ccfbf1', fontSize: 13, fontWeight: '600', marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  stockNum: { fontSize: 20, fontWeight: '800', color: '#0f766e' },
  stockUnit: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  footnote: { fontSize: 11, color: '#9ca3af', marginTop: 10, lineHeight: 16 },
});
