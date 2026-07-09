import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatCajones, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useMyDeliveries, type MyDeliveryRow } from '../hooks/useMyDeliveries';
import { useEggTypes } from '../hooks/useEggTypes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DeliveriesHistory'>;

const RANGES = [
  { key: 'hoy', label: 'Hoy', days: 0 },
  { key: '7', label: '7 días', days: 7 },
  { key: '15', label: '15 días', days: 15 },
  { key: '30', label: '30 días', days: 30 },
  { key: '90', label: '90 días', days: 90 },
] as const;

const STATUS_LABEL: Record<string, string> = {
  entregado: 'Entregado',
  cliente_ausente: 'Ausente',
  rechazado: 'No quiso',
  sin_stock: 'Sin stock',
};

function startOfRange(days: number): number {
  const now = new Date();
  if (days === 0) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
  );
}

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

export default function DeliveriesHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { data: deliveries, isLoading } = useMyDeliveries(profile?.id);
  const { data: eggTypes } = useEggTypes();

  const [rangeKey, setRangeKey] = useState<string>('hoy');
  const [query, setQuery] = useState('');
  const [eggFilter, setEggFilter] = useState<string | null>(null);

  const rangeDays = RANGES.find((r) => r.key === rangeKey)?.days ?? 0;

  const filtered = useMemo(() => {
    const since = startOfRange(rangeDays);
    const q = query.trim().toLowerCase();
    return (deliveries ?? []).filter((d) => {
      if (new Date(d.delivered_at).getTime() < since) return false;
      if (eggFilter && !d.items.some((it) => it.egg_type_id === eggFilter)) return false;
      if (q) {
        const name = d.customer_name.toLowerCase();
        const rut = (d.customer_tax_id ?? '').toLowerCase();
        if (!name.includes(q) && !rut.includes(q)) return false;
      }
      return true;
    });
  }, [deliveries, rangeDays, query, eggFilter]);

  const summary = useMemo(() => {
    let cajas = 0;
    const clientes = new Set<string>();
    for (const d of filtered) {
      cajas += d.total_cajas_plasticas;
      clientes.add(d.customer_id);
    }
    return { entregas: filtered.length, clientes: clientes.size, cajas };
  }, [filtered]);

  function renderItem({ item: d }: { item: MyDeliveryRow }) {
    const delivered = d.status === 'entregado';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.custName} numberOfLines={1}>{d.customer_name}</Text>
          <Text style={styles.dateText}>{fmtDateTime(d.delivered_at)}</Text>
        </View>
        <View style={styles.cardMid}>
          <View style={[styles.statusPill, delivered ? styles.statusOk : styles.statusOther]}>
            <Text style={[styles.statusText, delivered ? styles.statusTextOk : styles.statusTextOther]}>
              {STATUS_LABEL[d.status] ?? d.status}
            </Text>
          </View>
          {delivered && (
            <Text style={styles.cardTotal}>{formatCajones(d.total_cajas_plasticas)} cajones</Text>
          )}
        </View>
        {delivered && d.items.length > 0 && (
          <View style={styles.itemsRow}>
            {d.items.map((it) => (
              <View key={it.id} style={styles.itemChip}>
                <View style={[styles.itemDot, { backgroundColor: eggDotColor(it.egg_type_color) }]} />
                <Text style={styles.itemText}>
                  {it.egg_type_name ?? '¿?'} · {it.cajas_plasticas} cp
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Mis entregas</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Rango de fechas */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangeChip, rangeKey === r.key && styles.rangeChipActive]}
            onPress={() => setRangeKey(r.key)}
          >
            <Text style={[styles.rangeText, rangeKey === r.key && styles.rangeTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Buscador */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar cliente o RUT…"
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtro por tipo */}
      <View style={styles.eggFilterRow}>
        <TouchableOpacity
          style={[styles.eggFilterChip, !eggFilter && styles.eggFilterChipActive]}
          onPress={() => setEggFilter(null)}
        >
          <Text style={[styles.eggFilterText, !eggFilter && styles.eggFilterTextActive]}>Todos</Text>
        </TouchableOpacity>
        {(eggTypes ?? []).map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.eggFilterChip, eggFilter === t.id && styles.eggFilterChipActive]}
            onPress={() => setEggFilter(eggFilter === t.id ? null : t.id)}
          >
            <Text style={[styles.eggFilterText, eggFilter === t.id && styles.eggFilterTextActive]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Resumen */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{summary.entregas}</Text><Text style={styles.summaryLbl}>entregas</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{summary.clientes}</Text><Text style={styles.summaryLbl}>clientes</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{formatCajones(summary.cajas)}</Text><Text style={styles.summaryLbl}>cajones</Text></View>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#f59e0b" size="large" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>Sin entregas para este filtro</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 14, color: '#92400e', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginHorizontal: 8 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  rangeChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  rangeChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  rangeText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  rangeTextActive: { color: '#fff' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e7eb', height: 44,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  clearIcon: { fontSize: 14, color: '#9ca3af', paddingHorizontal: 4 },
  eggFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  eggFilterChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  eggFilterChipActive: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  eggFilterText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  eggFilterTextActive: { color: '#1d4ed8' },
  summary: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', paddingVertical: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryLbl: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  listContent: { padding: 16, gap: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  custName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  dateText: { fontSize: 12, color: '#9ca3af' },
  cardMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  statusOk: { backgroundColor: '#dcfce7' },
  statusOther: { backgroundColor: '#f3f4f6' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextOk: { color: '#166534' },
  statusTextOther: { color: '#6b7280' },
  cardTotal: { fontSize: 14, fontWeight: '800', color: '#111827' },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f9fafb', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  itemDot: { width: 8, height: 8, borderRadius: 4 },
  itemText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  empty: { alignItems: 'center', marginTop: 50, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
