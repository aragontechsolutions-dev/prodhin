import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useRegisterCompetitor } from '../hooks/useCompetitors';
import { showToast } from '../lib/toastStore';
import { uuidv4 } from '../lib/uuid';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MarkCompetitor'>;

const RADII = [200, 500, 1000, 2000];

export default function MarkCompetitorScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const register = useRegisterCompetitor();

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [radius, setRadius] = useState(500);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const competitorId = useState(() => uuidv4())[0];

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

  function submit() {
    if (!profile) return;
    if (!name.trim()) { Alert.alert('Falta el nombre', 'Poné el nombre de la competencia.'); return; }
    if (!coords) { Alert.alert('Falta la ubicación', 'Tocá "Usar mi ubicación" cerca de donde opera.'); return; }

    register.mutate(
      {
        id: competitorId,
        name: name.trim(),
        lat: coords.lat,
        lng: coords.lng,
        radius_m: radius,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => showToast('Competencia marcada — la administración la revisará', 'success'),
        onError: (e: unknown) => { if (isOnline) showToast((e instanceof Error ? e.message : null) ?? 'No se pudo marcar', 'error'); },
      },
    );
    if (!isOnline) showToast('Guardado (se enviará al reconectar)', 'success');
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Marcar competencia</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.intro}>Marcá dónde viste operar a la competencia. La administración lo revisa y aprueba.</Text>

          <Text style={styles.label}>Nombre de la competencia</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Huevos El Trébol" placeholderTextColor="#9ca3af" />

          <Text style={styles.label}>Ubicación</Text>
          <TouchableOpacity style={styles.locBtn} onPress={getLocation} activeOpacity={0.85}>
            {locating ? <ActivityIndicator color="#b91c1c" /> : <Text style={styles.locBtnText}>📍 {coords ? `Ubicación: ${coords.lat}, ${coords.lng}` : 'Usar mi ubicación actual'}</Text>}
          </TouchableOpacity>

          <Text style={styles.label}>Radio de acción aproximado</Text>
          <View style={styles.radRow}>
            {RADII.map((r) => (
              <TouchableOpacity key={r} style={[styles.radChip, radius === r && styles.radChipOn]} onPress={() => setRadius(r)} activeOpacity={0.8}>
                <Text style={[styles.radChipText, radius === r && styles.radChipTextOn]}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notas (opcional)</Text>
          <TextInput style={styles.notes} value={notes} onChangeText={setNotes} placeholder="Ej: reparte los martes por la zona…" placeholderTextColor="#9ca3af" multiline />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Marcar competencia</Text>
        </TouchableOpacity>
        {!isOnline && <Text style={styles.offlineHint}>Sin conexión: se guarda igual y se envía al reconectar.</Text>}
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
  intro: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827', marginTop: 4 },
  locBtn: { marginTop: 6, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  locBtnText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  radRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  radChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  radChipOn: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  radChipText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  radChipTextOn: { color: '#fff' },
  notes: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, minHeight: 54, fontSize: 14, color: '#111827', textAlignVertical: 'top', marginTop: 4 },
  saveBtn: { backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  offlineHint: { fontSize: 12, color: '#92400e', marginTop: 8, textAlign: 'center' },
});
