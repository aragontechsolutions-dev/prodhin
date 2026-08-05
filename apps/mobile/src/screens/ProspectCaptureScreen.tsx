import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useMyProspects, useRegisterProspect } from '../hooks/useProspects';
import { uploadProspectPhoto } from '../lib/prospects';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProspectCapture'>;

interface Offer { id: string; egg_type: string; format: string; price: string; photo_uri?: string; photo_path?: string; uploading?: boolean }

export default function ProspectCaptureScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { data: mine } = useMyProspects(profile?.id);
  const register = useRegisterProspect();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [hasComp, setHasComp] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const prospectId = useState(() => uuidv4())[0];

  async function getLocation() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { showToast('Sin permiso de ubicación', 'error'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: +loc.coords.latitude.toFixed(6), lng: +loc.coords.longitude.toFixed(6) });
      showToast('Ubicación capturada', 'success');
    } catch {
      showToast('No se pudo obtener la ubicación', 'error');
    } finally {
      setLocating(false);
    }
  }

  function addOffer() {
    setOffers((o) => [...o, { id: uuidv4(), egg_type: '', format: '', price: '' }]);
  }
  function setOffer(id: string, patch: Partial<Offer>) {
    setOffers((o) => o.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeOffer(id: string) {
    setOffers((o) => o.filter((x) => x.id !== id));
  }

  async function takePhoto(offerId: string) {
    if (!isOnline) { showToast('Sin conexión: la foto se puede subir con señal', 'info'); return; }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') { showToast('Sin permiso de cámara', 'error'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    setOffer(offerId, { photo_uri: uri, uploading: true });
    try {
      const path = await uploadProspectPhoto(uri, prospectId);
      setOffer(offerId, { photo_path: path, uploading: false });
      showToast('Foto subida', 'success');
    } catch {
      setOffer(offerId, { uploading: false });
      showToast('No se pudo subir la foto', 'error');
    }
  }

  function submit() {
    if (!profile) return;
    if (!name.trim()) { Alert.alert('Falta el nombre', 'Poné el nombre del local / comercio.'); return; }
    if (!coords) { Alert.alert('Falta la ubicación', 'Tocá "Usar mi ubicación" estando en el local.'); return; }
    if (offers.some((o) => o.uploading)) { Alert.alert('Esperá', 'Hay una foto subiendo todavía.'); return; }

    register.mutate(
      {
        id: prospectId,
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        lat: coords.lat,
        lng: coords.lng,
        has_competition: hasComp,
        notes: notes.trim() || null,
        created_by: profile.id,
        offers: offers.map((o) => ({
          id: o.id,
          egg_type: o.egg_type.trim() || null,
          format: o.format.trim() || null,
          price: o.price.trim() ? parseFloat(o.price.replace(',', '.')) : null,
          photo_path: o.photo_path ?? null,
        })),
      },
      {
        onSuccess: () => showToast('Prospecto registrado', 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo registrar', 'error'); },
      },
    );
    if (!isOnline) showToast('Prospecto guardado (se enviará al reconectar)', 'success');
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Nuevo potencial cliente</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.label}>Nombre del local / comercio</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Almacén La Esquina" placeholderTextColor="#9ca3af" />
          <Text style={styles.label}>Dirección (opcional)</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Calle, número, ciudad" placeholderTextColor="#9ca3af" />
          <Text style={styles.label}>Teléfono (opcional)</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="09X XXX XXX" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />

          <Text style={styles.label}>Ubicación</Text>
          <TouchableOpacity style={styles.locBtn} onPress={getLocation} activeOpacity={0.85}>
            {locating ? <ActivityIndicator color="#0e7490" /> : <Text style={styles.locBtnText}>📍 {coords ? `Ubicación: ${coords.lat}, ${coords.lng}` : 'Usar mi ubicación actual'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.compRow} onPress={() => setHasComp((v) => !v)} activeOpacity={0.8}>
            <View style={[styles.check, hasComp && styles.checkOn]}>{hasComp && <Text style={styles.checkMark}>✓</Text>}</View>
            <Text style={styles.compText}>Ya tiene oferta de la competencia</Text>
          </TouchableOpacity>
        </View>

        {/* Oferta de la competencia */}
        <Text style={styles.sectionTitle}>Oferta de la competencia</Text>
        <Text style={styles.sectionHint}>Agregá cada tipo de huevo con su formato, precio y foto.</Text>
        {offers.map((o) => (
          <View key={o.id} style={styles.offer}>
            <View style={styles.offerTop}>
              <TextInput style={[styles.oInput, { flex: 1 }]} value={o.egg_type} onChangeText={(t) => setOffer(o.id, { egg_type: t })} placeholder="Tipo (ej: Rojo grande)" placeholderTextColor="#9ca3af" />
              <TouchableOpacity onPress={() => removeOffer(o.id)} style={styles.oRemove}><Text style={styles.oRemoveText}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.offerRow}>
              <TextInput style={[styles.oInput, { flex: 1 }]} value={o.format} onChangeText={(t) => setOffer(o.id, { format: t })} placeholder="Formato (de a 30/15/6)" placeholderTextColor="#9ca3af" />
              <TextInput style={[styles.oInput, { width: 100 }]} value={o.price} onChangeText={(t) => setOffer(o.id, { price: t.replace(/[^0-9.,]/g, '') })} placeholder="Precio" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
            </View>
            <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(o.id)} activeOpacity={0.85}>
              {o.uploading ? <ActivityIndicator color="#1d4ed8" /> : (
                o.photo_path ? <Text style={styles.photoBtnOk}>✓ Foto lista — tocá para cambiar</Text> : <Text style={styles.photoBtnText}>📷 Tomar foto</Text>
              )}
            </TouchableOpacity>
            {o.photo_uri && <Image source={{ uri: o.photo_uri }} style={styles.thumb} resizeMode="cover" />}
          </View>
        ))}
        <TouchableOpacity style={styles.addOffer} onPress={addOffer} activeOpacity={0.8}>
          <Text style={styles.addOfferText}>＋ Agregar tipo de huevo de la competencia</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Notas (opcional)</Text>
        <TextInput style={styles.notes} value={notes} onChangeText={setNotes} placeholder="Observaciones…" placeholderTextColor="#9ca3af" multiline />

        <TouchableOpacity style={styles.saveBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Registrar potencial cliente</Text>
        </TouchableOpacity>
        {!isOnline && <Text style={styles.offlineHint}>Sin conexión: se guarda igual. Las fotos necesitan señal para subir.</Text>}

        <Text style={styles.histTitle}>Mis relevamientos ({(mine ?? []).length})</Text>
      </ScrollView>
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
  form: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', padding: 16, gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827', marginTop: 4 },
  locBtn: { marginTop: 6, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  locBtnText: { color: '#0e7490', fontSize: 14, fontWeight: '700' },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  checkMark: { color: '#fff', fontSize: 15, fontWeight: '800' },
  compText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 8 },
  sectionHint: { fontSize: 12, color: '#9ca3af' },
  offer: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#f3f4f6', padding: 12, gap: 8, marginTop: 8 },
  offerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerRow: { flexDirection: 'row', gap: 8 },
  oInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#f9fafb', paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: '#111827' },
  oRemove: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  oRemoveText: { color: '#b91c1c', fontSize: 15, fontWeight: '800' },
  photoBtn: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  photoBtnText: { color: '#1d4ed8', fontSize: 13, fontWeight: '700' },
  photoBtnOk: { color: '#15803d', fontSize: 13, fontWeight: '700' },
  thumb: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#e5e7eb' },
  addOffer: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#93c5fd', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  addOfferText: { color: '#1d4ed8', fontSize: 14, fontWeight: '700' },
  notes: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, minHeight: 54, fontSize: 14, color: '#111827', textAlignVertical: 'top', marginTop: 4 },
  saveBtn: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineHint: { fontSize: 12, color: '#92400e', marginTop: 8, textAlign: 'center' },
  histTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginTop: 16 },
});
