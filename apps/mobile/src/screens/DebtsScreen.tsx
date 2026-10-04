import { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Modal, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useMyCustomers } from '../hooks/useMyCustomers';
import { useMyDebts, useRegisterCustomerPayment, type DebtRow } from '../hooks/useDebts';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { getDisplayName, type Customer } from '../types';
import { formatMoney } from '../lib/pricing';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';

export default function DebtsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: debts, isLoading } = useMyDebts();
  const { data: myCustomers } = useMyCustomers(profile?.id);
  const register = useRegisterCustomerPayment();

  const [cobro, setCobro] = useState<{ row: DebtRow; name: string } | null>(null);
  const [amount, setAmount] = useState('');

  const custMap = useMemo(() => {
    const m = new Map<string, Customer>();
    [...(myCustomers?.own ?? []), ...(myCustomers?.delegated ?? [])].forEach((c) => m.set(c.id, c));
    return m;
  }, [myCustomers]);

  const rows = useMemo(() => {
    return (debts ?? [])
      .filter((d) => d.saldo > 0.009)
      .map((d) => ({ ...d, name: custMap.get(d.customer_id) ? getDisplayName(custMap.get(d.customer_id)!) : 'Cliente' }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [debts, custMap]);

  const total = rows.reduce((s, r) => s + r.saldo, 0);

  function submitCobro() {
    if (!cobro || !profile) return;
    const n = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) { showToast('Ingresá un monto válido', 'error'); return; }
    register.mutate(
      { id: uuidv4(), customer_id: cobro.row.customer_id, driver_id: profile.id, amount: n },
      {
        onSuccess: () => showToast('Cobro registrado', 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo registrar', 'error'); },
      },
    );
    if (!isOnline) showToast('Cobro guardado (se enviará al reconectar)', 'success');
    setCobro(null);
    setAmount('');
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Deudas de clientes</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Deuda total de tus clientes</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          <Text style={styles.totalSub}>{rows.length} cliente(s) con saldo pendiente</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#f59e0b" style={{ marginTop: 30 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>Ningún cliente tiene deuda. 🎉</Text>
        ) : (
          rows.map((r) => {
            const alerta = r.entregas_credito_sin_cobrar >= 2;
            return (
              <View key={r.customer_id} style={[styles.card, alerta && styles.cardAlert]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{alerta ? '⚠️ ' : ''}{r.name}</Text>
                  <Text style={[styles.cardSub, alerta && styles.cardSubAlert]}>
                    {formatMoney(r.saldo)} · {r.entregas_credito_sin_cobrar} entrega(s) sin cobrar
                  </Text>
                </View>
                <TouchableOpacity style={styles.cobrarBtn} onPress={() => { setCobro({ row: r, name: r.name }); setAmount(String(Math.round(r.saldo))); }} activeOpacity={0.85}>
                  <Text style={styles.cobrarBtnText}>Cobrar</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={cobro !== null} transparent animationType="fade" onRequestClose={() => setCobro(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar cobro</Text>
            <Text style={styles.modalSub}>{cobro?.name} debe {formatMoney(cobro?.row.saldo ?? 0)}</Text>
            <TextInput
              style={styles.modalInput}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="Monto cobrado"
              placeholderTextColor="#9ca3af"
              selectTextOnFocus
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setCobro(null); setAmount(''); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={submitCobro}>
                <Text style={styles.modalOkText}>Registrar</Text>
              </TouchableOpacity>
            </View>
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
  totalCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', padding: 16 },
  totalLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  totalValue: { fontSize: 28, fontWeight: '800', color: '#111827', marginTop: 2 },
  totalSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 30, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14 },
  cardAlert: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6b7280', marginTop: 2, fontWeight: '600' },
  cardSubAlert: { color: '#b91c1c' },
  cobrarBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  cobrarBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 13, color: '#6b7280' },
  modalInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelText: { color: '#374151', fontWeight: '700' },
  modalOk: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center' },
  modalOkText: { color: '#fff', fontWeight: '700' },
});
