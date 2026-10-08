import { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Modal, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  useCustomerDebt, useCustomerCreditDeliveries, useCustomerPaymentsHistory,
  useRegisterCustomerPayment, type DebtDeliveryItem,
} from '../hooks/useDebts';
import { formatMoney, formatCajonesFor } from '../lib/pricing';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDebtDetail'>;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

// Separador de miles sin depender de Intl (Hermes). Ej: 1234 -> "1.234"
function grp(n: number): string {
  return Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function eggDot(color: 'rojo' | 'blanco' | null): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

// Huevos de una línea: suelto = cp × maples × 30; envasado = cp × paquetes × huevos/paq.
function eggsInLine(it: DebtDeliveryItem): number {
  if (it.is_packaged) return it.cajas_plasticas * (it.packages_per_box ?? 0) * (it.eggs_per_package ?? 0);
  return it.cajas_plasticas * (it.maples_per_box ?? 6) * 30;
}

export default function CustomerDebtDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { customerId, name } = route.params;
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();

  const { data: debt } = useCustomerDebt(customerId);
  const { data: deliveries, isLoading } = useCustomerCreditDeliveries(customerId);
  const { data: payments } = useCustomerPaymentsHistory(customerId);
  const register = useRegisterCustomerPayment();

  const [cobroOpen, setCobroOpen] = useState(false);
  const [amount, setAmount] = useState('');

  const saldo = debt?.saldo ?? 0;
  const totalEntregas = (deliveries ?? []).length;
  const totalHuevos = useMemo(
    () => (deliveries ?? []).reduce((s, d) => s + d.items.reduce((a, it) => a + eggsInLine(it), 0), 0),
    [deliveries],
  );

  function submitCobro() {
    if (!profile) return;
    const n = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) { showToast('Ingresá un monto válido', 'error'); return; }
    register.mutate(
      { id: uuidv4(), customer_id: customerId, driver_id: profile.id, amount: n },
      {
        onSuccess: () => showToast('Cobro registrado', 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo registrar', 'error'); },
      },
    );
    if (!isOnline) showToast('Cobro guardado (se enviará al reconectar)', 'success');
    setCobroOpen(false);
    setAmount('');
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Deuda del cliente</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.saldoCard}>
          <Text style={styles.custName} numberOfLines={2}>{name}</Text>
          <Text style={styles.saldoLbl}>Debe</Text>
          <Text style={styles.saldoVal}>{formatMoney(saldo)}</Text>
          <Text style={styles.saldoSub}>
            {totalEntregas} entrega(s) a crédito · ~{grp(totalHuevos)} huevos
          </Text>
          <TouchableOpacity style={styles.cobrarBtn} onPress={() => { setCobroOpen(true); setAmount(String(Math.round(Math.max(0, saldo)))); }} activeOpacity={0.85}>
            <Text style={styles.cobrarBtnText}>Registrar cobro</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Entregas a crédito</Text>
        {isLoading ? (
          <ActivityIndicator color="#f59e0b" style={{ marginTop: 16 }} />
        ) : (deliveries ?? []).length === 0 ? (
          <Text style={styles.empty}>Sin entregas a crédito registradas.</Text>
        ) : (
          (deliveries ?? []).map((d) => (
            <View key={d.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>{fmtDate(d.delivered_at)}</Text>
                <Text style={styles.cardTotal}>{d.total_amount > 0 ? formatMoney(d.total_amount) : '—'}</Text>
              </View>
              {d.items.length === 0 ? (
                <Text style={styles.itemNone}>Sin detalle de productos</Text>
              ) : (
                d.items.map((it, i) => (
                  <View key={i} style={styles.itemRow}>
                    <View style={[styles.itemDot, { backgroundColor: eggDot(it.color) }]} />
                    <Text style={styles.itemName} numberOfLines={1}>{it.egg_type_name ?? 'Categoría'}</Text>
                    <Text style={styles.itemQty}>
                      {it.cajas_plasticas} cp · {formatCajonesFor(it.cajas_plasticas, it.is_packaged)} cj · ~{grp(eggsInLine(it))} huevos
                    </Text>
                  </View>
                ))
              )}
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Cobros registrados</Text>
        {(payments ?? []).length === 0 ? (
          <Text style={styles.empty}>Todavía no se registraron cobros.</Text>
        ) : (
          (payments ?? []).map((p) => (
            <View key={p.id} style={styles.payRow}>
              <Text style={styles.payDate}>{fmtDate(p.received_at)}{p.note ? ` · ${p.note}` : ''}</Text>
              <Text style={styles.payAmount}>− {formatMoney(p.amount)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={cobroOpen} transparent animationType="fade" onRequestClose={() => setCobroOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar cobro</Text>
            <Text style={styles.modalSub}>{name} debe {formatMoney(saldo)}</Text>
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
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setCobroOpen(false); setAmount(''); }}>
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
  content: { padding: 16, gap: 8 },
  saldoCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', padding: 16 },
  custName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  saldoLbl: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginTop: 8 },
  saldoVal: { fontSize: 30, fontWeight: '800', color: '#b91c1c' },
  saldoSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cobrarBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  cobrarBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 2 },
  empty: { fontSize: 13, color: '#9ca3af', paddingVertical: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', padding: 12, gap: 6, marginTop: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardTotal: { fontSize: 14, fontWeight: '800', color: '#92400e' },
  itemNone: { fontSize: 12, color: '#9ca3af' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemDot: { width: 9, height: 9, borderRadius: 5 },
  itemName: { fontSize: 13, fontWeight: '700', color: '#374151', width: 110 },
  itemQty: { flex: 1, fontSize: 12, color: '#6b7280', textAlign: 'right' },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', paddingVertical: 10, paddingHorizontal: 12, marginTop: 6 },
  payDate: { flex: 1, fontSize: 12, color: '#374151' },
  payAmount: { fontSize: 14, fontWeight: '800', color: '#166534' },
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
