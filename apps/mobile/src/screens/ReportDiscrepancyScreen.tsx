import { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Modal, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useEggTypes } from '../hooks/useEggTypes';
import { useTruckLoads, useTruckCounts } from '../hooks/useTruckStock';
import { useMyDeliveries } from '../hooks/useMyDeliveries';
import { useReportDiscrepancy } from '../hooks/useReportDiscrepancy';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { computeStock, extractoFor } from '../lib/truck';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

export default function ReportDiscrepancyScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: eggTypes, isLoading } = useEggTypes();
  const { data: truckCounts } = useTruckCounts(profile?.id);
  const { data: truckLoads } = useTruckLoads(profile?.id);
  const { data: myDeliveries } = useMyDeliveries(profile?.id);
  const report = useReportDiscrepancy();

  const [reals, setReals] = useState<Record<string, string>>({});
  const [extractoType, setExtractoType] = useState<string | null>(null);

  const stock = useMemo(
    () => computeStock(truckCounts ?? [], truckLoads ?? [], myDeliveries ?? []),
    [truckCounts, truckLoads, myDeliveries],
  );

  // Tipos a mostrar: los que tienen stock o movimiento (para no listar vacíos).
  const rows = useMemo(() => {
    const withMovement = new Set<string>();
    for (const l of truckLoads ?? []) withMovement.add(l.egg_type_id);
    for (const [k, v] of stock) if (v > 0) withMovement.add(k);
    return (eggTypes ?? [])
      .filter((t) => withMovement.has(t.id) || (stock.get(t.id) ?? 0) > 0)
      .map((t) => ({ id: t.id, name: t.name, sistema: stock.get(t.id) ?? 0 }));
  }, [eggTypes, stock, truckLoads]);

  function setReal(id: string, v: string) {
    setReals((r) => ({ ...r, [id]: v.replace(/[^0-9]/g, '') }));
  }

  const diffs = rows
    .map((r) => {
      const raw = reals[r.id];
      if (raw == null || raw === '') return null;
      const real = parseInt(raw, 10);
      if (!Number.isFinite(real)) return null;
      return { ...r, real, diff: real - r.sistema };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const descuadres = diffs.filter((d) => d.diff !== 0);

  function submit() {
    if (!profile) return;
    if (diffs.length === 0) { showToast('Contá al menos un tipo', 'info'); return; }
    if (descuadres.length === 0) { showToast('Todo cuadra 🎉 — no hay descuadre para reportar', 'success'); return; }

    report.mutate(
      {
        id: uuidv4(),
        driver_id: profile.id,
        note: null,
        items: descuadres.map((d) => ({ id: uuidv4(), egg_type_id: d.id, system_qty: d.sistema, counted_qty: d.real })),
      },
      {
        onSuccess: () => showToast('Descuadre reportado a administración', 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo reportar', 'error'); },
      },
    );
    if (!isOnline) showToast('Reporte guardado (se enviará al reconectar)', 'success');
    navigation.goBack();
  }

  const extracto = extractoType
    ? extractoFor(extractoType, truckCounts ?? [], truckLoads ?? [], myDeliveries ?? [])
    : null;
  const extractoName = (eggTypes ?? []).find((t) => t.id === extractoType)?.name ?? '';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Arqueo de stock</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Contá físicamente cada tipo y poné el número real. La app te muestra la diferencia con el sistema.
          Si hay descuadre, se lo reportás a administración — ellos hacen el ajuste. Tocá "Ver movimientos" para
          ubicar dónde se pudo descuadrar.
        </Text>

        {isLoading ? (
          <ActivityIndicator color="#f59e0b" style={{ marginTop: 20 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>No hay stock para arquear.</Text>
        ) : (
          rows.map((r) => {
            const raw = reals[r.id] ?? '';
            const real = raw === '' ? null : parseInt(raw, 10);
            const diff = real != null && Number.isFinite(real) ? real - r.sistema : null;
            return (
              <View key={r.id} style={[styles.row, diff != null && diff !== 0 && styles.rowBad]}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.rowSys}>sistema: {r.sistema} cp</Text>
                </View>
                <View style={styles.rowBottom}>
                  <View style={styles.realWrap}>
                    <Text style={styles.realLbl}>Real</Text>
                    <TextInput
                      style={styles.realInput}
                      value={raw}
                      onChangeText={(t) => setReal(r.id, t)}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor="#9ca3af"
                      maxLength={5}
                      selectTextOnFocus
                    />
                  </View>
                  {diff != null && (
                    <Text style={[styles.diff, diff === 0 ? styles.diffOk : styles.diffBad]}>
                      {diff === 0 ? '✓ cuadra' : `${diff > 0 ? '+' : ''}${diff} cp`}
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => setExtractoType(r.id)} style={styles.movBtn} activeOpacity={0.7}>
                    <Text style={styles.movBtnTxt}>Ver movimientos</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        <TouchableOpacity style={[styles.reportBtn, descuadres.length === 0 && styles.reportBtnDim]} onPress={submit} activeOpacity={0.85}>
          <Text style={styles.reportBtnTxt}>
            {descuadres.length > 0 ? `Reportar ${descuadres.length} descuadre(s) a administración` : 'Reportar descuadre'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.foot}>Vos solo reportás. El ajuste del stock lo hace administración desde la web.</Text>
      </ScrollView>

      <Modal visible={extractoType !== null} transparent animationType="slide" onRequestClose={() => setExtractoType(null)}>
        <View style={styles.mBg}>
          <View style={styles.mCard}>
            <Text style={styles.mTitle}>Movimientos · {extractoName}</Text>
            {extracto && (
              <ScrollView style={{ maxHeight: 360 }}>
                {extracto.movements.length === 0 ? (
                  <Text style={styles.empty}>Sin movimientos desde el último recuento.</Text>
                ) : extracto.movements.map((m, i) => (
                  <View key={i} style={styles.mvRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mvLabel}>
                        {m.kind === 'base' ? '📋 Recuento base' : m.kind === 'carga' ? '⬆️ Carga' : `⬇️ ${m.label}`}
                      </Text>
                      <Text style={styles.mvAt}>{fmtHour(m.at)}</Text>
                    </View>
                    <Text style={[styles.mvQty, m.kind === 'entrega' ? styles.mvNeg : styles.mvPos]}>
                      {m.kind === 'base' ? `${m.qty}` : `${m.qty > 0 ? '+' : ''}${m.qty}`}
                    </Text>
                    <Text style={styles.mvRun}>{m.running}</Text>
                  </View>
                ))}
                <View style={styles.mvTotal}>
                  <Text style={styles.mvTotalLbl}>Sistema</Text>
                  <Text style={styles.mvTotalVal}>{extracto.system} cp</Text>
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.mClose} onPress={() => setExtractoType(null)}>
              <Text style={styles.mCloseTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn: { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 14, color: '#92400e', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginHorizontal: 8 },
  content: { padding: 16, gap: 10 },
  intro: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  empty: { fontSize: 13, color: '#9ca3af', paddingVertical: 10, textAlign: 'center' },
  row: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, gap: 8 },
  rowBad: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  rowSys: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  realWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  realLbl: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
  realInput: { width: 70, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb', textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#111827', padding: 0 },
  diff: { fontSize: 14, fontWeight: '800' },
  diffOk: { color: '#16a34a' },
  diffBad: { color: '#dc2626' },
  movBtn: { marginLeft: 'auto' },
  movBtnTxt: { fontSize: 12, color: '#1d4ed8', fontWeight: '700' },
  reportBtn: { backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  reportBtnDim: { backgroundColor: '#9ca3af' },
  reportBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  foot: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  mCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '82%' },
  mTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 8 },
  mvRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  mvLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  mvAt: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  mvQty: { fontSize: 15, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  mvPos: { color: '#16a34a' },
  mvNeg: { color: '#dc2626' },
  mvRun: { fontSize: 13, fontWeight: '700', color: '#111827', minWidth: 36, textAlign: 'right' },
  mvTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  mvTotalLbl: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  mvTotalVal: { fontSize: 16, fontWeight: '800', color: '#111827' },
  mClose: { marginTop: 12, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  mCloseTxt: { color: '#374151', fontWeight: '700', fontSize: 15 },
});
