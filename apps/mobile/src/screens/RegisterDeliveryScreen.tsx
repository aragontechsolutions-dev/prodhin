import { useState, useMemo, useEffect, useRef } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getDisplayName, formatCajones, type DeliveryStatus, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useEggTypes } from '../hooks/useEggTypes';
import { useCreateDelivery } from '../hooks/useCreateDelivery';
import { useCustomerPreferences, useAddPreference } from '../hooks/useCustomerPreferences';
import { useMyDeliveries } from '../hooks/useMyDeliveries';
import { useBoxBalances } from '../hooks/useBoxBalances';
import { useTruckLoads, useTruckCounts } from '../hooks/useTruckStock';
import { computeStock } from '../lib/truck';
import type { DeliveryMode } from '../lib/deliveries';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { markVisited } from '../lib/visitedStore';
import { uuidv4 } from '../lib/uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'RegisterDelivery'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'RegisterDelivery'>;

const STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: 'entregado', label: 'Entregado' },
  { value: 'cliente_ausente', label: 'Cliente ausente' },
  { value: 'rechazado', label: 'No quiso' },
  { value: 'sin_stock', label: 'Sin stock' },
];

export default function RegisterDeliveryScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { customer: c } = route.params;
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();

  const { data: eggTypes, isLoading: loadingTypes } = useEggTypes();
  const { data: preferences } = useCustomerPreferences();
  const { data: myDeliveries } = useMyDeliveries(profile?.id);
  const { data: truckCounts } = useTruckCounts(profile?.id);
  const { data: truckLoads } = useTruckLoads(profile?.id);
  const { data: boxBalances } = useBoxBalances();
  const boxBalance = boxBalances?.[c.id] ?? 0;
  const createDelivery = useCreateDelivery();
  const addPref = useAddPreference();

  const [status, setStatus] = useState<DeliveryStatus>('entregado');
  // Una línea por tipo de huevo entregado
  const [lines, setLines] = useState<{ egg_type_id: string; cajas: number }[]>([]);
  const [mode, setMode] = useState<DeliveryMode>('cp');
  const [cajasRecogidas, setCajasRecogidas] = useState(0);
  const [notes, setNotes] = useState('');

  // Stock actual del camión (para validar que haya suficiente)
  const stock = useMemo(
    () => computeStock(truckCounts ?? [], truckLoads ?? [], myDeliveries ?? []),
    [truckCounts, truckLoads, myDeliveries],
  );

  const isDelivered = status === 'entregado';

  // Preferencias de este cliente (principal primero)
  const myPrefs = useMemo(
    () => (preferences ?? []).filter((p) => p.customer_id === c.id),
    [preferences, c.id],
  );
  const primaryPrefId = myPrefs.find((p) => p.is_primary)?.egg_type_id ?? null;

  // Prellenar (una sola vez): el tipo principal del cliente con 2 cajas
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    if (!eggTypes || preferences === undefined) return;
    inited.current = true;
    if (primaryPrefId) setLines([{ egg_type_id: primaryPrefId, cajas: 2 }]);
  }, [eggTypes, preferences, primaryPrefId]);

  const selectedIds = new Set(lines.map((l) => l.egg_type_id));
  const totalCajas = lines.reduce((s, l) => s + (l.cajas || 0), 0);

  function toggleType(id: string) {
    setLines((prev) =>
      prev.some((l) => l.egg_type_id === id)
        ? prev.filter((l) => l.egg_type_id !== id)
        : [...prev, { egg_type_id: id, cajas: 2 }],
    );
  }

  function setCajas(id: string, value: number) {
    const v = Math.max(0, Math.min(99999, Math.floor(value) || 0));
    setLines((prev) => prev.map((l) => (l.egg_type_id === id ? { ...l, cajas: v } : l)));
  }

  async function onSave() {
    if (!profile) return;

    const items = isDelivered
      ? lines.filter((l) => l.cajas > 0).map((l) => ({
          egg_type_id: l.egg_type_id,
          cajas_plasticas: l.cajas,
        }))
      : [];

    if (isDelivered && items.length === 0) {
      Alert.alert('Falta la cantidad', 'Agregá al menos un tipo de huevo con cantidad.');
      return;
    }

    // Reunir advertencias de stock y cajas según los datos disponibles
    const warnings: string[] = [];
    if (isDelivered) {
      for (const it of items) {
        const disponible = stock.get(it.egg_type_id) ?? 0;
        const nombre = eggTypes?.find((t) => t.id === it.egg_type_id)?.name ?? 'ese tipo';
        if (disponible <= 0) warnings.push(`No hay ${nombre} en el camión.`);
        else if (it.cajas_plasticas > disponible) warnings.push(`Solo hay ${disponible} cp de ${nombre} (querés ${it.cajas_plasticas}).`);
      }
      const enLocal = Math.max(0, boxBalance);
      if (cajasRecogidas > enLocal) warnings.push(`En el local hay ${enLocal} caja(s); querés recoger ${cajasRecogidas}.`);
    }

    if (warnings.length > 0) {
      if (isOnline) {
        // Con conexión los datos son exactos → se bloquea
        Alert.alert('No se puede registrar', warnings.join('\n'));
        return;
      }
      // Sin conexión no se puede verificar con datos actualizados → avisar y permitir
      Alert.alert(
        'Sin conexión — verificá los datos',
        `No se pudo confirmar contra el servidor:\n\n${warnings.join('\n')}\n\n¿Registrar de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Registrar igual', onPress: () => doSave(items) },
        ],
      );
      return;
    }

    doSave(items);
  }

  function doSave(items: { egg_type_id: string; cajas_plasticas: number }[]) {
    if (!profile) return;

    // Marca la visita al instante (optimista, persiste local)
    markVisited(c.id, status === 'entregado' ? 'delivered' : 'visited');

    // Encolar la entrega SIN esperarla: offline queda pausada y se envía sola
    // al reconectar; online se ejecuta normal. No usar await/mutateAsync porque
    // offline la promesa nunca resuelve (la mutación queda pausada).
    createDelivery.mutate(
      {
        id: uuidv4(),
        customer_id: c.id,
        driver_id: profile.id,
        status,
        mode,
        cajas_recogidas: isDelivered ? cajasRecogidas : 0,
        notes: notes.trim() || null,
        delivered_at: new Date().toISOString(),
        items,
      },
      {
        onError: (e: unknown) => {
          // Solo con conexión un error es real (offline queda en cola)
          if (isOnline) {
            Alert.alert('Error', (e instanceof Error ? e.message : null) ?? 'No se pudo guardar la entrega. Reintentá.');
          }
        },
      },
    );

    // Auto-sugerencia: tipos entregados que no están en los habituales
    const newTypes = items
      .map((it) => it.egg_type_id)
      .filter((id) => !myPrefs.some((p) => p.egg_type_id === id));
    if (newTypes.length > 0) {
      const names = newTypes
        .map((id) => eggTypes?.find((t) => t.id === id)?.name ?? 'tipo')
        .join(', ');
      Alert.alert(
        'Agregar a habituales',
        `¿Agregar ${names} a los tipos habituales de este cliente?`,
        [
          { text: 'No', style: 'cancel', onPress: () => navigation.goBack() },
          {
            text: 'Sí, agregar',
            onPress: () => {
              newTypes.forEach((id, i) =>
                addPref.mutate({
                  customer_id: c.id,
                  egg_type_id: id,
                  make_primary: myPrefs.length === 0 && i === 0,
                }),
              );
              navigation.goBack();
            },
          },
        ],
      );
      return;
    }

    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Registrar entrega</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.customerName}>{getDisplayName(c)}</Text>
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>Sin conexión — se guardará y enviará al reconectar</Text>
          </View>
        )}

        {/* Estado de la visita */}
        <Text style={styles.label}>Resultado de la visita</Text>
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s.value}
              style={[styles.chip, status === s.value && styles.chipActive]}
              onPress={() => setStatus(s.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, status === s.value && styles.chipTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isDelivered && (
          <>
            {/* Tipos de huevo (multi-selección) */}
            <Text style={styles.label}>Tipos de huevo</Text>
            <Text style={styles.subHint}>Tocá los tipos que se entregan. Podés registrar varios.</Text>
            {loadingTypes ? (
              <ActivityIndicator color="#f59e0b" style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.chipRow}>
                {(eggTypes ?? []).map((t: EggType) => {
                  const selected = selectedIds.has(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => toggleType(t.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {selected ? '✓ ' : ''}{t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Cantidad por tipo seleccionado */}
            {lines.length > 0 && (
              <View style={styles.linesWrap}>
                {lines.map((l) => {
                  const t = eggTypes?.find((x) => x.id === l.egg_type_id);
                  const disp = stock.get(l.egg_type_id) ?? 0;
                  const over = l.cajas > disp;
                  return (
                    <View key={l.egg_type_id} style={styles.lineCard}>
                      <View style={styles.lineNameCol}>
                        <Text style={styles.lineName} numberOfLines={1}>{t?.name ?? 'Tipo'}</Text>
                        <Text style={[styles.lineStock, over && styles.lineStockOver]}>
                          en camión: {disp} cp{over ? ' ⚠' : ''}
                        </Text>
                      </View>
                      <View style={styles.qtyRow}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => setCajas(l.egg_type_id, l.cajas - 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.qtyBtnText}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={styles.qtyInput}
                          value={String(l.cajas)}
                          onChangeText={(txt) => setCajas(l.egg_type_id, parseInt(txt.replace(/[^0-9]/g, ''), 10) || 0)}
                          keyboardType="number-pad"
                          maxLength={5}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => setCajas(l.egg_type_id, l.cajas + 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.lineEquiv}>{formatCajones(l.cajas)} cj</Text>
                    </View>
                  );
                })}
                <Text style={styles.totalEquiv}>
                  Total: {totalCajas} cajas plásticas = {formatCajones(totalCajas)}{' '}
                  {formatCajones(totalCajas) === '1' ? 'cajón' : 'cajones'}
                </Text>
              </View>
            )}

            {/* Modo de entrega */}
            <Text style={styles.label}>Modo de entrega</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, mode === 'cp' && styles.chipActive]}
                onPress={() => setMode('cp')}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, mode === 'cp' && styles.chipTextActive]}>📦 Deja cajas plásticas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, mode === 'cartones' && styles.chipActive]}
                onPress={() => setMode('cartones')}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, mode === 'cartones' && styles.chipTextActive]}>🥚 En cartones (sin cajas)</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subHint}>
              {mode === 'cp'
                ? 'Las cajas plásticas quedan en el local y se recogen después.'
                : 'Se entrega en maples/cartones; no quedan cajas en el local.'}
            </Text>

            {/* Cajas recogidas */}
            <Text style={styles.label}>Cajas plásticas recogidas</Text>
            <Text style={styles.subHint}>En el local hay {Math.max(0, boxBalance ?? 0)} caja(s) plástica(s).</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setCajasRecogidas((n) => Math.max(0, n - 1))} activeOpacity={0.7}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.stepInput}
                value={String(cajasRecogidas)}
                onChangeText={(txt) => setCajasRecogidas(Math.min(9999, parseInt(txt.replace(/[^0-9]/g, ''), 10) || 0))}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.stepBtn} onPress={() => setCajasRecogidas((n) => Math.min(9999, n + 1))} activeOpacity={0.7}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.subHint}>Cajas vacías que retirás del local en esta visita (puede ser más o menos que las que dejás).</Text>
          </>
        )}

        {/* Notas */}
        <Text style={styles.label}>Notas (opcional)</Text>
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder="Observaciones de la entrega…"
          placeholderTextColor="#9ca3af"
          multiline
        />

        <TouchableOpacity
          style={[styles.saveBtn, createDelivery.isPending && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={createDelivery.isPending}
          activeOpacity={0.85}
        >
          {createDelivery.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Guardar entrega</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  customerName: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 4,
  },
  offlineText: { color: '#92400e', fontSize: 12, fontWeight: '600' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  subHint: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  linesWrap: { marginTop: 12, gap: 8 },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  lineNameCol: { flex: 1 },
  lineName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  lineStock: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  lineStockOver: { color: '#dc2626', fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 22, color: '#1d4ed8', fontWeight: '700' },
  qtyInput: {
    width: 62,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    padding: 0,
  },
  lineEquiv: { fontSize: 12, color: '#059669', fontWeight: '700', minWidth: 44, textAlign: 'right' },
  totalEquiv: { fontSize: 14, color: '#059669', fontWeight: '700', marginTop: 4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 28, color: '#1d4ed8', fontWeight: '700' },
  stepInput: { fontSize: 30, fontWeight: '800', color: '#111827', minWidth: 70, textAlign: 'center', padding: 0 },
  stepValue: { fontSize: 34, fontWeight: '800', color: '#111827', minWidth: 50, textAlign: 'center' },
  equiv: { fontSize: 15, color: '#059669', fontWeight: '700', marginTop: 6 },
  notes: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    minHeight: 70,
    fontSize: 14,
    color: '#111827',
    marginTop: 4,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
