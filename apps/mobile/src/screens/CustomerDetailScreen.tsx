import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getDisplayName } from '../types';

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {getDisplayName(c)}
        </Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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

        {/* Info card */}
        <View style={styles.card}>
          <InfoRow icon="📞" label="Teléfono" value={c.phone} />
          {c.email && <InfoRow icon="✉️" label="Email" value={c.email} />}
          <InfoRow icon="📍" label="Dirección" value={c.address} />
          {c.contact_name && (
            <InfoRow icon="👤" label="Contacto" value={c.contact_name} />
          )}
          {c.notes && <InfoRow icon="📝" label="Notas" value={c.notes} />}
        </View>

        {/* Botón llamar */}
        <TouchableOpacity style={styles.callBtn} onPress={callPhone}>
          <Text style={styles.callBtnText}>📞  Llamar al cliente</Text>
        </TouchableOpacity>

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
    width: 72,
  },
  backBtnText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '600',
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
  coords: {
    textAlign: 'center',
    fontSize: 11,
    color: '#d1d5db',
    marginTop: 4,
    marginBottom: 24,
  },
});
