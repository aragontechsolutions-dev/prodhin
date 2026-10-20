import { useState } from 'react';
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
import { useMapleReturns, useRegisterMapleReturn } from '../hooks/useMapleReturns';
import type { MapleStatus, MapleReturnRow } from '../lib/mapleReturns';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MapleReturns'>;

const STATUS_META: Record<MapleStatus, { label: string; bg: string; fg: string }> = {
  pendiente: { label: 'Pendiente', bg: '#fef3c7', fg: '#92400e' },
  aprobada: { label: 'Aprobada', bg: '#dcfce7', fg: '#15803d' },
  rechazada: { label: 'Rechazada', bg: '#fee2e2', fg: '#b91c1c' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

export default function MapleReturnsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: returns, isLoading } = useMapleReturns(profile?.id);
  const register = useRegisterMapleReturn();

  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  function onRegister() {
    if (!profile) return;
    const n = parseInt(qty.replace(/[^0-9]/g, ''), 10) || 0;
    if (n <= 0) {
      Alert.alert('Falta la cantidad', 'Poné cuántos maples plásticos entregás (mayor que 0).');
      return;
    }
    register.mutate(
      { id: uuidv4(), driver_id: profile.id, declared_qty: n, driver_note: note.trim() || null },
      {
        onSuccess: () => showToast(`Entrega de ${n} maples registrada`, 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo registrar', 'error'); },
      },
    );
    if (!isOnline) showToast(`Entrega de ${n} maples guardada`, 'success');
    setQty('');
    setNote('');
  }

  function renderCard(r: MapleReturnRow) {
    const meta = STATUS_META[r.status];
    const mismatch = r.status === 'aprobada' && r.approved_qty != null && r.approved_qty !== r.declared_qty;
    return (
      <View key={r.id} style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.cardQty}>{r.declared_qty} <Text style={styles.cardQtyUnit}>maples</Text></Text>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>Registrado: {fmtDate(r.created_at)}</Text>
        {r.driver_note ? <Text style={styles.cardNote}>Tu nota: {r.driver_note}</Text> : null}
        {r.status !== 'pendiente' && r.approved_qty != null && (
          <Text style={[styles.cardApproved, mismatch && styles.cardApprovedMismatch]}>
            El admin contó: {r.approved_qty} maples{mismatch ? ` (declaraste ${r.declared_qty})` : ''}
          </Text>
        )}
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
        <Text style={styles.headerTitle} numberOfLines={1}>Entregar maples</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Registrar */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Registrar entrega a la empresa</Text>
          <Text style={styles.formHint}>Cuántos maples plásticos le entregás al administrador. Él los cuenta y aprueba.</Text>
          <Text style={styles.label}>Cantidad de maples</Text>
          <TextInput
            style={styles.qtyInput}
            value={qty}
            onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={5}
            placeholder="Ej: 40"
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Observaciones…"
            placeholderTextColor="#9ca3af"
            multiline
          />
          <TouchableOpacity style={styles.saveBtn} onPress={onRegister} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Registrar entrega</Text>
          </TouchableOpacity>
          {!isOnline && (
            <Text style={styles.offlineHint}>Sin conexión: se guarda y se envía al reconectar.</Text>
          )}
        </View>

        {/* Historial */}
        <Text style={styles.histTitle}>Mis entregas de maples</Text>
        {isLoading ? (
          <ActivityIndicator color="#f59e0b" style={{ marginTop: 20 }} />
        ) : (returns ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🧺</Text>
            <Text style={styles.emptyText}>Todavía no registraste entregas de maples.</Text>
          </View>
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
  form: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', padding: 16, gap: 6 },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  formHint: { fontSize: 12, color: '#6b7280', lineHeight: 17, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  qtyInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 4,
  },
  noteInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb',
    padding: 12, minHeight: 54, fontSize: 14, color: '#111827', textAlignVertical: 'top', marginTop: 4,
  },
  saveBtn: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineHint: { fontSize: 12, color: '#92400e', marginTop: 8, textAlign: 'center' },
  histTitle: { fontSize: 14, fontWeight: '800', color: '#374151', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', padding: 14, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardQty: { fontSize: 20, fontWeight: '800', color: '#111827' },
  cardQtyUnit: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  cardDate: { fontSize: 12, color: '#9ca3af' },
  cardNote: { fontSize: 13, color: '#374151' },
  cardApproved: { fontSize: 13, fontWeight: '700', color: '#15803d', marginTop: 2 },
  cardApprovedMismatch: { color: '#b45309' },
  cardReviewNote: { fontSize: 13, color: '#6b7280', fontStyle: 'italic' },
  empty: { alignItems: 'center', marginTop: 30, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
