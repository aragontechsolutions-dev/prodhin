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
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { type EggType } from '../types';
import { formatCajonesFor, formatMoney, priceUnitLabel } from '../lib/pricing';
import { useAuth } from '../hooks/useAuth';
import { useMyDeliveriesRange, type MyDeliveryRow } from '../hooks/useMyDeliveries';
import { useEggTypes } from '../hooks/useEggTypes';
import DateRangeModal from '../components/DateRangeModal';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DeliveriesHistory'>;

const RANGES = [
  { key: 'hoy', label: 'Hoy', days: 0 },
  { key: '7', label: '7 días', days: 7 },
  { key: '15', label: '15 días', days: 15 },
  { key: '30', label: '30 días', days: 30 },
  { key: '90', label: '90 días', days: 90 },
  { key: 'todas', label: 'Todas', days: -1 },
] as const;

const PAGE_SIZES = [20, 50, 100] as const;

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
function CategoryTile({ index, name, color, cp, isPackaged }: { index: number; name: string; color: EggType['color']; cp: number; isPackaged: boolean }) {
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
      <Text style={styles.catCajones}>{formatCajonesFor(cp, isPackaged)} cajones</Text>
    </Animated.View>
  );
}

function DeliveryDetailModal({ detail: d, onClose }: { detail: MyDeliveryRow | null; onClose: () => void }) {
  const delivered = d?.status === 'entregado';
  return (
    <Modal visible={!!d} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailBg}>
        <View style={styles.detailCard}>
          {d && (
            <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              <Text style={styles.detailName}>{d.customer_name}</Text>
              <Text style={styles.detailDate}>{fmtDateTime(d.delivered_at)}</Text>
              <View style={[styles.statusPill, delivered ? styles.statusOk : styles.statusOther, { alignSelf: 'flex-start' }]}>
                <Text style={[styles.statusText, delivered ? styles.statusTextOk : styles.statusTextOther]}>{STATUS_LABEL[d.status] ?? d.status}</Text>
              </View>
              {delivered && (
                <>
                  <View style={styles.detailRow}><Text style={styles.detailLbl}>Forma de pago</Text><Text style={styles.detailVal}>{d.payment_method === 'credito' ? 'Crédito' : d.payment_method === 'efectivo' ? 'Efectivo' : '—'}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLbl}>Total</Text><Text style={styles.detailVal}>{d.total_amount > 0 ? formatMoney(d.total_amount) : '—'}</Text></View>
                  <Text style={styles.detailSection}>Productos</Text>
                  {d.items.map((it) => (
                    <View key={it.id} style={styles.detailItem}>
                      <View style={[styles.itemDot, { backgroundColor: eggDotColor(it.egg_type_color) }]} />
                      <Text style={styles.detailItemName} numberOfLines={1}>{it.egg_type_name ?? 'Categoría'}</Text>
                      <Text style={styles.detailItemQty}>
                        {it.cajas_plasticas} cp · {formatCajonesFor(it.cajas_plasticas, it.is_packaged)} cj{it.unit_price != null ? ` · ${formatMoney(it.unit_price)}/${priceUnitLabel(it.is_packaged)}` : ''}{it.line_total != null ? ` · ${formatMoney(it.line_total)}` : ''}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.detailRow}><Text style={styles.detailLbl}>Modo</Text><Text style={styles.detailVal}>{d.mode === 'cp' ? 'Deja cajas plásticas' : 'En cartones'}</Text></View>
                  <View style={styles.detailRow}><Text style={styles.detailLbl}>Cajas recogidas</Text><Text style={styles.detailVal}>{d.cajas_recogidas}</Text></View>
                  {d.mode === 'cp' && <View style={styles.detailRow}><Text style={styles.detailLbl}>Devueltas en el acto</Text><Text style={styles.detailVal}>{d.cajas_devueltas}</Text></View>}
                </>
              )}
              {d.notes ? <><Text style={styles.detailSection}>Notas</Text><Text style={styles.detailNotes}>{d.notes}</Text></> : null}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.detailClose} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.detailCloseTxt}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function DeliveriesHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { data: eggTypes } = useEggTypes();

  const [rangeKey, setRangeKey] = useState<string>('hoy');
  const [customRange, setCustomRange] = useState<{ from: number; to: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [eggFilter, setEggFilter] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<MyDeliveryRow | null>(null);

  const rangeDays = RANGES.find((r) => r.key === rangeKey)?.days ?? 0;
  const animKey = customRange ? `c${customRange.from}-${customRange.to}` : rangeKey;

  // Límites del rango (estables por selección) → se filtra en el servidor.
  const { since, until } = useMemo<{ since: number | null; until: number | null }>(() => {
    if (customRange) return { since: customRange.from, until: customRange.to };
    if (rangeDays < 0) return { since: null, until: null }; // "Todas"
    return { since: startOfRange(rangeDays), until: Date.now() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, customRange]);

  const { data: deliveries, isLoading } = useMyDeliveriesRange(profile?.id, since, until);

  // Al cambiar filtros o rango, volver a la primera página.
  useEffect(() => { setPage(1); }, [rangeKey, customRange, query, eggFilter, pageSize]);

  const { view, summary, categorySummary, totalCp, totalCajones } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = (deliveries ?? []).filter((d) => {
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
    let facturado = 0;
    let efectivo = 0;
    let credito = 0;
    const clientes = new Set<string>();
    for (const d of view) {
      cajas += d.total_cajas_plasticas;
      if (d.status === 'entregado') {
        const monto = d.total_amount ?? 0;
        facturado += monto;
        if (d.payment_method === 'credito') credito += monto;
        else if (d.payment_method === 'efectivo') efectivo += monto;
      }
      clientes.add(d.customer_id);
    }
    const summary = { entregas: view.length, clientes: clientes.size, cajas, facturado, efectivo, credito };

    // Resumen por categoría (cp por tipo, sobre base = sin filtro de categoría)
    const cpByType = new Map<string, number>();
    for (const d of base) {
      if (d.status !== 'entregado') continue;
      for (const it of d.items) cpByType.set(it.egg_type_id, (cpByType.get(it.egg_type_id) ?? 0) + it.cajas_plasticas);
    }
    const categorySummary = (eggTypes ?? [])
      .map((t) => ({ id: t.id, name: t.name, color: t.color, cp: cpByType.get(t.id) ?? 0, is_packaged: t.is_packaged }))
      .filter((c) => c.cp > 0);
    const totalCp = categorySummary.reduce((s, c) => s + c.cp, 0);
    const totalCajones = categorySummary.reduce((s, c) => s + c.cp / (c.is_packaged ? 3 : 2), 0);

    return { view, summary, categorySummary, totalCp, totalCajones };
  }, [deliveries, eggTypes, query, eggFilter]);

  const totalPages = Math.max(1, Math.ceil(view.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = view.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalCajonesFmt = Number.isInteger(totalCajones) ? String(totalCajones) : totalCajones.toFixed(1);

  const rangeTitle = customRange
    ? (customRange.to - customRange.from < 24 * 60 * 60 * 1000
        ? fmtDay(customRange.from)
        : `${fmtDay(customRange.from)} – ${fmtDay(customRange.to)}`)
    : (RANGES.find((r) => r.key === rangeKey)?.label ?? 'Hoy');

  function pickRange(key: string) { setRangeKey(key); setCustomRange(null); }

  function renderItem({ item: d }: { item: MyDeliveryRow }) {
    const delivered = d.status === 'entregado';
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setDetail(d)}>
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
            <View style={styles.cardRight}>
              {d.payment_method && (
                <View style={[styles.payPill, d.payment_method === 'credito' ? styles.payCredito : styles.payEfectivo]}>
                  <Text style={[styles.payText, d.payment_method === 'credito' ? styles.payTextCredito : styles.payTextEfectivo]}>
                    {d.payment_method === 'credito' ? 'Crédito' : 'Efectivo'}
                  </Text>
                </View>
              )}
              <Text style={styles.cardTotal}>{d.total_amount > 0 ? formatMoney(d.total_amount) : `${d.total_cajas_plasticas} cp`}</Text>
            </View>
          )}
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
        <Text style={styles.verDetalle}>Ver detalle ›</Text>
      </TouchableOpacity>
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
              <Text style={styles.catTotalVal}>{totalCp} cp · {totalCajonesFmt} cajones</Text>
            </View>
            <Text style={styles.catNote}>Solo se muestran las categorías que tuvieron entregas.</Text>
            <View style={styles.catGrid} key={animKey}>
              {categorySummary.map((c, i) => (
                <CategoryTile key={c.id} index={i} name={c.name} color={c.color} cp={c.cp} isPackaged={c.is_packaged} />
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
        <View style={styles.summaryItem}><Text style={styles.summaryNum}>{formatMoney(summary.facturado)}</Text><Text style={styles.summaryLbl}>facturado</Text></View>
      </View>

      {/* Desglose efectivo / crédito */}
      <View style={styles.payBreakdown}>
        <View style={[styles.payBox, styles.payBoxEfectivo]}>
          <Text style={styles.payBoxLbl}>💵 Efectivo</Text>
          <Text style={[styles.payBoxVal, { color: '#166534' }]}>{formatMoney(summary.efectivo)}</Text>
        </View>
        <View style={[styles.payBox, styles.payBoxCredito]}>
          <Text style={styles.payBoxLbl}>💳 Crédito</Text>
          <Text style={[styles.payBoxVal, { color: '#92400e' }]}>{formatMoney(summary.credito)}</Text>
        </View>
      </View>
    </View>
  );

  const ListFooter = view.length > 0 ? (
    <View style={styles.pager}>
      <View style={styles.pagerSizes}>
        <Text style={styles.pagerLbl}>Por página:</Text>
        {PAGE_SIZES.map((s) => (
          <TouchableOpacity key={s} style={[styles.pagerChip, pageSize === s && styles.pagerChipOn]} onPress={() => setPageSize(s)}>
            <Text style={[styles.pagerChipTxt, pageSize === s && styles.pagerChipTxtOn]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.pagerNav}>
        <TouchableOpacity style={[styles.pagerBtn, safePage <= 1 && styles.pagerBtnOff]} disabled={safePage <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
          <Text style={styles.pagerBtnTxt}>‹ Anterior</Text>
        </TouchableOpacity>
        <Text style={styles.pagerInfo}>Pág. {safePage}/{totalPages} · {view.length} reg.</Text>
        <TouchableOpacity style={[styles.pagerBtn, safePage >= totalPages && styles.pagerBtnOff]} disabled={safePage >= totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))}>
          <Text style={styles.pagerBtnTxt}>Siguiente ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
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
          data={pageItems}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>Sin entregas para este filtro</Text>
            </View>
          }
        />
      )}

      <DeliveryDetailModal detail={detail} onClose={() => setDetail(null)} />

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
  payBreakdown: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8 },
  payBox: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  payBoxEfectivo: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  payBoxCredito: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  payBoxLbl: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  payBoxVal: { fontSize: 18, fontWeight: '800', marginTop: 2 },
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
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  payEfectivo: { backgroundColor: '#dcfce7' },
  payCredito: { backgroundColor: '#fef3c7' },
  payText: { fontSize: 11, fontWeight: '700' },
  payTextEfectivo: { color: '#166534' },
  payTextCredito: { color: '#92400e' },
  cardTotal: { fontSize: 14, fontWeight: '800', color: '#111827' },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f9fafb', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  itemDot: { width: 8, height: 8, borderRadius: 4 },
  itemText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  verDetalle: { fontSize: 12, color: '#1d4ed8', fontWeight: '700', marginTop: 4 },
  pager: { marginTop: 10, gap: 10 },
  pagerSizes: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pagerLbl: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  pagerChip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pagerChipOn: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  pagerChipTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
  pagerChipTxtOn: { color: '#fff' },
  pagerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pagerBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
  pagerBtnOff: { opacity: 0.4 },
  pagerBtnTxt: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  pagerInfo: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  detailBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  detailName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  detailDate: { fontSize: 13, color: '#9ca3af' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLbl: { fontSize: 13, color: '#6b7280' },
  detailVal: { fontSize: 14, fontWeight: '700', color: '#111827' },
  detailSection: { fontSize: 12, fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailItemName: { fontSize: 13, fontWeight: '700', color: '#374151', width: 96 },
  detailItemQty: { flex: 1, fontSize: 12, color: '#6b7280', textAlign: 'right' },
  detailNotes: { fontSize: 13, color: '#374151' },
  detailClose: { marginTop: 12, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  detailCloseTxt: { color: '#374151', fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
