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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getDisplayName, formatCajones, type DeliveryStatus, type EggType } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useEggTypes } from '../hooks/useEggTypes';
import { useCreateDelivery } from '../hooks/useCreateDelivery';
import { useCustomerPreferences, useAddPreference } from '../hooks/useCustomerPreferences';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
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
  const { customer: c } = route.params;
  const { profile } = useAuth();
  const { isOnline } = useNetworkStatus();

  const { data: eggTypes, isLoading: loadingTypes } = useEggTypes();
  const { data: preferences } = useCustomerPreferences();
  const createDelivery = useCreateDelivery();
  const addPref = useAddPreference();

  const [status, setStatus] = useState<DeliveryStatus>('entregado');
  const [eggTypeId, setEggTypeId] = useState<string | null>(null);
  const [cajasPlasticas, setCajasPlasticas] = useState(2); // 2 plásticas = 1 cajón
  const [notes, setNotes] = useState('');

  const isDelivered = status === 'entregado';

  // Preferencias de este cliente (principal primero)
  const myPrefs = useMemo(
    () => (preferences ?? []).filter((p) => p.customer_id === c.id),
    [preferences, c.id],
  );
  const primaryPrefId = myPrefs.find((p) => p.is_primary)?.egg_type_id ?? null;

  // Prellenar: selección manual > tipo principal del cliente > primer tipo del catálogo
  const effectiveEggTypeId = useMemo(() => {
    if (eggTypeId) return eggTypeId;
    if (primaryPrefId) return primaryPrefId;
    return eggTypes && eggTypes.length > 0 ? eggTypes[0].id : null;
  }, [eggTypeId, primaryPrefId, eggTypes]);

  function inc() {
    setCajasPlasticas((n) => Math.min(n + 1, 99));
  }
  function dec() {
    setCajasPlasticas((n) => Math.max(n - 1, 0));
  }

  async function onSave() {
    if (!profile) return;
    if (isDelivered && !effectiveEggTypeId) {
      Alert.alert('Falta el tipo', 'Elegí una categoría de huevo.');
      return;
    }

    const items =
      isDelivered && effectiveEggTypeId
        ? [{ egg_type_id: effectiveEggTypeId, cajas_plasticas: cajasPlasticas }]
        : [];

    try {
      await createDelivery.mutateAsync({
        id: uuidv4(),
        customer_id: c.id,
        driver_id: profile.id,
        status,
        notes: notes.trim() || null,
        delivered_at: new Date().toISOString(),
        items,
      });

      // Auto-sugerencia: si entregó un tipo que no está en los habituales, ofrecer agregarlo
      const deliveredNew =
        isDelivered &&
        effectiveEggTypeId &&
        !myPrefs.some((p) => p.egg_type_id === effectiveEggTypeId);
      if (deliveredNew) {
        const egg = eggTypes?.find((t) => t.id === effectiveEggTypeId);
        Alert.alert(
          'Agregar a habituales',
          `¿Agregar "${egg?.name ?? 'este tipo'}" a los tipos habituales de este cliente?`,
          [
            { text: 'No', style: 'cancel', onPress: () => navigation.goBack() },
            {
              text: 'Sí, agregar',
              onPress: () => {
                addPref.mutate({
                  customer_id: c.id,
                  egg_type_id: effectiveEggTypeId,
                  make_primary: myPrefs.length === 0,
                });
                navigation.goBack();
              },
            },
          ],
        );
        return;
      }

      navigation.goBack();
    } catch (e: any) {
      // Sin conexión la mutación queda pausada y se reintenta sola: no es error.
      if (!isOnline) {
        Alert.alert(
          'Guardado sin conexión',
          'La entrega se registrará automáticamente cuando vuelva la señal.',
        );
        navigation.goBack();
        return;
      }
      Alert.alert('Error', e?.message ?? 'No se pudo guardar la entrega.');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Registrar entrega</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
            {/* Tipo de huevo */}
            <Text style={styles.label}>Tipo de huevo</Text>
            {loadingTypes ? (
              <ActivityIndicator color="#f59e0b" style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.chipRow}>
                {(eggTypes ?? []).map((t: EggType) => {
                  const selected = effectiveEggTypeId === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => setEggTypeId(t.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Cantidad */}
            <Text style={styles.label}>Cantidad (cajas plásticas)</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={dec} activeOpacity={0.7}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{cajasPlasticas}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={inc} activeOpacity={0.7}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.equiv}>
              = {formatCajones(cajasPlasticas)}{' '}
              {formatCajones(cajasPlasticas) === '1' ? 'cajón' : 'cajones'}
            </Text>
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
