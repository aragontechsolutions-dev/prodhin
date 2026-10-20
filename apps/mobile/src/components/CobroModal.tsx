import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useRegisterCustomerPayment } from '../hooks/useDebts';
import { uploadPaymentProof, type PaymentMethod } from '../lib/customerPayments';
import { formatMoney } from '../lib/pricing';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';

interface Proof { uri: string; isPdf: boolean; label: string }

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: '💵 Efectivo' },
  { value: 'cheque', label: '🧾 Cheque' },
  { value: 'transferencia', label: '🏦 Transferencia' },
];

export default function CobroModal({ visible, customerId, name, saldo, onClose }: {
  visible: boolean; customerId: string; name: string; saldo: number; onClose: () => void;
}) {
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const register = useRegisterCustomerPayment();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [proof, setProof] = useState<Proof | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() { setAmount(''); setMethod('efectivo'); setProof(null); setBusy(false); }
  function close() { reset(); onClose(); }

  async function pickCheckPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') { showToast('Sin permiso de cámara', 'error'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false });
    if (res.canceled || !res.assets?.[0]) return;
    setProof({ uri: res.assets[0].uri, isPdf: false, label: 'Foto del cheque' });
  }

  async function pickTransferFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const isPdf = a.mimeType === 'application/pdf' || (a.name ?? '').toLowerCase().endsWith('.pdf');
    setProof({ uri: a.uri, isPdf, label: a.name ?? (isPdf ? 'Comprobante.pdf' : 'Comprobante') });
  }

  async function submit() {
    if (!profile) return;
    const n = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) { showToast('Ingresá un monto válido', 'error'); return; }

    setBusy(true);
    let proofPath: string | null = null;
    if (proof) {
      if (isOnline) {
        try {
          proofPath = await uploadPaymentProof(proof.uri, customerId, proof.isPdf);
        } catch {
          showToast('No se pudo subir el comprobante; el cobro se registra igual', 'info');
        }
      } else {
        showToast('Sin conexión: el cobro se guarda sin el comprobante', 'info');
      }
    }

    register.mutate(
      { id: uuidv4(), customer_id: customerId, driver_id: profile.id, amount: n, method, note: null, proof_path: proofPath },
      {
        onSuccess: () => showToast('Cobro registrado', 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo registrar', 'error'); },
      },
    );
    if (!isOnline) showToast('Cobro guardado (se enviará al reconectar)', 'success');
    close();
  }

  const needsProof = method === 'cheque' || method === 'transferencia';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <Text style={styles.title}>Registrar cobro</Text>
          <Text style={styles.sub}>{name} debe {formatMoney(saldo)}</Text>

          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="Monto cobrado"
            placeholderTextColor="#9ca3af"
            selectTextOnFocus
            autoFocus
          />

          <Text style={styles.label}>Forma de cobro</Text>
          <View style={styles.chipRow}>
            {METHODS.map((m) => (
              <TouchableOpacity key={m.value} style={[styles.chip, method === m.value && styles.chipOn]}
                onPress={() => { setMethod(m.value); setProof(null); }} activeOpacity={0.8}>
                <Text style={[styles.chipTxt, method === m.value && styles.chipTxtOn]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {needsProof && (
            <TouchableOpacity style={styles.proofBtn}
              onPress={method === 'cheque' ? pickCheckPhoto : pickTransferFile} activeOpacity={0.85}>
              <Text style={styles.proofTxt}>
                {proof ? `✓ ${proof.label}` : method === 'cheque' ? '📷 Tomar foto del cheque' : '📎 Adjuntar comprobante (PDF/imagen)'}
              </Text>
            </TouchableOpacity>
          )}
          {needsProof && <Text style={styles.hint}>El comprobante es opcional. Se sube con conexión.</Text>}

          <View style={styles.btns}>
            <TouchableOpacity style={styles.cancel} onPress={close} disabled={busy}>
              <Text style={styles.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ok, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.okTxt}>Registrar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10 },
  title: { fontSize: 17, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, color: '#6b7280' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
  chipTxtOn: { color: '#fff' },
  proofBtn: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 2 },
  proofTxt: { color: '#1d4ed8', fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 11, color: '#9ca3af' },
  btns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancel: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  cancelTxt: { color: '#374151', fontWeight: '700' },
  ok: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center' },
  okTxt: { color: '#fff', fontWeight: '700' },
});
