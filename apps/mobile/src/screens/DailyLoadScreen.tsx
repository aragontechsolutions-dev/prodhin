import { useState, useMemo } from 'react';
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatCajones, getDisplayName, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { useMyRoute, getTodayDayOfWeek, isSummerSeason } from '../hooks/useMyRoute';
import { useMyDeliveries } from '../hooks/useMyDeliveries';

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
  const { profile } = useAuth();
  const { data: myCustomers } = useMyCustomers(profile?.id);
  const { data: routeData } = useMyRoute(profile?.id);
  const { data: deliveries, isLoading } = useMyDeliveries(profile?.id);

  const [expanded, setExpanded] = useState<string | null>(null);

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

  const totalCajas = suggestions.reduce((s, t) => s + t.suggested, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Carga del día</Text>
        <View style={{ width: 80 }} />
      </View>

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
        <ScrollView contentContainerStyle={styles.content}>
          {/* Resumen */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Sugerencia de carga (con +10% de margen)</Text>
            <Text style={styles.heroTotal}>
              {totalCajas} <Text style={styles.heroUnit}>cajas plásticas</Text>
            </Text>
            <Text style={styles.heroSub}>= {formatCajones(totalCajas)} cajones · {suggestions.length} tipos</Text>
          </View>

          <Text style={styles.note}>
            Basado en {deliveriesUsed} entregas de los últimos 90 días.
            {' '}{withHistory}/{routeCustomers.length} clientes de la ruta tienen historial.
          </Text>

          {suggestions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>Aún no hay historial suficiente</Text>
              <Text style={styles.emptySub}>Registrá entregas y la sugerencia irá mejorando.</Text>
            </View>
          ) : (
            suggestions.map((s) => {
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
                      <Text style={styles.typeSub}>{formatCajones(s.suggested)} cajones · {s.contributors.length} clientes</Text>
                    </View>
                    <Text style={styles.typeQty}>{s.suggested}</Text>
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
  empty: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44 },
  emptyText: { fontSize: 15, color: '#6b7280', fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
});
