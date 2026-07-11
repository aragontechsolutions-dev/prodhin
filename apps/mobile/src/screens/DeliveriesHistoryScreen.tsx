import { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatCajones, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useMyDeliveries, type MyDeliveryRow } from '../hooks/useMyDeliveries';
import { useEggTypes } from '../hooks/useEggTypes';
import DateRangeModal from '../components/DateRangeModal';

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
  if (days === 0) return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
  );
}

function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
}

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

/* Tarjeta de categoría con animación de entrada escalonada */
function CategoryTile({ index, name, color, cp }: { index: number; name: string; color: EggType['color']; cp: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay: index * 55, useNativeDriver: true }).start();
  }, [anim, index]);
  return (
    <Animated.View style={[
      styles.catTile,
      cp > 0 && styles.catTileActive,
      { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
    ]}>
      <View style={styles.catHead}>
        <View style={[styles.catIcon, { backgroundColor: eggDotColor(color) }]}>
          <Text style={styles.catEmoji}>🥚</Text>
        </View>
        <Text style={styles.catName} numberOfLines={2}>{name}</Text>
      </View>
      <Text style={styles.catCp}>{cp} <Text style={styles.catCpUnit}>cp</Text></Text>
      <Text style={styles.catCajones}>{formatCajones(cp)} cajones</Text>
    </Animated.View>
  );
}

export default function DeliveriesHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { data: deliveries, isLoading } = useMyDeliveries(profile?.id);
  const { data: eggTypes } = useEggTypes();

  const [rangeKey, setRangeKey] = useState<string>('hoy');
  const [customRange, setCustomRange] = useState<{ from: number; to: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [eggFilter, setEggFilter] = useState<string | null>(null);

  const rangeDays = RANGES.find((r) => r.key === rangeKey)?.days ?? 0;
  const animKey = customRange ? `c${customRange.from}-${customRange.to}` : rangeKey;

  // base = rango + búsqueda (sin filtro de categoría) → alimenta el resumen por categoría
  const { view, summary, categorySummary, totalCp } = useMemo(() => {
    const since = customRange ? customRange.from : startOfRange(rangeDays);
    const until = customRange ? customRange.to : Date.now();
    const q = query.trim().toLowerCase();

    const base = (deliveries ?? []).filter((d) => {
      const t = new Date(d.delivered_at).getTime();
      if (t < since || t > until) return false;
      if (q) {
        const name = d.customer_name.toLowerCase();
        const rut = (d.customer_tax_id ?? '').toLowerCase();
        if (!name.includes(q) && !rut.includes(q)) return false;
      }
      return true;
    });

    // Lista visible (aplica filtro de categoría, recortando ítems)
    let view: MyDeliveryRow[] = base.filter((d) => !eggFilter || d.items.some((it) => it.egg_type_id === eggFilter));
    if (eggFilter) {
      view = view.map((d) => {
        const items = d.items.filter((it) => it.egg_type_id === eggFilter);
        return { ...d, items, total_cajas_plasticas: items.reduce((s, it) => s + it.cajas_plasticas, 0) };
      });
    }

    // Métricas generales (según lo visible)
    let cajas = 0;
    const clientes = new Set<string>();
    for (const d of view) { cajas += d.total_cajas_plasticas; clientes.add(d.customer_id); }
    const summary = { entregas: view.length, clientes: clientes.size, cajas };

    // Resumen por categoría existente (cp por tipo, sobre base)
    const cpByType = new Map<string, number>();
    for (const d of base) {
      if (d.status !== 'entregado') continue;
      for (const it of d.items) cpByType.set(it.egg_type_id, (cpByType.get(it.egg_type_id) ?? 0) + it.cajas_plasticas);
    }
    // Solo las categorías que tuvieron entregas en el período
    const categorySummary = (eggTypes ?? [])
      .map((t) => ({ id: t.id, name: t.name, color: t.color, cp: cpByType.get(t.id) ?? 0 }))
      .filter((c) => c.cp > 0);
    const totalCp = categorySummary.reduce((s, c) => s + c.cp, 0);

    return { view, summary, categorySummary, totalCp };
  }, [deliveries, eggTypes, rangeDays, customRange, query, eggFilter]);

  const rangeTitle = customRange
    ? (customRange.to - customRange.from < 24 * 60 * 60 * 1000
        ? fmtDay(customRange.from)
        : `${fmtDay(customRange.from)} – ${fmtDay(customRange.to)}`)
    : (RANGES.find((r) => r.key === rangeKey)?.label ?? 'Hoy');

  function pickRange(key: string) { setRangeKey(key); setCustomRange(null); }

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
          {delivered && <Text style={styles.cardTotal}>{formatCajones(d.total_cajas_plasticas)} cajones</Text>}
        </View>
        {delivered && d.items.length > 0 && (
          <View style={styles.itemsRow}>
            {d.items.map((it) => (
              <View key={it.id} style={styles.itemChip}>
                <View style={[styles.itemDot, { backgroundColor: eggDotColor(it.egg_type_color) }]} />
                <Text style={styles.itemText}>{it.egg_type_name ?? '¿?'} · {it.cajas_plasticas} cp</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  const ListHeader = (
    <View>
      {/* Resumen por categoría (animado) */}
      <View style={styles.catSection}>
        <Text style={styles.catSectionTitle}>Resumen · {rangeTitle}</Text>
        {categorySummary.length > 0 ? (
          <>
            <View style={styles.catTotalRow}>
              <Text style={styles.catTotalLbl}>Total entregado</Text>
              <Text style={styles.catTotalVal}>{totalCp} cp · {formatCajones(totalCp)} cajones</Text>
            </View>
            <Text style={styles.catNote}>Solo se muestran las categorías que tuvieron entregas.</Text>
            <View style={styles.catGrid} key={animKey}>
              {categorySummary.map((c, i) => (
                <CategoryTile key={c.id} index={i} name={c.name} color={c.color} cp={c.cp} />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.catEmpty}>Sin entregas en el período seleccionado</Text>
        )}
      </View>

      {/* Rango de fechas */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangeChip, !customRange && rangeKey === r.key && styles.rangeChipActive]}
            onPress={() => pickRange(r.key)}
          >
            <Text style={[styles.rangeText, !customRange && rangeKey === r.key && styles.rangeTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.rangeChip, customRange && styles.rangeChipActive]}
          onPress={() => setPickerOpen(true)}
        >
          <Text style={[styles.rangeText, customRange && styles.rangeTextActive]}>
            📅 {customRange ? rangeTitle : 'Fechas'}
          </Text>
        </TouchableOpacity>
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

      {/* Métricas generales */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{summary.entregas}</Text><Text style={styles.summaryLbl}>entregas</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{summary.clientes}</Text><Text style={styles.summaryLbl}>clientes</Text></View>
        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{formatCajones(summary.cajas)}</Text><Text style={styles.summaryLbl}>cajones</Text></View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Mis entregas</Text>
        <View style={{ width: 80 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#f59e0b" size="large" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={view}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
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

      <DateRangeModal
        visible={pickerOpen}
        initialFrom={customRange?.from ?? null}
        initialTo={customRange ? customRange.to : null}
        onClose={() => setPickerOpen(false)}
        onApply={(from, to) => { setCustomRange({ from, to }); setPickerOpen(false); }}
      />
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

  catSection: { paddingHorizontal: 16, paddingTop: 14 },
  catSectionTitle: { fontSize: 13, fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  catTotalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1d4ed8', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  catTotalLbl: { color: '#bfdbfe', fontSize: 13, fontWeight: '600' },
  catTotalVal: { color: '#fff', fontSize: 15, fontWeight: '800' },
  catNote: { fontSize: 12, color: '#9ca3af', marginTop: 8, marginBottom: 4 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catTile: {
    width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  catTileActive: { borderColor: '#dbeafe', backgroundColor: '#fbfdff' },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 34 },
  catIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catEmoji: { fontSize: 15 },
  catName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#374151' },
  catCp: { fontSize: 24, fontWeight: '800', color: '#111827' },
  catCpUnit: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  catCajones: { fontSize: 12, fontWeight: '600', color: '#059669', marginTop: 1 },
  catEmpty: { fontSize: 13, color: '#9ca3af', paddingVertical: 8 },

  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 14 },
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
  listContent: { padding: 16, paddingTop: 0, gap: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6', gap: 8, marginTop: 8 },
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
  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
