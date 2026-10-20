import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getDisplayName, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import { useEggTypes } from '../hooks/useEggTypes';
import { useBoxBalances } from '../hooks/useBoxBalances';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useRegisterBoxPickup } from '../hooks/useBoxPickups';
import { useCustomerSchedules, useSetSchedule, useClearSchedule } from '../hooks/useCustomerSchedules';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';
import {
  useCustomerPreferences,
  useAddPreference,
  useRemovePreference,
  useSetPrimaryPreference,
} from '../hooks/useCustomerPreferences';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'CustomerDetail'>;

function NavButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.navBtn, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.navBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CustomerDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();
  const { customer: c } = route.params;
  const { signOut, profile } = useAuth();
  const { resetTimers } = useInactivityTimer(signOut);
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();
  const { data: boxBalances } = useBoxBalances();
  const boxBalance = boxBalances?.[c.id] ?? 0;

  // Recogida de cajas sin entrega
  const registerPickup = useRegisterBoxPickup();
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupQty, setPickupQty] = useState('');

  // Horario de cierre del cliente
  const { data: schedules } = useCustomerSchedules();
  const setSchedule = useSetSchedule();
  const clearSchedule = useClearSchedule();
  const mySchedule = (schedules ?? []).find((s) => s.customer_id === c.id)?.closing_time ?? null;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [timeInput, setTimeInput] = useState('');

  function doPickup() {
    if (!profile) return;
    const n = parseInt(pickupQty.replace(/[^0-9]/g, ''), 10) || 0;
    if (n <= 0) { Alert.alert('Cantidad inválida', 'Poné cuántas cajas recogés (mayor que 0).'); return; }
    registerPickup.mutate(
      { id: uuidv4(), customer_id: c.id, driver_id: profile.id, qty: n },
      {
        onSuccess: () => showToast(`Recogida registrada: ${n} caja(s)`, 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo registrar la recogida', 'error'); },
      },
    );
    if (!isOnline) showToast(`Recogida de ${n} caja(s) guardada`, 'success');
    setPickupOpen(false);
    setPickupQty('');
  }

  function saveSchedule() {
    if (!profile) return;
    const m = timeInput.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) { Alert.alert('Hora inválida', 'Escribí la hora como HH:MM (ej: 18:00).'); return; }
    const hh = parseInt(m[1], 10); const mm = parseInt(m[2], 10);
    if (hh > 23 || mm > 59) { Alert.alert('Hora inválida', 'La hora debe ser 00:00–23:59.'); return; }
    const closing = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    setSchedule.mutate(
      { customer_id: c.id, closing_time: closing, updated_by: profile.id },
      {
        onSuccess: () => { setScheduleOpen(false); showToast(`Horario guardado: cierra ${closing}`, 'success'); },
        onError: () => showToast('No se pudo guardar el horario (¿hay conexión?)', 'error'),
      },
    );
  }

  function removeSchedule() {
    clearSchedule.mutate(c.id, {
      onSuccess: () => showToast('Horario quitado', 'success'),
      onError: () => showToast('No se pudo quitar (¿hay conexión?)', 'error'),
    });
  }

  function openGoogleMaps() {
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${c.lat},${c.lng}&directionsmode=driving`,
      android: `google.navigation:q=${c.lat},${c.lng}&mode=d`,
    });
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`;

    Linking.canOpenURL(url!).then((supported) => {
      Linking.openURL(supported ? url! : fallback);
    });
  }

  function openWaze() {
    const url = `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'No se pudo abrir Waze'),
    );
  }

  function openAppleMaps() {
    const url = `http://maps.apple.com/?daddr=${c.lat},${c.lng}&dirflg=d`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'No se pudo abrir Apple Maps'),
    );
  }

  function callPhone() {
    Linking.openURL(`tel:${c.phone}`).catch(() =>
      Alert.alert('Error', 'No se pudo realizar la llamada'),
    );
  }

  // Número en formato internacional solo dígitos (ej: 5989XXXXXXX) para WhatsApp
  function waDigits(): string {
    const d = c.phone.replace(/\D/g, '');
    // si no trae código de país (empieza con 0 o con 9), asumimos Uruguay (598)
    if (d.startsWith('598')) return d;
    if (d.startsWith('0')) return `598${d.slice(1)}`;
    return `598${d}`;
  }

  function whatsappMessage() {
    const n = waDigits();
    const url = `whatsapp://send?phone=${n}`;
    const web = `https://wa.me/${n}`;
    Linking.canOpenURL(url)
      .then((ok) => Linking.openURL(ok ? url : web))
      .catch(() => Linking.openURL(web).catch(() => Alert.alert('Error', 'No se pudo abrir WhatsApp')));
  }

  function whatsappCall() {
    // WhatsApp no permite iniciar la llamada por link; abrimos el chat del
    // contacto para llamar desde ahí.
    const n = waDigits();
    Linking.openURL(`https://wa.me/${n}`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir WhatsApp'),
    );
  }

  return (
    <View style={styles.container} onTouchStart={resetTimers}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {getDisplayName(c)}
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Badge tipo */}
        <View style={[
          styles.typeBadge,
          { backgroundColor: c.customer_type === 'empresa' ? '#dbeafe' : '#fef9c3' },
        ]}>
          <Text style={[
            styles.typeBadgeText,
            { color: c.customer_type === 'empresa' ? '#1d4ed8' : '#92400e' },
          ]}>
            {c.customer_type === 'empresa' ? 'Empresa / Local' : 'Persona física'}
          </Text>
        </View>

        {/* Datos empresa */}
        {c.customer_type === 'empresa' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Datos del local / empresa</Text>
            {c.business_name && <InfoRow icon="🏢" label="Razón social" value={c.business_name} />}
            {c.tax_id && <InfoRow icon="🪪" label="RUT" value={c.tax_id} />}
            {c.contact_name && <InfoRow icon="👤" label="Persona de contacto" value={c.contact_name} />}
            {c.email && <InfoRow icon="✉️" label="Email" value={c.email} />}
          </View>
        )}

        {/* Info general */}
        <View style={styles.card}>
          {c.customer_number != null && (
            <InfoRow icon="🔢" label="N° de cliente" value={String(c.customer_number)} />
          )}
          {c.customer_type === 'persona_fisica' && c.email && (
            <InfoRow icon="✉️" label="Email" value={c.email} />
          )}
          <InfoRow icon="📞" label="Teléfono" value={c.phone} />
          <InfoRow icon="📍" label="Dirección" value={c.address} />
          {c.notes && <InfoRow icon="📝" label="Notas" value={c.notes} />}
        </View>

        {/* Tipos de huevo habituales */}
        {/* Cajas plásticas en el local */}
        <View style={styles.boxCard}>
          <Text style={styles.boxIcon}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.boxLabel}>Cajas plásticas en el local</Text>
            <Text style={styles.boxHint}>Prestadas al cliente, pendientes de recoger</Text>
          </View>
          <Text style={[styles.boxValue, (boxBalance ?? 0) < 0 && styles.boxValueNeg]}>{boxBalance ?? 0}</Text>
        </View>

        {/* Recoger cajas sin entrega */}
        <TouchableOpacity style={styles.pickupBtn} onPress={() => setPickupOpen(true)} activeOpacity={0.85}>
          <Text style={styles.pickupBtnText}>📦  Recoger cajas (sin entrega)</Text>
        </TouchableOpacity>

        {/* Horario de cierre */}
        <View style={styles.schedCard}>
          <Text style={styles.schedIcon}>🕒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.schedLabel}>Horario de cierre</Text>
            <Text style={styles.schedHint}>
              {mySchedule ? `Cierra a las ${mySchedule.slice(0, 5)} · aviso 1 h y 30 min antes` : 'Sin horario. Si este cliente cierra a cierta hora, marcalo.'}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <TouchableOpacity
              style={styles.schedEditBtn}
              onPress={() => { setTimeInput(mySchedule ? mySchedule.slice(0, 5) : ''); setScheduleOpen(true); }}
            >
              <Text style={styles.schedEditText}>{mySchedule ? 'Cambiar' : 'Marcar'}</Text>
            </TouchableOpacity>
            {mySchedule && (
              <TouchableOpacity style={styles.schedClearBtn} onPress={removeSchedule}>
                <Text style={styles.schedClearText}>Quitar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <EggPreferencesCard customerId={c.id} />

        {/* Registrar entrega */}
        <TouchableOpacity
          style={styles.deliveryBtn}
          onPress={() => navigation.navigate('RegisterDelivery', { customer: c })}
          activeOpacity={0.85}
        >
          <Text style={styles.deliveryBtnText}>🥚  Registrar entrega</Text>
        </TouchableOpacity>

        {/* Contacto: llamar + WhatsApp */}
        <Text style={styles.contactTitle}>Contactar al cliente</Text>
        <View style={styles.contactRow}>
          <TouchableOpacity style={[styles.contactBtn, styles.callBtn2]} onPress={callPhone} activeOpacity={0.85}>
            <Text style={styles.contactEmoji}>📞</Text>
            <Text style={styles.callBtnText2}>Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactBtn, styles.waBtn]} onPress={whatsappCall} activeOpacity={0.85}>
            <Text style={styles.contactEmoji}>📱</Text>
            <Text style={styles.waBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.contactBtn, styles.waBtn]} onPress={whatsappMessage} activeOpacity={0.85}>
            <Text style={styles.contactEmoji}>💬</Text>
            <Text style={styles.waBtnText}>Mensaje</Text>
          </TouchableOpacity>
        </View>

        {/* Navegación */}
        <View style={styles.navSection}>
          <Text style={styles.navTitle}>Navegar hasta aquí</Text>
          <View style={styles.navButtons}>
            <NavButton
              label="🗺  Google Maps"
              color="#4285f4"
              onPress={openGoogleMaps}
            />
            <NavButton
              label="🔵  Waze"
              color="#33ccff"
              onPress={openWaze}
            />
            {Platform.OS === 'ios' && (
              <NavButton
                label="🍎  Apple Maps"
                color="#34c759"
                onPress={openAppleMaps}
              />
            )}
          </View>
        </View>

        {/* Coordenadas */}
        <Text style={styles.coords}>
          {c.lat.toFixed(6)}, {c.lng.toFixed(6)}
        </Text>
      </ScrollView>

      {/* Modal: recoger cajas sin entrega */}
      <Modal visible={pickupOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPickupOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Recoger cajas plásticas</Text>
            <Text style={styles.modalSub}>Sin entrega. En el local hay {Math.max(0, boxBalance)} caja(s).</Text>
            <TextInput
              style={styles.modalInput}
              value={pickupQty}
              onChangeText={(t) => setPickupQty(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="Cantidad"
              placeholderTextColor="#9ca3af"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => { setPickupOpen(false); setPickupQty(''); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalOk]} onPress={doPickup}>
                <Text style={styles.modalOkText}>Recoger</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: horario de cierre */}
      <Modal visible={scheduleOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setScheduleOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Horario de cierre</Text>
            <Text style={styles.modalSub}>Hora en que el cliente deja de recibir mercadería. Te avisamos 1 h y 30 min antes.</Text>
            <TextInput
              style={styles.modalInput}
              value={timeInput}
              onChangeText={setTimeInput}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              placeholder="HH:MM (ej: 18:00)"
              placeholderTextColor="#9ca3af"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setScheduleOpen(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalOk]} onPress={saveSchedule}>
                <Text style={styles.modalOkText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function eggDotColor(color: EggType['color']): string {
  if (color === 'rojo') return '#ef4444';
  if (color === 'blanco') return '#d1d5db';
  return '#f59e0b';
}

function EggPreferencesCard({ customerId }: { customerId: string }) {
  const { data: eggTypes } = useEggTypes();
  const { data: preferences } = useCustomerPreferences();
  const addPref = useAddPreference();
  const removePref = useRemovePreference();
  const setPrimary = useSetPrimaryPreference();

  const myPrefs = (preferences ?? []).filter((p) => p.customer_id === customerId);
  const selectedIds = new Set(myPrefs.map((p) => p.egg_type_id));
  const primaryId = myPrefs.find((p) => p.is_primary)?.egg_type_id ?? null;

  function toggle(eggTypeId: string) {
    if (selectedIds.has(eggTypeId)) {
      removePref.mutate({ customer_id: customerId, egg_type_id: eggTypeId });
    } else {
      // Si es el primero que se agrega, queda como principal
      const makePrimary = myPrefs.length === 0;
      addPref.mutate({ customer_id: customerId, egg_type_id: eggTypeId, make_primary: makePrimary });
    }
  }

  function makePrimary(eggTypeId: string) {
    if (primaryId === eggTypeId) return;
    setPrimary.mutate({ customer_id: customerId, egg_type_id: eggTypeId });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Tipos de huevo habituales</Text>
      <Text style={styles.prefHint}>
        Tocá para agregar o quitar. Mantené presionado un tipo seleccionado para marcarlo como principal ⭐. En la entrega podés elegir cualquiera.
      </Text>
      <View style={styles.prefChips}>
        {(eggTypes ?? []).map((t) => {
          const selected = selectedIds.has(t.id);
          const isPrimary = primaryId === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.prefChip, selected && styles.prefChipSelected, isPrimary && styles.prefChipPrimary]}
              onPress={() => toggle(t.id)}
              onLongPress={() => selected && makePrimary(t.id)}
              delayLongPress={280}
              activeOpacity={0.8}
            >
              <View style={[styles.prefDot, { backgroundColor: eggDotColor(t.color) }]} />
              <Text style={[styles.prefChipText, selected && styles.prefChipTextSelected]}>
                {isPrimary ? '⭐ ' : ''}{t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boxCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  boxIcon: { fontSize: 26 },
  boxLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  boxHint: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  boxValue: { fontSize: 28, fontWeight: '800', color: '#0f766e' },
  boxValueNeg: { color: '#dc2626' },
  pickupBtn: {
    backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  pickupBtnText: { color: '#0e7490', fontSize: 15, fontWeight: '800' },
  schedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6',
  },
  schedIcon: { fontSize: 24 },
  schedLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  schedHint: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  schedEditBtn: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center' },
  schedEditText: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  schedClearBtn: { paddingVertical: 4, alignItems: 'center' },
  schedClearText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22, width: '100%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 18 },
  modalInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 14,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalCancel: { backgroundColor: '#f3f4f6' },
  modalCancelText: { color: '#6b7280', fontSize: 15, fontWeight: '700' },
  modalOk: { backgroundColor: '#16a34a' },
  modalOkText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
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
  backBtnText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    marginTop: 1,
  },
  deliveryBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  deliveryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  callBtn: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  callBtnText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 15,
  },
  contactTitle: {
    fontSize: 13, fontWeight: '600', color: '#374151',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  contactRow: { flexDirection: 'row', gap: 8 },
  contactBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 4, borderWidth: 1 },
  contactEmoji: { fontSize: 20 },
  callBtn2: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
  callBtnText2: { color: '#166534', fontWeight: '700', fontSize: 13 },
  waBtn: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  waBtnText: { color: '#128C7E', fontWeight: '700', fontSize: 13 },
  navSection: {
    gap: 10,
  },
  navTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navButtons: {
    gap: 8,
  },
  navBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prefHint: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 17,
    marginBottom: 4,
  },
  prefChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  prefChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  prefChipPrimary: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  prefDot: { width: 9, height: 9, borderRadius: 5 },
  prefChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  prefChipTextSelected: { color: '#1d4ed8' },
  coords: {
    textAlign: 'center',
    fontSize: 11,
    color: '#d1d5db',
    marginTop: 4,
    marginBottom: 24,
  },
});
