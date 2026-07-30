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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useEggTypes } from '../hooks/useEggTypes';
import { useEggReturns, useRegisterEggReturn } from '../hooks/useEggReturns';
import type { EggReturnStatus, EggReturnRow } from '../lib/eggReturns';
import { uuidv4 } from '../lib/uuid';

type Nav = NativeStackNavigationProp<RootStackParamList, 'EggReturns'>;

const STATUS_META: Record<EggReturnStatus, { label: string; bg: string; fg: string }> = {
  pendiente: { label: 'Pendiente', bg: '#fef3c7', fg: '#92400e' },
  aprobada: { label: 'Aprobada', bg: '#dcfce7', fg: '#15803d' },
  rechazada: { label: 'Rechazada', bg: '#fee2e2', fg: '#b91c1c' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

interface VencidoLine { egg_type_id: string; qty: string; expiry: string }

export default function EggReturnsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: eggTypes } = useEggTypes();
  const { data: returns, isLoading } = useEggReturns(profile?.id);
  const register = useRegisterEggReturn();

  const [broken, setBroken] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<VencidoLine[]>([]);

  const eggName = useMemo(() => {
    const m = new Map<string, string>();
    (eggTypes ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [eggTypes]);

  const selectedIds = new Set(lines.map((l) => l.egg_type_id));

  function toggleType(id: string) {
    setLines((prev) =>
      prev.some((l) => l.egg_type_id === id)
        ? prev.filter((l) => l.egg_type_id !== id)
        : [...prev, { egg_type_id: id, qty: '1', expiry: '' }],
    );
  }
  function setLine(id: string, patch: Partial<VencidoLine>) {
    setLines((prev) => prev.map((l) => (l.egg_type_id === id ? { ...l, ...patch } : l)));
  }

  function onSubmit() {
    if (!profile) return;
    const brokenN = parseInt(broken.replace(/[^0-9]/g, ''), 10) || 0;
    const items = lines.map((l) => ({
      id: uuidv4(),
      egg_type_id: l.egg_type_id,
      qty: parseInt(l.qty.replace(/[^0-9]/g, ''), 10) || 0,
      expiry_date: l.expiry.trim(),
    }));

    if (brokenN <= 0 && items.length === 0) {
      Alert.alert('Nada para enviar', 'Poné la cantidad de huevos rotos y/o agregá productos vencidos.');
      return;
    }
    for (const it of items) {
      const nombre = eggName.get(it.egg_type_id) ?? 'producto';
      if (it.qty <= 0) { Alert.alert('Falta cantidad', `Poné la cantidad de ${nombre}.`); return; }
      if (!it.expiry_date) { Alert.alert('Falta la fecha', `Ingresá la fecha de caducidad de ${nombre} (la del envase).`); return; }
    }

    register.mutate(
      { id: uuidv4(), driver_id: profile.id, broken_qty: brokenN, driver_note: note.trim() || null, items },
      { onError: (e: unknown) => { if (isOnline) Alert.alert('Error', (e instanceof Error ? e.message : null) ?? 'No se pudo registrar.'); } },
    );
    setBroken(''); setNote(''); setLines([]);
    Alert.alert('Registrado', 'Tu devolución quedó registrada. El administrador la va a controlar y aprobar.');
  }

  function renderCard(r: EggReturnRow) {
    const meta = STATUS_META[r.status];
    return (
      <View key={r.id} style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardDate}>{fmtDate(r.created_at)}</Text>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>
        {r.broken_qty > 0 && (
          <Text style={styles.cardLine}>
            🥚 Rotos: <Text style={styles.bold}>{r.broken_qty}</Text>
            {r.status === 'aprobada' && r.broken_returned != null ? `  ·  te devolvieron ${r.broken_returned}` : ''}
          </Text>
        )}
        {r.items.map((it) => (
          <Text key={it.id} style={styles.cardLine}>
            📦 {eggName.get(it.egg_type_id) ?? 'Producto'}: <Text style={styles.bold}>{it.qty}</Text> (vence {it.expiry_date})
            {r.status === 'aprobada' && it.returned_qty != null
              ? `  ·  te devolvieron ${it.returned_qty}${it.returned_expiry_date ? ` (vence ${it.returned_expiry_date})` : ''}`
              : ''}
          </Text>
        ))}
        {r.review_note ? <Text style={styles.cardReviewNote}>Nota del admin: {r.review_note}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Rotos y devoluciones</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.formTitle}>Registrar devolución a la empresa</Text>
          <Text style={styles.formHint}>Lo que devolvés: huevos rotos y/o productos envasados vencidos. El admin lo controla y aprueba.</Text>

          {/* Rotos */}
          <Text style={styles.label}>🥚 Huevos rotos (total)</Text>
          <TextInput
            style={styles.qtyInput}
            value={broken}
            onChangeText={(t) => setBroken(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="Ej: 12"
            placeholderTextColor="#9ca3af"
          />

          {/* Vencidos */}
          <Text style={styles.label}>📦 Envasados vencidos</Text>
          <Text style={styles.subHint}>Tocá el producto que devolvés por vencimiento:</Text>
          <View style={styles.chipRow}>
            {(eggTypes ?? []).map((t) => {
              const sel = selectedIds.has(t.id);
              return (
                <TouchableOpacity key={t.id} style={[styles.chip, sel && styles.chipActive]} onPress={() => toggleType(t.id)} activeOpacity={0.8}>
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{sel ? '✓ ' : ''}{t.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {lines.map((l) => (
            <View key={l.egg_type_id} style={styles.vLine}>
              <Text style={styles.vName} numberOfLines={1}>{eggName.get(l.egg_type_id) ?? 'Producto'}</Text>
              <View style={styles.vRow}>
                <View style={styles.vField}>
                  <Text style={styles.vFieldLbl}>Cantidad</Text>
                  <TextInput
                    style={styles.vInput}
                    value={l.qty}
                    onChangeText={(t) => setLine(l.egg_type_id, { qty: t.replace(/[^0-9]/g, '') })}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={[styles.vField, { flex: 1 }]}>
                  <Text style={styles.vFieldLbl}>Vence (del envase)</Text>
                  <TextInput
                    style={styles.vInput}
                    value={l.expiry}
                    onChangeText={(t) => setLine(l.egg_type_id, { expiry: t })}
                    placeholder="Ej: 06/2026"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <TouchableOpacity onPress={() => toggleType(l.egg_type_id)} style={styles.vRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.vRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="Observaciones…" placeholderTextColor="#9ca3af" multiline />

          <TouchableOpacity style={styles.saveBtn} onPress={onSubmit} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Registrar devolución</Text>
          </TouchableOpacity>
          {!isOnline && <Text style={styles.offlineHint}>Sin conexión: se guarda y se envía al reconectar.</Text>}
        </View>

        <Text style={styles.histTitle}>Mis devoluciones</Text>
        {isLoading ? (
          <ActivityIndicator color="#f59e0b" style={{ marginTop: 20 }} />
        ) : (returns ?? []).length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>📦</Text><Text style={styles.emptyText}>Todavía no registraste devoluciones.</Text></View>
        ) : (
          (returns ?? []).map(renderCard)
        )}
      </ScrollView>
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
  content: { padding: 16, gap: 12 },
  form: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', padding: 16, gap: 4 },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  formHint: { fontSize: 12, color: '#6b7280', lineHeight: 17, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  subHint: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  qtyInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  vLine: { backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 10, marginTop: 8 },
  vName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 6 },
  vRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  vField: { gap: 2 },
  vFieldLbl: { fontSize: 10, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase' },
  vInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 15, fontWeight: '700', color: '#111827', minWidth: 70,
  },
  vRemove: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  vRemoveText: { color: '#b91c1c', fontSize: 16, fontWeight: '800' },
  noteInput: {
    backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 12, minHeight: 54, fontSize: 14, color: '#111827', textAlignVertical: 'top', marginTop: 4,
  },
  saveBtn: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineHint: { fontSize: 12, color: '#92400e', marginTop: 8, textAlign: 'center' },
  histTitle: { fontSize: 14, fontWeight: '800', color: '#374151', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', padding: 14, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDate: { fontSize: 12, color: '#9ca3af' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  cardLine: { fontSize: 13, color: '#374151' },
  bold: { fontWeight: '800', color: '#111827' },
  cardReviewNote: { fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 30, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
