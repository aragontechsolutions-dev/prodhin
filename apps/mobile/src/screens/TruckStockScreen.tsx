import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { formatCajones, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useEggTypes } from '../hooks/useEggTypes';
import { useMyDeliveries } from '../hooks/useMyDeliveries';
import { useTruckLoads, useTruckCounts, useRegisterLoads } from '../hooks/useTruckStock';
import { computeStock } from '../lib/truck';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { uuidv4 } from '../lib/uuid';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TruckStock'>;
// El chofer solo registra CARGAS; los recuentos los hace el admin en la web.
type Mode = 'view' | 'load';

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

export default function TruckStockScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: eggTypes, isLoading: loadingTypes } = useEggTypes();
  const { data: counts } = useTruckCounts(profile?.id);
  const { data: loads } = useTruckLoads(profile?.id);
  const { data: deliveries } = useMyDeliveries(profile?.id);
  const registerLoads = useRegisterLoads();

  const [mode, setMode] = useState<Mode>('view');
  // valores del formulario por tipo (string para permitir escribir libremente)
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const stock = useMemo(
    () => computeStock(counts ?? [], loads ?? [], deliveries ?? []),
    [counts, loads, deliveries],
  );

  const totalStock = useMemo(() => {
    let t = 0;
    for (const v of stock.values()) t += v;
    return t;
  }, [stock]);

  function startMode(m: Mode) {
    const init: Record<string, string> = {};
    (eggTypes ?? []).forEach((t) => { init[t.id] = ''; });
    setInputs(init);
    setMode(m);
  }

  function setVal(id: string, v: string) {
    setInputs((prev) => ({ ...prev, [id]: v.replace(/[^0-9]/g, '') }));
  }

  async function save() {
    if (!profile) return;
    const items = (eggTypes ?? [])
      .map((t) => ({ id: uuidv4(), egg_type_id: t.id, cajas_plasticas: parseInt(inputs[t.id] || '0', 10) || 0 }));

    const toLoad = items.filter((it) => it.cajas_plasticas > 0);
    if (toLoad.length === 0) { Alert.alert('Nada para cargar', 'Ingresá al menos una cantidad.'); return; }

    // Encolar SIN esperar: offline la mutación queda pausada y se envía sola al
    // reconectar (await/mutateAsync se colgaría offline porque nunca resuelve).
    registerLoads.mutate(
      { driver_id: profile.id, created_at: new Date().toISOString(), items: toLoad },
      {
        onSuccess: () => Alert.alert('Carga registrada', 'El stock del camión se actualizó.'),
        onError: (e: unknown) => {
          if (isOnline) Alert.alert('Error', (e instanceof Error ? e.message : null) ?? 'No se pudo guardar.');
        },
      },
    );
    if (!isOnline) Alert.alert('Guardado sin conexión', 'La carga se registrará al reconectar.');
    setMode('view');
  }

  const saving = registerLoads.isPending;
  const editing = mode !== 'view';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Stock del camión</Text>
        <View style={{ width: 80 }} />
      </View>

      {loadingTypes ? (
        <ActivityIndicator color="#f59e0b" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>Sin conexión — se guardará al reconectar</Text>
            </View>
          )}

          {/* Total */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>
              {mode === 'load' ? 'Registrando carga' : 'En el camión ahora'}
            </Text>
            <Text style={styles.heroTotal}>{totalStock} <Text style={styles.heroUnit}>cp</Text></Text>
            <Text style={styles.heroSub}>= {formatCajones(totalStock)} cajones</Text>
          </View>

          {editing && (
            <Text style={styles.modeHint}>
              Ingresá cuántas cajas plásticas SUMÁS al camión por cada tipo.
            </Text>
          )}

          {/* Lista por tipo */}
          {(eggTypes ?? []).map((t) => {
            const cur = stock.get(t.id) ?? 0;
            return (
              <View key={t.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: eggDotColor(t.color) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{t.name}</Text>
                  {!editing && <Text style={styles.sub}>{formatCajones(cur)} cajones</Text>}
                  {mode === 'load' && cur > 0 && <Text style={styles.sub}>en camión: {cur} cp</Text>}
                </View>
                {editing ? (
                  <TextInput
                    style={styles.input}
                    value={inputs[t.id] ?? ''}
                    onChangeText={(v) => setVal(t.id, v)}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={styles.stockNum}>{cur} <Text style={styles.stockUnit}>cp</Text></Text>
                )}
              </View>
            );
          })}

          {/* Acciones */}
          {!editing ? (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, styles.loadBtn]} onPress={() => startMode('load')} activeOpacity={0.85}>
                <Text style={styles.loadBtnText}>➕ Registrar carga</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setMode('view')} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={save} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.footnote}>
            El stock se calcula solo: último recuento + cargas − entregas. Vos registrás las cargas;
            el recuento (ajuste real) lo hace el administrador desde la web.
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
  modeHint: { fontSize: 12, color: '#6b7280', lineHeight: 17, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f3f4f6',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  stockNum: { fontSize: 20, fontWeight: '800', color: '#0f766e' },
  stockUnit: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  input: {
    width: 68, height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb', textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827', padding: 0,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  loadBtn: { backgroundColor: '#0f766e' },
  loadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  countBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#0f766e' },
  countBtnText: { color: '#0f766e', fontWeight: '700', fontSize: 14 },
  cancelBtn: { backgroundColor: '#f3f4f6' },
  cancelBtnText: { color: '#374151', fontWeight: '700', fontSize: 14 },
  saveBtn: { backgroundColor: '#16a34a' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footnote: { fontSize: 11, color: '#9ca3af', marginTop: 10, lineHeight: 16 },
});
