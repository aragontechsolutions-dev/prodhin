import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatCajones, getDisplayName, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { useMyRoute, getTodayDayOfWeek, isSummerSeason } from '../hooks/useMyRoute';
import { useMyDeliveries } from '../hooks/useMyDeliveries';
import { useTruckLoads, useTruckCounts } from '../hooks/useTruckStock';
import { useEggTypes } from '../hooks/useEggTypes';
import { useTruckLoadConfirmations, useConfirmLoad } from '../hooks/useTruckLoadConfirmations';
import { getPendingLoad } from '../lib/loadConfirm';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { uuidv4 } from '../lib/uuid';
import { computeStock } from '../lib/truck';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DailyLoad'>;

const MARGIN = 1.1; // +10% de seguridad

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

interface Contributor {
  customerId: string;
  name: string;
  expected: number; // cajas plásticas esperadas
}

interface TypeSuggestion {
  eggTypeId: string;
  name: string;
  color: EggType['color'];
  suggested: number;      // cajas plásticas (con margen, redondeado hacia arriba)
  rawExpected: number;    // esperado sin margen
  contributors: Contributor[];
}

export default function DailyLoadScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { data: myCustomers } = useMyCustomers(profile?.id);
  const { data: routeData } = useMyRoute(profile?.id);
  const { data: deliveries, isLoading } = useMyDeliveries(profile?.id);
  const { data: truckCounts } = useTruckCounts(profile?.id);
  const { data: truckLoads } = useTruckLoads(profile?.id);
  const { data: eggTypes } = useEggTypes();
  const { data: confirmations } = useTruckLoadConfirmations(profile?.id);
  const { isOnline } = useNetworkStatus();
  const confirmLoadMut = useConfirmLoad();

  const [expanded, setExpanded] = useState<string | null>(null);

  // Carga asignada pendiente de confirmar
  const pendingLoad = useMemo(
    () => getPendingLoad(truckLoads ?? [], confirmations ?? [], Date.now()),
    [truckLoads, confirmations],
  );
  const [confirmedNow, setConfirmedNow] = useState(false);
  const [discrepancyMode, setDiscrepancyMode] = useState(false);
  const [actualById, setActualById] = useState<Record<string, string>>({});
  const [discNote, setDiscNote] = useState('');

  const eggName = useMemo(() => {
    const m = new Map<string, string>();
    (eggTypes ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [eggTypes]);

  function doConfirm(hasDiscrepancy: boolean) {
    if (!profile || !pendingLoad) return;
    const assigned: Record<string, number> = {};
    pendingLoad.items.forEach((it) => { assigned[it.egg_type_id] = it.cajas_plasticas; });
    let details: Record<string, unknown> = { assigned };
    let note: string | null = null;
    if (hasDiscrepancy) {
      const actual: Record<string, number> = {};
      pendingLoad.items.forEach((it) => {
        const raw = actualById[it.egg_type_id];
        actual[it.egg_type_id] = raw !== undefined && raw !== '' ? parseInt(raw, 10) || 0 : it.cajas_plasticas;
      });
      details = { assigned, actual };
      note = discNote.trim() || null;
    }
    confirmLoadMut.mutate(
      {
        id: uuidv4(),
        driver_id: profile.id,
        load_created_at: pendingLoad.loadCreatedAt,
        has_discrepancy: hasDiscrepancy,
        note,
        details,
      },
      {
        onError: (e: unknown) => {
          if (isOnline) Alert.alert('Error', (e instanceof Error ? e.message : null) ?? 'No se pudo confirmar la carga.');
        },
      },
    );
    setConfirmedNow(true);
    setDiscrepancyMode(false);
  }

  const stock = useMemo(
    () => computeStock(truckCounts ?? [], truckLoads ?? [], deliveries ?? []),
    [truckCounts, truckLoads, deliveries],
  );

  const allCustomers = useMemo(
    () => [...(myCustomers?.own ?? []), ...(myCustomers?.delegated ?? [])],
    [myCustomers],
  );

  const todayDow = getTodayDayOfWeek();
  const summer = isSummerSeason();
  const hasRouteToday = todayDow >= 1 && (summer ? todayDow <= 6 : todayDow <= 5);

  const routeCustomers = useMemo(() => {
    const stops = routeData?.stops ?? [];
    if (!hasRouteToday) return [];
    const ids = new Set(stops.filter((s) => s.day_of_week === todayDow).map((s) => s.customer_id));
    return allCustomers.filter((c) => ids.has(c.id));
  }, [routeData, allCustomers, hasRouteToday, todayDow]);

  // Predicción por promedio ponderado por frecuencia
  const { suggestions, deliveriesUsed, withHistory } = useMemo(() => {
    const delivered = (deliveries ?? []).filter((d) => d.status === 'entregado');

    // customer_id -> { visits, perType: Map<typeId, {name,color,qtySum,count}> }
    const byCustomer = new Map<string, {
      visits: number;
      perType: Map<string, { name: string; color: EggType['color']; qtySum: number; count: number }>;
    }>();

    for (const d of delivered) {
      const entry = byCustomer.get(d.customer_id) ?? { visits: 0, perType: new Map() };
      entry.visits += 1;
      for (const it of d.items) {
        if (it.cajas_plasticas <= 0) continue;
        const t = entry.perType.get(it.egg_type_id) ?? {
          name: it.egg_type_name ?? '¿?',
          color: it.egg_type_color,
          qtySum: 0,
          count: 0,
        };
        t.qtySum += it.cajas_plasticas;
        t.count += 1;
        entry.perType.set(it.egg_type_id, t);
      }
      byCustomer.set(d.customer_id, entry);
    }

    // Acumular esperado por tipo sobre la ruta de hoy
    const perType = new Map<string, TypeSuggestion>();
    const customersWithHistory = new Set<string>();

    for (const c of routeCustomers) {
      const hist = byCustomer.get(c.id);
      if (!hist || hist.visits === 0) continue;
      customersWithHistory.add(c.id);
      for (const [typeId, t] of hist.perType) {
        const freq = t.count / hist.visits;      // qué tan seguido compra ese tipo
        const typicalQty = t.qtySum / t.count;   // cantidad típica cuando compra
        const expected = typicalQty * freq;      // valor esperado
        const agg = perType.get(typeId) ?? {
          eggTypeId: typeId,
          name: t.name,
          color: t.color,
          suggested: 0,
          rawExpected: 0,
          contributors: [],
        };
        agg.rawExpected += expected;
        agg.contributors.push({ customerId: c.id, name: getDisplayName(c), expected });
        perType.set(typeId, agg);
      }
    }

    const list = [...perType.values()]
      .map((s) => ({
        ...s,
        suggested: Math.ceil(s.rawExpected * MARGIN),
        contributors: s.contributors.sort((a, b) => b.expected - a.expected),
      }))
      .filter((s) => s.suggested > 0)
      .sort((a, b) => b.suggested - a.suggested);

    return { suggestions: list, deliveriesUsed: delivered.length, withHistory: customersWithHistory.size };
  }, [deliveries, routeCustomers]);

  // Descontar lo que ya está en el camión: A cargar = máx(0, demanda − stock)
  const rows = useMemo(
    () => suggestions.map((s) => {
      const inTruck = stock.get(s.eggTypeId) ?? 0;
      return { ...s, inTruck, toLoad: Math.max(0, s.suggested - inTruck) };
    }),
    [suggestions, stock],
  );

  const totalToLoad = rows.reduce((s, t) => s + t.toLoad, 0);
  const totalDemand = rows.reduce((s, t) => s + t.suggested, 0);
  const totalInTruck = useMemo(() => { let t = 0; for (const v of stock.values()) t += v; return t; }, [stock]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Carga del día</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Confirmación de la carga asignada por el administrador */}
      {pendingLoad && !confirmedNow ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>🚚 Carga asignada — confirmá</Text>
          <Text style={styles.confirmSub}>
            El administrador cargó el camión. Revisá y confirmá antes de salir a repartir.
          </Text>
          {pendingLoad.items.map((it) => (
            <View key={it.egg_type_id} style={styles.confirmRow}>
              <Text style={styles.confirmName} numberOfLines={1}>{eggName.get(it.egg_type_id) ?? 'Tipo'}</Text>
              {discrepancyMode ? (
                <View style={styles.confirmEditRow}>
                  <Text style={styles.confirmAssigned}>asignado {it.cajas_plasticas}</Text>
                  <TextInput
                    style={styles.confirmInput}
                    keyboardType="number-pad"
                    maxLength={5}
                    defaultValue={String(it.cajas_plasticas)}
                    onChangeText={(t) => setActualById((m) => ({ ...m, [it.egg_type_id]: t.replace(/[^0-9]/g, '') }))}
                    selectTextOnFocus
                  />
                </View>
              ) : (
                <Text style={styles.confirmQty}>{it.cajas_plasticas} cp</Text>
              )}
            </View>
          ))}
          {discrepancyMode && (
            <TextInput
              style={styles.confirmNote}
              placeholder="Nota: qué diferencia notaste…"
              placeholderTextColor="#9ca3af"
              value={discNote}
              onChangeText={setDiscNote}
              multiline
            />
          )}
          {!discrepancyMode ? (
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmOk]} onPress={() => doConfirm(false)} activeOpacity={0.85}>
                <Text style={styles.confirmOkText}>✅ Todo correcto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmDiff]} onPress={() => setDiscrepancyMode(true)} activeOpacity={0.85}>
                <Text style={styles.confirmDiffText}>✏️ Hay diferencias</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmCancel]} onPress={() => setDiscrepancyMode(false)} activeOpacity={0.85}>
                <Text style={styles.confirmCancelText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, styles.confirmOk]} onPress={() => doConfirm(true)} activeOpacity={0.85}>
                <Text style={styles.confirmOkText}>Confirmar diferencias</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : confirmedNow ? (
        <View style={styles.confirmedBanner}>
          <Text style={styles.confirmedText}>✅ Carga confirmada. Ya podés registrar entregas.</Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color="#f59e0b" size="large" style={{ marginTop: 40 }} />
      ) : !hasRouteToday ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>😴</Text>
          <Text style={styles.emptyText}>Hoy no hay ruta configurada</Text>
        </View>
      ) : routeCustomers.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyText}>No hay clientes en la ruta de hoy</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          {/* Resumen */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>A cargar hoy (demanda − lo que hay en el camión)</Text>
            <Text style={styles.heroTotal}>
              {totalToLoad} <Text style={styles.heroUnit}>cajas plásticas</Text>
            </Text>
            <Text style={styles.heroSub}>= {formatCajones(totalToLoad)} cajones</Text>
            <View style={styles.heroBreak}>
              <Text style={styles.heroBreakItem}>Demanda: {totalDemand} cp</Text>
              <Text style={styles.heroBreakItem}>En camión: {totalInTruck} cp</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.stockLink} onPress={() => navigation.navigate('TruckStock')} activeOpacity={0.8}>
            <Text style={styles.stockLinkText}>🚚 Ver / actualizar stock del camión</Text>
            <Text style={styles.stockLinkArrow}>›</Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            Basado en {deliveriesUsed} entregas de los últimos 90 días.
            {' '}{withHistory}/{routeCustomers.length} clientes de la ruta tienen historial.
          </Text>

          {rows.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>Aún no hay historial suficiente</Text>
              <Text style={styles.emptySub}>Registrá entregas y la sugerencia irá mejorando.</Text>
            </View>
          ) : (
            rows.map((s) => {
              const open = expanded === s.eggTypeId;
              return (
                <View key={s.eggTypeId} style={styles.typeCard}>
                  <TouchableOpacity
                    style={styles.typeHead}
                    onPress={() => setExpanded(open ? null : s.eggTypeId)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.typeDot, { backgroundColor: eggDotColor(s.color) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeName}>{s.name}</Text>
                      <Text style={styles.typeSub}>
                        demanda {s.suggested} · en camión {s.inTruck} cp
                      </Text>
                    </View>
                    <View style={styles.toLoadBox}>
                      <Text style={[styles.typeQty, s.toLoad === 0 && styles.typeQtyDone]}>{s.toLoad}</Text>
                      <Text style={styles.toLoadLbl}>a cargar</Text>
                    </View>
                    <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
                  </TouchableOpacity>
                  {open && (
                    <View style={styles.breakdown}>
                      {s.contributors.map((ct) => (
                        <View key={ct.customerId} style={styles.brRow}>
                          <Text style={styles.brName} numberOfLines={1}>{ct.name}</Text>
                          <Text style={styles.brQty}>~{ct.expected.toFixed(1)} cp</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
          <Text style={styles.footnote}>
            "cp" = cajas plásticas. La sugerencia es una estimación: ajustá según tu criterio.
          </Text>
        </ScrollView>
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
    height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#fffbeb',
    borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 14, color: '#92400e', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginHorizontal: 8 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  hero: { backgroundColor: '#1d4ed8', borderRadius: 16, padding: 18 },
  heroLabel: { color: '#bfdbfe', fontSize: 12, fontWeight: '600' },
  heroTotal: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
  heroUnit: { fontSize: 16, fontWeight: '700', color: '#dbeafe' },
  heroSub: { color: '#dbeafe', fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroBreak: { flexDirection: 'row', gap: 14, marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 8 },
  heroBreakItem: { color: '#dbeafe', fontSize: 12, fontWeight: '600' },
  toLoadBox: { alignItems: 'flex-end', minWidth: 52 },
  toLoadLbl: { fontSize: 9, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase' },
  typeQtyDone: { color: '#16a34a' },
  stockLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#99f6e4',
    paddingVertical: 12, paddingHorizontal: 14,
  },
  stockLinkText: { fontSize: 14, fontWeight: '700', color: '#0f766e' },
  stockLinkArrow: { fontSize: 20, color: '#0f766e', fontWeight: '300' },
  note: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
  typeCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', overflow: 'hidden' },
  typeHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  typeDot: { width: 12, height: 12, borderRadius: 6 },
  typeName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  typeSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  typeQty: { fontSize: 22, fontWeight: '800', color: '#1d4ed8', minWidth: 40, textAlign: 'right' },
  chevron: { fontSize: 14, color: '#9ca3af', width: 16, textAlign: 'center' },
  breakdown: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 6 },
  brRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  brName: { flex: 1, fontSize: 13, color: '#374151' },
  brQty: { fontSize: 13, fontWeight: '700', color: '#059669' },
  footnote: { fontSize: 11, color: '#9ca3af', marginTop: 8, lineHeight: 16 },
  confirmCard: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fbbf24', borderRadius: 14,
    padding: 16, margin: 16, marginBottom: 0, gap: 6,
  },
  confirmTitle: { fontSize: 16, fontWeight: '800', color: '#92400e' },
  confirmSub: { fontSize: 12, color: '#b45309', marginBottom: 6, lineHeight: 17 },
  confirmRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#fde68a',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  confirmName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  confirmQty: { fontSize: 15, fontWeight: '800', color: '#0f766e' },
  confirmEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmAssigned: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  confirmInput: {
    width: 64, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb', textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#111827', padding: 0,
  },
  confirmNote: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#fde68a',
    padding: 10, minHeight: 54, fontSize: 13, color: '#111827', textAlignVertical: 'top', marginTop: 2,
  },
  confirmBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  confirmOk: { backgroundColor: '#16a34a' },
  confirmOkText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  confirmDiff: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fbbf24' },
  confirmDiffText: { color: '#92400e', fontSize: 14, fontWeight: '700' },
  confirmCancel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  confirmCancelText: { color: '#6b7280', fontSize: 14, fontWeight: '700' },
  confirmedBanner: {
    backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', borderRadius: 12,
    padding: 12, margin: 16, marginBottom: 0,
  },
  confirmedText: { color: '#15803d', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  empty: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44 },
  emptyText: { fontSize: 15, color: '#6b7280', fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
});
